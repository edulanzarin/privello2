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
