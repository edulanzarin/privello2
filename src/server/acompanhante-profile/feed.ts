import type { Prisma } from "@prisma/client";

import { isBoostAtivo } from "@/domain/boost/definitions";
import { db } from "@/lib/db";

import type { PlanoExibicao } from "./index";

/**
 * Resumo público de uma Acompanhante para listagens de descoberta
 * (home, busca, etc.).
 *
 * Subset enxuto do {@link PerfilAcompanhantePublico} pra reduzir
 * payload em listagens de muitos itens. Mantém só o que o
 * {@link import("@/components").ProfileFeedCard} precisa pra
 * renderizar.
 *
 * Sem PII (sem email/telefone/userId).
 */
export interface FeedItem {
    /** `User.identificador` (slug). Usado pro link do card. */
    identificador: string;
    /** Nome de exibição. */
    nome: string;
    /** URL da foto de perfil ou `null` quando ausente. */
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
}

/**
 * Buckets discriminados retornados pelo {@link listarFeedHome}.
 *
 * Cada bucket é uma fileira independente na home:
 *
 * - `boost` — Acompanhantes com `boostUntil > now()`. Carrossel
 *   horizontal "em destaque agora".
 * - `premium` — plano `PREMIUM` sem boost. Grid principal.
 * - `basico` — plano `BASICO` sem boost. Grid de "novidades".
 *
 * Itens já vêm sem duplicação entre buckets — uma Acompanhante com
 * boost só aparece no bucket `boost`.
 */
export interface FeedHome {
    boost: ReadonlyArray<FeedItem>;
    premium: ReadonlyArray<FeedItem>;
    basico: ReadonlyArray<FeedItem>;
}

export interface ListarFeedHomeOptions {
    /** Limite de itens em cada bucket. Padrão por bucket: 12. */
    limite?: {
        boost?: number;
        premium?: number;
        basico?: number;
    };
    /**
     * Filtros opcionais. Quando `cidadeNome` é informada (com
     * `estadoSigla`), todos os buckets são filtrados pra essa
     * cidade. Sem filtro lista nacional.
     */
    filtros?: {
        estadoSigla?: string;
        cidadeNome?: string;
    };
    /**
     * Data de referência. Usada pra filtrar boost ativo.
     * Default: `new Date()`.
     */
    now?: Date;
}

/**
 * Lê o feed público da home em três buckets discriminados.
 *
 * Critérios comuns aos três buckets:
 *
 * - `User.type === "ACOMPANHANTE"`.
 * - `AcompanhanteProfile.perfilVisivel === true`.
 * - `AcompanhanteProfile.planoVigente !== null`.
 *
 * Ordenação:
 *
 * - `boost`: por `boostUntil` desc (quem tem boost mais recente
 *   no topo).
 * - `premium`/`basico`: por `viewsCount` desc + `updatedAt` desc
 *   (perfis mais relevantes primeiro, com tie-break pra recência).
 *
 * Sem mídia raw — apenas `storageKey` da `fotoPerfil` é convertido
 * em `/api/storage/<key>`.
 */
export async function listarFeedHome(
    options: ListarFeedHomeOptions = {},
): Promise<FeedHome> {
    const now = options.now ?? new Date();
    const limites = {
        boost: options.limite?.boost ?? 12,
        premium: options.limite?.premium ?? 12,
        basico: options.limite?.basico ?? 12,
    };

    const baseWhere: Prisma.AcompanhanteProfileWhereInput = {
        perfilVisivel: true,
        planoVigente: { not: null },
        user: { type: "ACOMPANHANTE" },
        ...(options.filtros?.estadoSigla
            ? { estadoSigla: options.filtros.estadoSigla }
            : {}),
        ...(options.filtros?.cidadeNome
            ? { cidadeNome: options.filtros.cidadeNome }
            : {}),
    };

    const include = {
        user: { select: { nome: true, identificador: true } },
        fotoPerfil: { select: { storageKey: true } },
    } satisfies Prisma.AcompanhanteProfileInclude;

    type Row = Prisma.AcompanhanteProfileGetPayload<{
        include: typeof include;
    }>;

    // Boost ativo
    const boostRows = await db.acompanhanteProfile.findMany({
        where: {
            ...baseWhere,
            boostUntil: { gt: now },
        },
        orderBy: [{ boostUntil: "desc" }],
        take: limites.boost,
        include,
    });

    // Premium sem boost
    const premiumRows = await db.acompanhanteProfile.findMany({
        where: {
            ...baseWhere,
            planoVigente: "PREMIUM",
            OR: [{ boostUntil: null }, { boostUntil: { lte: now } }],
        },
        orderBy: [{ viewsCount: "desc" }, { updatedAt: "desc" }],
        take: limites.premium,
        include,
    });

    // Básico sem boost
    const basicoRows = await db.acompanhanteProfile.findMany({
        where: {
            ...baseWhere,
            planoVigente: "BASICO",
            OR: [{ boostUntil: null }, { boostUntil: { lte: now } }],
        },
        orderBy: [{ viewsCount: "desc" }, { updatedAt: "desc" }],
        take: limites.basico,
        include,
    });

    function toItem(row: Row): FeedItem {
        const planoExibicao: PlanoExibicao = isBoostAtivo(
            row.boostUntil,
            now,
        )
            ? "BOOST"
            : row.planoVigente === "PREMIUM"
                ? "PREMIUM"
                : "BASICO";

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
        };
    }

    return {
        boost: boostRows.map(toItem),
        premium: premiumRows.map(toItem),
        basico: basicoRows.map(toItem),
    };
}

/**
 * Resumo de cidade pra atalhos da home.
 */
export interface CidadePopular {
    estadoSigla: string;
    cidadeNome: string;
    /** Quantidade de Acompanhantes visíveis na cidade. */
    total: number;
}

/**
 * Lista as cidades mais populadas (em número de perfis visíveis com
 * plano vigente). Usada como atalho clicável na home — clicar leva
 * pra `/acompanhantes?cidade=...&uf=...`.
 *
 * @param limite Limite de cidades retornadas. Padrão: `8`.
 */
export async function listarCidadesPopulares(
    limite = 8,
): Promise<ReadonlyArray<CidadePopular>> {
    const grupos = await db.acompanhanteProfile.groupBy({
        by: ["estadoSigla", "cidadeNome"],
        where: {
            perfilVisivel: true,
            planoVigente: { not: null },
            user: { type: "ACOMPANHANTE" },
        },
        _count: { _all: true },
        orderBy: { _count: { userId: "desc" } },
        take: limite,
    });

    return grupos.map((g) => ({
        estadoSigla: g.estadoSigla,
        cidadeNome: g.cidadeNome,
        total: g._count._all,
    }));
}
