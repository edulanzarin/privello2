import type { Prisma } from "@prisma/client";

import { isBoostAtivo } from "@/domain/boost/definitions";
import { db } from "@/lib/db";

import type { PlanoExibicao } from "./index";

/**
 * Resumo público de uma Acompanhante para listagens de descoberta
 * (home, busca, etc.).
 *
 * Subset enxuto do {@link PerfilAcompanhantePublico} pra reduzir
 * payload em listagens. Mantém só o que o
 * {@link import("@/components").ProfileFeedCard} precisa pra
 * renderizar (sem PII).
 */
export interface FeedItem {
    /** `User.identificador` (slug). Usado pro link do card. */
    identificador: string;
    /** Nome de exibição. */
    nome: string;
    /** URL da foto de perfil ou `null`. */
    fotoUrl: string | null;
    /** Localização. */
    estadoSigla: string;
    cidadeNome: string;
    bairroNome: string | null;
    /** Texto livre da bio (truncado pelo consumidor). */
    descricao: string;
    /** Selo discriminado. Mesmo formato usado pelo perfil público. */
    planoExibicao: PlanoExibicao;
    /**
     * `true` quando a identidade foi verificada pelo admin. Mirror
     * de `AcompanhanteProfile.verificada` para o card mostrar o
     * `VerifiedBadge` sem join extra.
     */
    verificada: boolean;
    /** Total de visualizações públicas. */
    viewsCount: number;
    /** Total de avaliações. */
    reviewsCount: number;
    /** Valor da hora em centavos, ou `null` quando "a combinar". */
    valorHoraCents: number | null;
    /**
     * URL do áudio de apresentação ou `null` quando não há.
     * Quando presente, o caller pode renderizar inline com
     * {@link import("@/components").AudioWavePlayer}.
     */
    audioUrl: string | null;
    /** MIME type do áudio (necessário para o `<audio type>`). */
    audioMimeType: string | null;
    /**
     * Quantidade de mídias publicadas na galeria
     * (`role = GALLERY`, `status = COMMITTED`). Usado para a
     * "pílula de mídias" no card.
     */
    mediasCount: number;
}

/**
 * Tipo discriminado de bucket retornado por {@link listarFeedHome}.
 */
export type FeedSecao = "boost" | "alta";

/**
 * Forma do retorno consolidado da home.
 */
export interface FeedHome {
    /** Acompanhantes com `boostUntil > now()`. */
    boost: ReadonlyArray<FeedItem>;
    /**
     * "Em alta da semana": perfis com mais visualizações entre os
     * **atualizados nos últimos 7 dias**. Não inclui perfis com
     * Boost ativo (eles já aparecem em `boost`).
     *
     * NOTE — quando o `Sistema_de_Estatisticas` existir com
     * agregação por dia, trocar por "views nos últimos 7 dias".
     * Hoje usamos o `viewsCount` agregado + filtro por `updatedAt`
     * como aproximação intencional.
     */
    alta: ReadonlyArray<FeedItem>;
}

/**
 * Estatísticas globais para o glass-aside do hero.
 */
export interface HomeStats {
    /** Total de Acompanhantes com perfil visível e plano vigente. */
    perfisAtivos: number;
    /** Total de cidades únicas com pelo menos um perfil ativo. */
    cidades: number;
    /** Total de Acompanhantes com Boost ativo no momento. */
    boostsAtivos: number;
    /** Total de avaliações públicas registradas. */
    avaliacoes: number;
}

export interface ListarFeedHomeOptions {
    limite?: {
        boost?: number;
        alta?: number;
    };
    /** Janela em dias pra "em alta". Padrão: 7. */
    janelaDias?: number;
    now?: Date;
}

const include = {
    user: { select: { nome: true, identificador: true } },
    fotoPerfil: { select: { storageKey: true } },
    audioApresentacao: {
        select: { storageKey: true, mimeType: true, status: true },
    },
} satisfies Prisma.AcompanhanteProfileInclude;

type Row = Prisma.AcompanhanteProfileGetPayload<{ include: typeof include }>;

const baseWhereVisivel: Prisma.AcompanhanteProfileWhereInput = {
    perfilVisivel: true,
    planoVigente: { not: null },
    user: { type: "ACOMPANHANTE" },
};

/**
 * Lê os 2 buckets discriminados da home (Boost e Em alta).
 *
 * Critérios:
 *
 * - **`boost`**: `boostUntil > now()`. Ordenação `boostUntil` desc.
 * - **`alta`**: sem boost ativo, `updatedAt > now - janelaDias`,
 *   ordenação `viewsCount` desc + `updatedAt` desc.
 *
 * Itens já vêm sem PII e com `fotoUrl` derivada de `/api/storage/...`.
 *
 * Mídias publicadas (galeria com status committed) são contadas em
 * **um único groupBy** depois das queries principais para evitar
 * N+1 — caller recebe `mediasCount` já preenchido.
 */
export async function listarFeedHome(
    options: ListarFeedHomeOptions = {},
): Promise<FeedHome> {
    const now = options.now ?? new Date();
    const limites = {
        boost: options.limite?.boost ?? 30,
        alta: options.limite?.alta ?? 30,
    };
    const janelaMs = (options.janelaDias ?? 7) * 24 * 60 * 60 * 1000;
    const desde = new Date(now.getTime() - janelaMs);

    const [boostRows, altaRows] = await Promise.all([
        db.acompanhanteProfile.findMany({
            where: { ...baseWhereVisivel, boostUntil: { gt: now } },
            orderBy: [{ boostUntil: "desc" }],
            take: limites.boost,
            include,
        }),
        db.acompanhanteProfile.findMany({
            where: {
                ...baseWhereVisivel,
                OR: [{ boostUntil: null }, { boostUntil: { lte: now } }],
                updatedAt: { gte: desde },
            },
            orderBy: [{ viewsCount: "desc" }, { updatedAt: "desc" }],
            take: limites.alta,
            include,
        }),
    ]);

    // Conta mídias da galeria pra todos os perfis listados em uma
    // só query, evitando N+1.
    const allUserIds = Array.from(
        new Set([
            ...boostRows.map((r) => r.userId),
            ...altaRows.map((r) => r.userId),
        ]),
    );
    const mediasCountMap = await contarMidiasGaleria(allUserIds);

    return {
        boost: boostRows.map((r) =>
            toItem(r, now, mediasCountMap.get(r.userId) ?? 0),
        ),
        alta: altaRows.map((r) =>
            toItem(r, now, mediasCountMap.get(r.userId) ?? 0),
        ),
    };
}

/**
 * Conta mídias da galeria (`role = GALLERY`, `status = COMMITTED`)
 * agrupadas por `ownerId`. Single query — passa todos os user IDs
 * de uma vez.
 */
async function contarMidiasGaleria(
    ownerIds: ReadonlyArray<string>,
): Promise<Map<string, number>> {
    if (ownerIds.length === 0) return new Map();
    const grupos = await db.media.groupBy({
        by: ["ownerId"],
        where: {
            ownerId: { in: ownerIds as string[] },
            role: "GALLERY",
            status: "COMMITTED",
        },
        _count: { _all: true },
    });
    const map = new Map<string, number>();
    for (const g of grupos) {
        map.set(g.ownerId, g._count._all);
    }
    return map;
}

function toItem(row: Row, now: Date, mediasCount: number): FeedItem {
    const planoExibicao: PlanoExibicao = isBoostAtivo(row.boostUntil, now)
        ? "BOOST"
        : row.planoVigente === "PREMIUM"
            ? "PREMIUM"
            : "BASICO";

    const audioOk =
        row.audioApresentacao !== null &&
            row.audioApresentacao.status === "COMMITTED"
            ? row.audioApresentacao
            : null;

    return {
        identificador: row.user.identificador,
        nome: row.user.nome,
        fotoUrl: row.fotoPerfil
            ? `/api/storage/${row.fotoPerfil.storageKey}`
            : null,
        estadoSigla: row.estadoSigla,
        cidadeNome: row.cidadeNome,
        bairroNome: row.bairroNome,
        descricao: row.descricao,
        planoExibicao,
        verificada: row.verificada,
        viewsCount: row.viewsCount,
        reviewsCount: row.reviewsCount,
        valorHoraCents: row.valorHoraCents,
        audioUrl: audioOk ? `/api/storage/${audioOk.storageKey}` : null,
        audioMimeType: audioOk ? audioOk.mimeType : null,
        mediasCount,
    };
}

/**
 * Lê estatísticas globais pra o glass-aside do hero.
 *
 * Aggregations leves; cada uma é uma query simples, executadas em
 * paralelo. Falha numa não derruba a home — caller deve usar
 * try/catch e cair em fallback estático.
 */
export async function obterStatsHome(
    options: { now?: Date } = {},
): Promise<HomeStats> {
    const now = options.now ?? new Date();

    const [perfisAtivos, cidadesGroups, boostsAtivos, avaliacoes] =
        await Promise.all([
            db.acompanhanteProfile.count({ where: baseWhereVisivel }),
            // `groupBy` + `count(_all)` traduz pra um único SELECT
            // GROUP BY no Postgres em vez de carregar todas as
            // linhas pra contar em memória. O resultado é um array
            // de buckets — `length` é a quantidade de cidades
            // distintas.
            db.acompanhanteProfile.groupBy({
                by: ["estadoSigla", "cidadeNome"],
                where: baseWhereVisivel,
                _count: { _all: true },
            }),
            db.acompanhanteProfile.count({
                where: { ...baseWhereVisivel, boostUntil: { gt: now } },
            }),
            db.acompanhanteReview.count(),
        ]);

    return {
        perfisAtivos,
        cidades: cidadesGroups.length,
        boostsAtivos,
        avaliacoes,
    };
}

/**
 * Cidade com cobertura agregada — usada no carrossel de cidades
 * em destaque na home.
 */
export interface CidadeEmDestaque {
    cidadeNome: string;
    estadoSigla: string;
    /** Quantidade de perfis visíveis ativos. */
    count: number;
    /** URL da foto de perfil mais recente da cidade (capa do chip). */
    photoUrl: string | null;
}

/**
 * Lista as cidades com mais perfis ativos pra destacar na home.
 *
 * Faz um `groupBy(estadoSigla, cidadeNome)` ordenado por count
 * desc, depois enriquece cada cidade com a foto do perfil mais
 * recentemente atualizado pra usar como "capa" do chip.
 */
export async function listarCidadesEmDestaque(
    options: { limit?: number } = {},
): Promise<ReadonlyArray<CidadeEmDestaque>> {
    const limit = Math.max(1, Math.min(20, options.limit ?? 10));

    const grupos = await db.acompanhanteProfile.groupBy({
        by: ["estadoSigla", "cidadeNome"],
        where: baseWhereVisivel,
        _count: { _all: true },
        orderBy: { _count: { userId: "desc" } },
        take: limit,
    });

    if (grupos.length === 0) return [];

    // Pra cada cidade, busca a foto do perfil mais recentemente
    // atualizado. Faz N queries pequenas — N ≤ 10, OK.
    const enriched = await Promise.all(
        grupos.map(async (g) => {
            const top = await db.acompanhanteProfile.findFirst({
                where: {
                    ...baseWhereVisivel,
                    estadoSigla: g.estadoSigla,
                    cidadeNome: g.cidadeNome,
                },
                orderBy: { updatedAt: "desc" },
                select: {
                    fotoPerfil: { select: { storageKey: true } },
                },
            });
            return {
                cidadeNome: g.cidadeNome,
                estadoSigla: g.estadoSigla,
                count: g._count._all,
                photoUrl: top?.fotoPerfil
                    ? `/api/storage/${top.fotoPerfil.storageKey}`
                    : null,
            };
        }),
    );

    return enriched;
}
