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
