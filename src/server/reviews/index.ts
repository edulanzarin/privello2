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
import { criarNotificacao } from "@/server/notifications";

/**
 * Forma de uma avaliação retornada para a UI pública.
 */
export interface ReviewPublico {
    id: string;
    comment: string;
    rating: number | null;
    /** Resposta da Acompanhante (se houver). */
    replyText: string | null;
    repliedAt: Date | null;
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
    | { ok: false; reason: "COMENTARIO_INVALIDO" }
    | { ok: false; reason: "RATING_INVALIDO" };

export interface UpsertReviewInput {
    targetUserId: string;
    authorUserId: string;
    comment: string;
    /** Nota 1-5, opcional. */
    rating?: number | null;
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

    // Rating opcional. Quando vem, exige int 1..5.
    let ratingNorm: number | null = null;
    if (input.rating !== null && input.rating !== undefined) {
        const r = Math.floor(Number(input.rating));
        if (!Number.isFinite(r) || r < 1 || r > 5) {
            return { ok: false, reason: "RATING_INVALIDO" };
        }
        ratingNorm = r;
    }

    // Confirma que o target é uma Acompanhante.
    const target = await db.user.findUnique({
        where: { id: input.targetUserId },
        select: { type: true },
    });
    if (!target || target.type !== "ACOMPANHANTE") {
        return { ok: false, reason: "TARGET_NAO_E_ACOMPANHANTE" };
    }

    // Detecta se é avaliação nova (vs. edição) pra só notificar a
    // Acompanhante na primeira vez — editar não gera aviso novo.
    const jaExistia = await db.acompanhanteReview.findUnique({
        where: {
            targetUserId_authorUserId: {
                targetUserId: input.targetUserId,
                authorUserId: input.authorUserId,
            },
        },
        select: { authorUserId: true },
    });

    const review = await db.acompanhanteReview.upsert({
        where: {
            targetUserId_authorUserId: {
                targetUserId: input.targetUserId,
                authorUserId: input.authorUserId,
            },
        },
        update: {
            comment: trimmed,
            rating: ratingNorm,
        },
        create: {
            targetUserId: input.targetUserId,
            authorUserId: input.authorUserId,
            comment: trimmed,
            rating: ratingNorm,
        },
        select: { id: true },
    });

    // Notifica a Acompanhante só quando a avaliação é nova (V2).
    // Best-effort — falha aqui não invalida a avaliação.
    if (!jaExistia) {
        const autor = await db.user.findUnique({
            where: { id: input.authorUserId },
            select: { nome: true, identificador: true },
        });
        if (autor) {
            await criarNotificacao({
                userId: input.targetUserId,
                type: "NOVA_AVALIACAO",
                payload: {
                    autorNome: autor.nome,
                    autorIdentificador: autor.identificador,
                },
            });
        }
    }

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
            rating: true,
            replyText: true,
            repliedAt: true,
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
        rating: row.rating,
        replyText: row.replyText,
        repliedAt: row.repliedAt,
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
): Promise<{ comment: string; rating: number | null } | null> {
    const row = await db.acompanhanteReview.findUnique({
        where: {
            targetUserId_authorUserId: {
                targetUserId,
                authorUserId,
            },
        },
        select: { comment: true, rating: true },
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

// ---------------------------------------------------------------------------
// Resposta da Acompanhante
// ---------------------------------------------------------------------------

/**
 * Resultado de {@link responderReview}.
 */
export type ResponderReviewResult =
    | { ok: true }
    | { ok: false; reason: "NAO_ENCONTRADA" | "NAO_E_DONA" | "TEXTO_INVALIDO" };

/**
 * Acompanhante responde a uma avaliação recebida. Quando já tem
 * resposta, sobrescreve (mas mantém o `repliedAt` original — só
 * a primeira resposta marca a data).
 *
 * Apenas a Acompanhante avaliada (`targetUserId`) pode responder.
 * Outros recebem `NAO_E_DONA`.
 */
export async function responderReview(input: {
    reviewId: string;
    acompanhanteUserId: string;
    text: string;
}): Promise<ResponderReviewResult> {
    const trimmed = input.text.trim();
    if (trimmed.length === 0 || trimmed.length > 2000) {
        return { ok: false, reason: "TEXTO_INVALIDO" };
    }

    const review = await db.acompanhanteReview.findUnique({
        where: { id: input.reviewId },
        select: { targetUserId: true, repliedAt: true },
    });
    if (!review) {
        return { ok: false, reason: "NAO_ENCONTRADA" };
    }
    if (review.targetUserId !== input.acompanhanteUserId) {
        return { ok: false, reason: "NAO_E_DONA" };
    }

    await db.acompanhanteReview.update({
        where: { id: input.reviewId },
        data: {
            replyText: trimmed,
            // Marca repliedAt só na primeira resposta.
            repliedAt: review.repliedAt ?? new Date(),
        },
        select: { id: true },
    });

    return { ok: true };
}

/**
 * Remove a resposta da Acompanhante (volta a `null`). Usado quando
 * ela quer apagar o que respondeu.
 */
export async function removerRespostaReview(input: {
    reviewId: string;
    acompanhanteUserId: string;
}): Promise<ResponderReviewResult> {
    const review = await db.acompanhanteReview.findUnique({
        where: { id: input.reviewId },
        select: { targetUserId: true },
    });
    if (!review) {
        return { ok: false, reason: "NAO_ENCONTRADA" };
    }
    if (review.targetUserId !== input.acompanhanteUserId) {
        return { ok: false, reason: "NAO_E_DONA" };
    }

    await db.acompanhanteReview.update({
        where: { id: input.reviewId },
        data: { replyText: null, repliedAt: null },
        select: { id: true },
    });
    return { ok: true };
}

// ---------------------------------------------------------------------------
// Nota geral (distribuição + média)
// ---------------------------------------------------------------------------

/**
 * Resumo da nota geral de uma Acompanhante. Mostrado no perfil
 * público dentro de gate Fan ("Ver nota geral").
 */
export interface NotaGeralResumo {
    /** Total de avaliações que deram nota (descarta nulls). */
    totalComNota: number;
    /** Média ponderada (0..5). `null` quando não há nota. */
    media: number | null;
    /**
     * Distribuição de notas — mapa `{ 1: 2, 2: 0, 3: 1, ... }`.
     * Sempre tem as 5 chaves, mesmo zeradas, pra UI desenhar
     * barras consistentes.
     */
    distribuicao: { 1: number; 2: number; 3: number; 4: number; 5: number };
}

/**
 * Calcula nota geral agregada das avaliações de uma Acompanhante.
 *
 * Faz uma única query `groupBy` por rating — barato no índice
 * existente. Avaliações sem nota (rating null) são ignoradas.
 */
export async function obterNotaGeral(
    targetUserId: string,
): Promise<NotaGeralResumo> {
    const rows = await db.acompanhanteReview.groupBy({
        by: ["rating"],
        where: { targetUserId, rating: { not: null } },
        _count: { _all: true },
    });

    const dist: NotaGeralResumo["distribuicao"] = {
        1: 0,
        2: 0,
        3: 0,
        4: 0,
        5: 0,
    };
    let total = 0;
    let soma = 0;

    for (const row of rows) {
        if (row.rating === null) continue;
        const r = row.rating as 1 | 2 | 3 | 4 | 5;
        if (r >= 1 && r <= 5) {
            dist[r] = row._count._all;
            total += row._count._all;
            soma += r * row._count._all;
        }
    }

    return {
        totalComNota: total,
        media: total > 0 ? soma / total : null,
        distribuicao: dist,
    };
}
