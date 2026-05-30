/**
 * Estatísticas diárias por perfil de Acompanhante.
 *
 * Mantém uma linha por (userId, day) na tabela `profile_daily_stats`.
 * Usado pra alimentar o gráfico de "visualizações por dia" no
 * painel privado.
 *
 * O ponto de leitura agrega os últimos 30 dias e devolve uma
 * série temporal contínua (preenchendo dias sem registro com
 * 0). O ponto de escrita é chamado por:
 *
 *   - `incrementarVisualizacao` (perfil público)
 *   - `toggleLike` (interações de mídia, no futuro)
 *
 * Mantemos a granularidade em "dia" para simplificar — pra séries
 * por hora seria preciso outro modelo.
 */

import { db } from "@/lib/db";

import { bucketsHeatmap, type ViewOrigin } from "@/domain/stats/origem";

/**
 * Normaliza uma `Date` para meia-noite UTC do mesmo dia. Mantém
 * a timezone do servidor irrelevante — tudo agregado em UTC.
 */
function dayUtc(date: Date): Date {
    return new Date(
        Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
    );
}

/**
 * Incrementa um campo (`views` ou `likes`) na linha do dia atual.
 * Idempotente em termos de SQL — o `upsert` cria a linha quando
 * é a primeira atividade do dia.
 *
 * `delta` aceita negativos (descurtir reduz `likes` em -1). Quando
 * o resultado seria menor que zero (ex.: curtidas decrementadas
 * antes do upsert original ter rodado), o `GREATEST(0, ...)` no
 * fallback garante que o contador nunca vira negativo. Como o
 * Prisma `increment` não suporta clamp diretamente, fazemos uma
 * leitura+update extra quando `delta < 0`.
 */
export async function incrementarStatDiaria(input: {
    userId: string;
    field: "views" | "likes";
    delta?: number;
    now?: Date;
}): Promise<void> {
    const day = dayUtc(input.now ?? new Date());
    const delta = input.delta ?? 1;

    if (delta >= 0) {
        await db.profileDailyStat.upsert({
            where: { userId_day: { userId: input.userId, day } },
            update: { [input.field]: { increment: delta } },
            create: {
                userId: input.userId,
                day,
                views: input.field === "views" ? delta : 0,
                likes: input.field === "likes" ? delta : 0,
            },
        });
        return;
    }

    // Decremento: lê, clampa em zero e grava. Faz upsert vazio
    // pra garantir que a linha exista — depois aplica o decremento
    // sempre clampado.
    const existing = await db.profileDailyStat.findUnique({
        where: { userId_day: { userId: input.userId, day } },
        select: { views: true, likes: true },
    });
    if (!existing) {
        // Nada pra decrementar — não cria linha negativa.
        return;
    }
    const current = input.field === "views" ? existing.views : existing.likes;
    const next = Math.max(0, current + delta);
    await db.profileDailyStat.update({
        where: { userId_day: { userId: input.userId, day } },
        data: { [input.field]: next },
    });
}

/**
 * Ponto de série temporal — um dia.
 */
export interface StatDiaria {
    /** Data ISO (`YYYY-MM-DD`) — meia-noite UTC. */
    day: string;
    views: number;
    likes: number;
}

/**
 * Lê os últimos `dias` dias de stats do usuário, preenchendo dias
 * sem registro com zeros. Sempre retorna `dias` itens, ordenados
 * cronologicamente (mais antigo → mais recente).
 *
 * Default: 30 dias.
 */
export async function listarStatsDiarias(
    userId: string,
    options: { dias?: number; now?: Date } = {},
): Promise<ReadonlyArray<StatDiaria>> {
    const dias = Math.max(1, Math.min(90, options.dias ?? 30));
    const now = options.now ?? new Date();
    const todayUtc = dayUtc(now);
    const sinceUtc = new Date(
        todayUtc.getTime() - (dias - 1) * 86_400_000,
    );

    const rows = await db.profileDailyStat.findMany({
        where: {
            userId,
            day: { gte: sinceUtc, lte: todayUtc },
        },
        orderBy: { day: "asc" },
        select: { day: true, views: true, likes: true },
    });

    // Indexa por chave ISO pra preencher os gaps.
    const byKey = new Map<string, { views: number; likes: number }>();
    for (const r of rows) {
        const iso = r.day.toISOString().slice(0, 10);
        byKey.set(iso, { views: r.views, likes: r.likes });
    }

    const series: StatDiaria[] = [];
    for (let i = 0; i < dias; i++) {
        const d = new Date(sinceUtc.getTime() + i * 86_400_000);
        const iso = d.toISOString().slice(0, 10);
        const got = byKey.get(iso) ?? { views: 0, likes: 0 };
        series.push({ day: iso, views: got.views, likes: got.likes });
    }
    return series;
}


// ---------------------------------------------------------------------------
// Stats avançados (T10) — escrita
// ---------------------------------------------------------------------------

/**
 * Registra uma visualização nas agregações avançadas (heatmap por
 * hora × dia-da-semana + por origem). Best-effort — cada upsert é
 * isolado pra que uma falha não derrube as demais nem a métrica
 * principal. Chamado por `incrementarVisualizacao`.
 */
export async function registrarViewAvancada(input: {
    userId: string;
    origin: ViewOrigin;
    now?: Date;
}): Promise<void> {
    const now = input.now ?? new Date();
    const { weekday, hour } = bucketsHeatmap(now);

    // Heatmap por (weekday, hour).
    await db.profileHourlyStat
        .upsert({
            where: {
                userId_weekday_hour: {
                    userId: input.userId,
                    weekday,
                    hour,
                },
            },
            update: { views: { increment: 1 } },
            create: {
                userId: input.userId,
                weekday,
                hour,
                views: 1,
            },
        })
        .catch(() => undefined);

    // Por origem.
    await db.profileOriginStat
        .upsert({
            where: {
                userId_origin: {
                    userId: input.userId,
                    origin: input.origin,
                },
            },
            update: { views: { increment: 1 } },
            create: {
                userId: input.userId,
                origin: input.origin,
                views: 1,
            },
        })
        .catch(() => undefined);
}

/**
 * Registra um clique no botão de WhatsApp. Incrementa o agregado
 * total no perfil + o bucket diário (pra conversão por dia).
 * Best-effort — métrica não derruba o redirecionamento.
 */
export async function registrarCliqueWhatsapp(input: {
    userId: string;
    now?: Date;
}): Promise<void> {
    const day = dayUtc(input.now ?? new Date());

    await db.acompanhanteProfile
        .update({
            where: { userId: input.userId },
            data: { whatsappClicksCount: { increment: 1 } },
            select: { userId: true },
        })
        .catch(() => undefined);

    await db.profileDailyStat
        .upsert({
            where: { userId_day: { userId: input.userId, day } },
            update: { whatsappClicks: { increment: 1 } },
            create: {
                userId: input.userId,
                day,
                views: 0,
                likes: 0,
                whatsappClicks: 1,
            },
        })
        .catch(() => undefined);
}

// ---------------------------------------------------------------------------
// Stats avançados (T10) — leitura
// ---------------------------------------------------------------------------

/** Célula do heatmap 7×24. */
export interface HeatmapCell {
    weekday: number;
    hour: number;
    views: number;
}

/** Fatia por origem. */
export interface OrigemStat {
    origin: ViewOrigin;
    views: number;
}

/** Mídia no ranking "top mídias mais curtidas". */
export interface TopMidia {
    mediaId: string;
    kind: "PHOTO" | "VIDEO";
    storageKey: string;
    likesCount: number;
    commentsCount: number;
}

export interface StatsAvancadas {
    /** Matriz esparsa de 7×24 — só células com views > 0. */
    heatmap: ReadonlyArray<HeatmapCell>;
    /** Views por origem (todas as 4 origens, mesmo com 0). */
    origens: ReadonlyArray<OrigemStat>;
    /** Top mídias mais curtidas (limit configurável). */
    topMidias: ReadonlyArray<TopMidia>;
    /** Total de visualizações acumuladas (perfil). */
    totalViews: number;
    /** Total de cliques no WhatsApp acumulados. */
    totalWhatsappClicks: number;
    /**
     * Taxa de conversão visualização → clique no WhatsApp, em
     * porcentagem (0-100, arredondada a 1 casa). `null` quando não
     * há views (evita divisão por zero / número sem sentido).
     */
    conversao: number | null;
}

const ORIGENS_ORDEM: ReadonlyArray<ViewOrigin> = [
    "BUSCA",
    "HOME",
    "COMPARTILHADO",
    "DIRECT",
];

/**
 * Lê todas as estatísticas avançadas de um perfil em paralelo.
 *
 * - **Heatmap**: todas as linhas de `profile_hourly_stats`.
 * - **Origens**: lê `profile_origin_stats` e completa as 4 origens
 *   (mesmo as que têm 0 views) em ordem fixa pra UI estável.
 * - **Top mídias**: galeria COMMITTED ordenada por likes desc.
 * - **Conversão**: `whatsappClicksCount / viewsCount`.
 */
export async function obterStatsAvancadas(
    userId: string,
    options: { topMidiasLimit?: number } = {},
): Promise<StatsAvancadas> {
    const topLimit = Math.max(1, Math.min(20, options.topMidiasLimit ?? 6));

    const [hourly, origins, profile, topMedias] = await Promise.all([
        db.profileHourlyStat.findMany({
            where: { userId },
            select: { weekday: true, hour: true, views: true },
        }),
        db.profileOriginStat.findMany({
            where: { userId },
            select: { origin: true, views: true },
        }),
        db.acompanhanteProfile.findUnique({
            where: { userId },
            select: { viewsCount: true, whatsappClicksCount: true },
        }),
        db.media.findMany({
            where: {
                ownerId: userId,
                role: "GALLERY",
                status: "COMMITTED",
            },
            orderBy: [{ likesCount: "desc" }, { createdAt: "desc" }],
            take: topLimit,
            select: {
                id: true,
                kind: true,
                storageKey: true,
                likesCount: true,
                commentsCount: true,
            },
        }),
    ]);

    const heatmap: HeatmapCell[] = hourly
        .filter((h) => h.views > 0)
        .map((h) => ({ weekday: h.weekday, hour: h.hour, views: h.views }));

    const origemMap = new Map<ViewOrigin, number>();
    for (const o of origins) {
        origemMap.set(o.origin as ViewOrigin, o.views);
    }
    const origens: OrigemStat[] = ORIGENS_ORDEM.map((origin) => ({
        origin,
        views: origemMap.get(origin) ?? 0,
    }));

    const topMidias: TopMidia[] = topMedias.map((m) => ({
        mediaId: m.id,
        kind: m.kind === "VIDEO" ? "VIDEO" : "PHOTO",
        storageKey: m.storageKey,
        likesCount: m.likesCount,
        commentsCount: m.commentsCount,
    }));

    const totalViews = profile?.viewsCount ?? 0;
    const totalWhatsappClicks = profile?.whatsappClicksCount ?? 0;
    const conversao =
        totalViews > 0
            ? Math.round((totalWhatsappClicks / totalViews) * 1000) / 10
            : null;

    return {
        heatmap,
        origens,
        topMidias,
        totalViews,
        totalWhatsappClicks,
        conversao,
    };
}
