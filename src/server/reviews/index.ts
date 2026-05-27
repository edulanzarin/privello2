/**
 * Sistema de Avaliações da Acompanhante (apenas texto).
 *
 * Cada `Cliente` autenticado pode deixar **uma** avaliação por
 * `Acompanhante`. O par `(targetUserId, authorUserId)` é único
 * (constraint do banco). Reedição = UPSERT — sobrescreve a linha
 * existente e o trigger `trg_reviews_agregado` reconstrói o
 * agregado `reviews_count` em `acompanhante_profiles`.
 *
 * # Sem nota numérica
 *
 * O produto removeu a nota (estrelas) por opção de UX — nota
 * gera incentivo errado e disputa de média. Mantemos apenas o
 * comentário escrito (obrigatório, 1..2000 chars). Quem precisa
 * de "rank" entre Acompanhantes usa Boost ou ordenação por
 * popularidade (visualizações/curtidas).
 *
 * Visibilidade: avaliações são exibidas em
 * `/acompanhantes/[slug]` para Cliente Fan e Acompanhante.
 * Cliente Grátis e anônimo veem placeholder bloqueado.
 */

import { db } from "@/lib/db";

/**
 * Forma de uma avaliação retornada para a UI pública.
 */
export interface ReviewPublico {
    id: string;
    comment: string;
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
 */
export type UpsertReviewResult =
    | { ok: true; reviewId: string }
    | { ok: false; reason: "AUTO_AVALIACAO" }
    | { ok: false; reason: "TARGET_NAO_E_ACOMPANHANTE" }
    | { ok: false; reason: "COMENTARIO_INVALIDO" };

export interface UpsertReviewInput {
    targetUserId: string;
    authorUserId: string;
    comment: string;
}

/**
 * Cria ou atualiza uma avaliação. Idempotente por
 * `(targetUserId, authorUserId)`.
 *
 * Não retorna o agregado atualizado — o trigger SQL recalcula
 * `reviewsCount` antes do commit; quem precisar do valor novo lê
 * o perfil de novo.
 */
export async function upsertReview(
    input: UpsertReviewInput,
): Promise<UpsertReviewResult> {
    if (input.authorUserId === input.targetUserId) {
        return { ok: false, reason: "AUTO_AVALIACAO" };
    }
    const trimmed = input.comment.trim();
    if (trimmed.length === 0 || trimmed.length > 2000) {
        return { ok: false, reason: "COMENTARIO_INVALIDO" };
    }

    // Confirma que o target é uma Acompanhante.
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
            comment: trimmed,
        },
        create: {
            targetUserId: input.targetUserId,
            authorUserId: input.authorUserId,
            comment: trimmed,
        },
        select: { id: true },
    });

    return { ok: true, reviewId: review.id };
}

/**
 * Lista as avaliações públicas mais recentes de uma Acompanhante.
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
 * público pra pré-popular o textarea quando o Cliente já avaliou.
 */
export async function obterMinhaReview(
    targetUserId: string,
    authorUserId: string,
): Promise<{ comment: string } | null> {
    const row = await db.acompanhanteReview.findUnique({
        where: {
            targetUserId_authorUserId: {
                targetUserId,
                authorUserId,
            },
        },
        select: { comment: true },
    });
    return row;
}


/**
 * Forma de uma avaliação escrita por um Cliente, com info do alvo
 * (Acompanhante) renderizada para o feed de atividade.
 */
export interface ReviewDoCliente {
    id: string;
    comment: string;
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
