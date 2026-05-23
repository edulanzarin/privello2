/**
 * Sistema de Avaliações da Acompanhante.
 *
 * Cada `Cliente` autenticado pode deixar **uma** avaliação por
 * `Acompanhante`. O par `(targetUserId, authorUserId)` é único
 * (constraint do banco). Reedição = UPSERT — sobrescreve a linha
 * existente e o trigger `trg_reviews_agregado` reconstrói os
 * agregados de `acompanhante_profiles`.
 *
 * Visibilidade: avaliações são **públicas**. Aparecem em
 * `/acompanhantes/[slug]` para qualquer visitante. Apenas o
 * conteúdo opcional (`comment`) é livre — `rating` é restrito a
 * 1..5 pelo CHECK constraint.
 *
 * Anti-spam:
 * - Só Cliente autenticado pode avaliar (Acompanhante e anônimos
 *   são bloqueados na route handler).
 * - Auto-avaliação é proibida (Cliente avaliando o próprio @ não
 *   faz sentido, mas defensivamente checamos).
 * - 1 review por par de usuários — força revisão em vez de spam.
 */

import { db } from "@/lib/db";

/**
 * Forma de uma avaliação retornada para a UI pública.
 */
export interface ReviewPublico {
    id: string;
    rating: number;
    comment: string | null;
    createdAt: Date;
    /**
     * Autor — exibido como "@identificador" + nome. Sem PII além do
     * que já é público no perfil do Cliente.
     */
    authorIdentificador: string;
    authorNome: string;
    authorFotoUrl: string | null;
}

/**
 * Resultado de {@link upsertReview}.
 *
 * - `OK`: avaliação criada/atualizada com sucesso.
 * - `AUTO_AVALIACAO`: Cliente tentou avaliar o próprio @ — bloqueado.
 * - `TARGET_NAO_E_ACOMPANHANTE`: o `targetUserId` não corresponde a
 *   uma Acompanhante.
 * - `RATING_INVALIDO`: rating fora do range 1..5 (defesa em
 *   profundidade — a route já valida).
 */
export type UpsertReviewResult =
    | { ok: true; reviewId: string }
    | { ok: false; reason: "AUTO_AVALIACAO" }
    | { ok: false; reason: "TARGET_NAO_E_ACOMPANHANTE" }
    | { ok: false; reason: "RATING_INVALIDO" };

export interface UpsertReviewInput {
    targetUserId: string;
    authorUserId: string;
    rating: number;
    comment: string | null;
}

/**
 * Cria ou atualiza uma avaliação. Idempotente por
 * `(targetUserId, authorUserId)`.
 *
 * Não retorna o agregado atualizado — o trigger SQL recalcula
 * `reviewsCount`/`reviewsAverage` antes do commit; quem precisar do
 * valor novo lê o perfil de novo.
 */
export async function upsertReview(
    input: UpsertReviewInput,
): Promise<UpsertReviewResult> {
    if (input.authorUserId === input.targetUserId) {
        return { ok: false, reason: "AUTO_AVALIACAO" };
    }
    if (
        !Number.isInteger(input.rating) ||
        input.rating < 1 ||
        input.rating > 5
    ) {
        return { ok: false, reason: "RATING_INVALIDO" };
    }

    // Confirma que o target é uma Acompanhante. Cliente não recebe
    // review.
    const target = await db.user.findUnique({
        where: { id: input.targetUserId },
        select: { type: true },
    });
    if (!target || target.type !== "ACOMPANHANTE") {
        return { ok: false, reason: "TARGET_NAO_E_ACOMPANHANTE" };
    }

    const review = await db.acompanhanteReview.upsert({
        where: {
            targetUserId_authorUserId: {
                targetUserId: input.targetUserId,
                authorUserId: input.authorUserId,
            },
        },
        update: {
            rating: input.rating,
            comment: input.comment,
        },
        create: {
            targetUserId: input.targetUserId,
            authorUserId: input.authorUserId,
            rating: input.rating,
            comment: input.comment,
        },
        select: { id: true },
    });

    return { ok: true, reviewId: review.id };
}

/**
 * Lista as avaliações públicas mais recentes de uma Acompanhante.
 * Limita por padrão a 50 registros — o front exibe os primeiros via
 * `Paginator`. Quando precisarmos de mais, paginação cursor-based
 * pode ser adicionada.
 */
export async function listarReviewsPublicos(
    targetUserId: string,
    options: { limit?: number } = {},
): Promise<ReadonlyArray<ReviewPublico>> {
    const limit = Math.max(1, Math.min(100, options.limit ?? 50));

    const rows = await db.acompanhanteReview.findMany({
        where: { targetUserId },
        orderBy: { createdAt: "desc" },
        take: limit,
        select: {
            id: true,
            rating: true,
            comment: true,
            createdAt: true,
            author: {
                select: {
                    nome: true,
                    identificador: true,
                    type: true,
                    client: {
                        select: {
                            fotoPerfil: { select: { storageKey: true } },
                        },
                    },
                },
            },
        },
    });

    return rows.map((row) => ({
        id: row.id,
        rating: row.rating,
        comment: row.comment,
        createdAt: row.createdAt,
        authorNome: row.author.nome,
        authorIdentificador: row.author.identificador,
        authorFotoUrl:
            row.author.client?.fotoPerfil
                ? `/api/storage/${row.author.client.fotoPerfil.storageKey}`
                : null,
    }));
}

/**
 * Lê a avaliação que o Cliente autenticado deixou (se houver) na
 * Acompanhante apontada por `targetUserId`. Retorna `null` quando
 * não há avaliação. Usado pelo formulário "Sua avaliação" no perfil
 * público pra pré-popular os campos quando o Cliente já avaliou.
 */
export async function obterMinhaReview(
    targetUserId: string,
    authorUserId: string,
): Promise<{ rating: number; comment: string | null } | null> {
    const row = await db.acompanhanteReview.findUnique({
        where: {
            targetUserId_authorUserId: {
                targetUserId,
                authorUserId,
            },
        },
        select: { rating: true, comment: true },
    });
    return row;
}


/**
 * Forma de uma avaliação escrita por um Cliente, com info do alvo
 * (Acompanhante) renderizada para o feed de atividade.
 */
export interface ReviewDoCliente {
    id: string;
    rating: number;
    comment: string | null;
    createdAt: Date;
    /** Acompanhante avaliada (Conhecida pelo `@`). */
    targetIdentificador: string;
    targetNome: string;
    targetFotoUrl: string | null;
}

/**
 * Lista as avaliações que um Cliente publicou, ordenadas das mais
 * recentes para as mais antigas. Usado pela aba "Atividade" do
 * painel do Cliente.
 *
 * Filtra Acompanhantes que ainda têm plano vigente — quando uma
 * Acompanhante cancela ou desativa, suas avaliações somem do
 * histórico do Cliente automaticamente (Caminho A: filtrar no read).
 */
export async function listarReviewsDoCliente(
    authorUserId: string,
    options: { limit?: number } = {},
): Promise<ReadonlyArray<ReviewDoCliente>> {
    const limit = Math.max(1, Math.min(200, options.limit ?? 100));

    const rows = await db.acompanhanteReview.findMany({
        where: {
            authorUserId,
            target: {
                acompanhante: {
                    planoVigente: { not: null },
                },
            },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        select: {
            id: true,
            rating: true,
            comment: true,
            createdAt: true,
            target: {
                select: {
                    nome: true,
                    identificador: true,
                    acompanhante: {
                        select: {
                            fotoPerfil: { select: { storageKey: true } },
                        },
                    },
                },
            },
        },
    });

    return rows.map((row) => ({
        id: row.id,
        rating: row.rating,
        comment: row.comment,
        createdAt: row.createdAt,
        targetNome: row.target.nome,
        targetIdentificador: row.target.identificador,
        targetFotoUrl:
            row.target.acompanhante?.fotoPerfil
                ? `/api/storage/${row.target.acompanhante.fotoPerfil.storageKey}`
                : null,
    }));
}

/**
 * Conta quantas avaliações um Cliente publicou (filtrando target
 * com plano vigente). Usado nos contadores do painel.
 */
export async function contarReviewsDoCliente(
    authorUserId: string,
): Promise<number> {
    return db.acompanhanteReview.count({
        where: {
            authorUserId,
            target: {
                acompanhante: {
                    planoVigente: { not: null },
                },
            },
        },
    });
}
