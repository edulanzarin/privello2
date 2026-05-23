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
    /** Selo discriminado. Mesmo formato usado pelo perfil público. */
    planoExibicao: PlanoExibicao;
    /** Total de visualizações públicas. */
    viewsCount: number;
    /** Total de avaliações. */
    reviewsCount: number;
    /** Média das avaliações (0..5). */
    reviewsAverage: number;
    /** Valor da hora em centavos, ou `null` quando "a combinar". */
    valorHoraCents: number | null;
    /** `true` quando há áudio publicado e disponível. */
    temAudio: boolean;
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
    audioApresentacao: { select: { status: true } },
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
 */
export async function listarFeedHome(
    options: ListarFeedHomeOptions = {},
): Promise<FeedHome> {
    const now = options.now ?? new Date();
    const limites = {
        boost: options.limite?.boost ?? 12,
        alta: options.limite?.alta ?? 12,
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

    return {
        boost: boostRows.map((r) => toItem(r, now)),
        alta: altaRows.map((r) => toItem(r, now)),
    };
}

function toItem(row: Row, now: Date): FeedItem {
    const planoExibicao: PlanoExibicao = isBoostAtivo(row.boostUntil, now)
        ? "BOOST"
        : row.planoVigente === "PREMIUM"
            ? "PREMIUM"
            : "BASICO";

    const temAudio =
        row.audioApresentacao !== null &&
        row.audioApresentacao.status === "COMMITTED";

    return {
        identificador: row.user.identificador,
        nome: row.user.nome,
        fotoUrl: row.fotoPerfil
            ? `/api/storage/${row.fotoPerfil.storageKey}`
            : null,
        estadoSigla: row.estadoSigla,
        cidadeNome: row.cidadeNome,
        bairroNome: row.bairroNome,
        planoExibicao,
        viewsCount: row.viewsCount,
        reviewsCount: row.reviewsCount,
        reviewsAverage: Number(row.reviewsAverage),
        valorHoraCents: row.valorHoraCents,
        temAudio,
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

    const [perfisAtivos, cidadesAgg, boostsAtivos, avaliacoes] =
        await Promise.all([
            db.acompanhanteProfile.count({ where: baseWhereVisivel }),
            db.acompanhanteProfile.findMany({
                where: baseWhereVisivel,
                distinct: ["estadoSigla", "cidadeNome"],
                select: { estadoSigla: true, cidadeNome: true },
            }),
            db.acompanhanteProfile.count({
                where: { ...baseWhereVisivel, boostUntil: { gt: now } },
            }),
            db.acompanhanteReview.count(),
        ]);

    return {
        perfisAtivos,
        cidades: cidadesAgg.length,
        boostsAtivos,
        avaliacoes,
    };
}
