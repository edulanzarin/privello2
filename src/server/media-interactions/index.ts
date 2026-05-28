/**
 * Sistema de interações com mídias — curtidas e comentários.
 *
 * Curtidas:
 *   - 1 por par `(media, user)` via PRIMARY KEY composta.
 *   - Toggle via `toggleLike`: se existe, remove; se não, cria.
 *   - Agregado `media.likesCount` atualizado por trigger SQL.
 *
 * Comentários:
 *   - N por par `(media, user)` — Cliente Fan pode comentar várias
 *     vezes na mesma mídia.
 *   - Texto entre 1 e 2000 caracteres (CHECK constraint no banco).
 *   - Autor pode excluir os próprios via `removerComentario`.
 *   - Agregado `media.commentsCount` atualizado por trigger SQL.
 *
 * Regras de plano:
 *   - Apenas Cliente plano FAN pode curtir/comentar. Os route
 *     handlers fazem a checagem; este módulo confia que o caller
 *     já filtrou.
 *
 * Visibilidade:
 *   - As listas só retornam interações de Acompanhantes com plano
 *     vigente — quando uma Acompanhante cancela, suas mídias somem
 *     dos histories do Cliente automaticamente (Caminho A: filtrar
 *     no read).
 */

import { db } from "@/lib/db";

import { incrementarStatDiaria } from "@/server/acompanhante-profile/stats";

// ---------------------------------------------------------------------------
// Curtidas
// ---------------------------------------------------------------------------

/**
 * Resultado de {@link toggleLike}.
 *
 * - `liked: true`: a curtida foi criada (ou já existia).
 * - `liked: false`: a curtida foi removida (ou nunca existiu).
 */
export type ToggleLikeResult = { liked: boolean; likesCount: number };

/**
 * Liga/desliga a curtida do `userId` na `mediaId`. Idempotente:
 * passar `desired = true` quando já curtido não duplica; passar
 * `false` quando não curtido não erra.
 *
 * Retorna o estado final (`liked`) e o contador atualizado lido
 * direto do banco depois da trigger ter rodado.
 */
export async function toggleLike(
    mediaId: string,
    userId: string,
    desired: boolean,
): Promise<ToggleLikeResult> {
    // Rastreamos se a mutação realmente alterou o banco. Sem isso,
    // chamadas idempotentes (ex.: descurtir o que já não estava
    // curtido) decrementariam o stat diário pra negativo.
    let mutated = false;
    if (desired) {
        // Idempotente: ignora P2002 (UNIQUE violation) — significa que
        // já estava curtido.
        try {
            await db.mediaLike.create({
                data: { mediaId, userId },
                select: { mediaId: true },
            });
            mutated = true;
        } catch (err) {
            const code = (err as { code?: string }).code;
            if (code !== "P2002") throw err;
            // Idempotente — ainda assim retornamos `liked: true`
            // logo abaixo, mas sem mexer no stat diário.
        }
    } else {
        try {
            await db.mediaLike.delete({
                where: { mediaId_userId: { mediaId, userId } },
            });
            mutated = true;
        } catch (err) {
            const code = (err as { code?: string }).code;
            if (code !== "P2025") throw err;
        }
    }

    const media = await db.media.findUnique({
        where: { id: mediaId },
        select: { likesCount: true, ownerId: true },
    });

    // Incrementa série diária do dono da mídia (Acompanhante).
    // Só dispara quando a mutação realmente alterou o estado —
    // chamadas idempotentes não acumulam delta.
    if (
        mutated &&
        media?.ownerId !== undefined &&
        media.ownerId !== userId
    ) {
        await incrementarStatDiaria({
            userId: media.ownerId,
            field: "likes",
            delta: desired ? 1 : -1,
        }).catch(() => undefined);
    }

    return {
        liked: desired,
        likesCount: media?.likesCount ?? 0,
    };
}

/**
 * Lê em massa o estado "curtido por este viewer" para uma lista
 * de `mediaIds`. Retorna o `Set` dos ids que o `viewerUserId`
 * curtiu — usar `set.has(id)` no caller.
 *
 * Quando `viewerUserId` é `null` (anônimo), retorna `Set` vazio.
 */
export async function obterLikesDoViewer(
    mediaIds: ReadonlyArray<string>,
    viewerUserId: string | null,
): Promise<ReadonlySet<string>> {
    if (viewerUserId === null || mediaIds.length === 0) {
        return new Set();
    }
    const rows = await db.mediaLike.findMany({
        where: {
            userId: viewerUserId,
            mediaId: { in: [...mediaIds] },
        },
        select: { mediaId: true },
    });
    return new Set(rows.map((r) => r.mediaId));
}

// ---------------------------------------------------------------------------
// Comentários
// ---------------------------------------------------------------------------

/**
 * Forma de um comentário público pra UI.
 */
export interface CommentPublico {
    id: string;
    text: string;
    createdAt: Date;
    /** Pode editar/excluir se este comentário pertence ao viewer. */
    isMine: boolean;
    authorNome: string;
    authorIdentificador: string;
    authorFotoUrl: string | null;
}

/**
 * Resultado de {@link adicionarComentario}.
 */
export type AdicionarComentarioResult =
    | { ok: true; commentId: string; commentsCount: number }
    | { ok: false; reason: "TEXTO_INVALIDO" }
    | { ok: false; reason: "MEDIA_NAO_ENCONTRADA" };

/**
 * Cria um comentário do `authorUserId` na `mediaId`. Texto é
 * trimado e validado (1..2000 chars).
 */
export async function adicionarComentario(input: {
    mediaId: string;
    authorUserId: string;
    text: string;
}): Promise<AdicionarComentarioResult> {
    const text = input.text.trim();
    if (text.length === 0 || text.length > 2000) {
        return { ok: false, reason: "TEXTO_INVALIDO" };
    }

    // Confirma que a mídia existe (defesa em profundidade — a UI já
    // checa antes de mostrar o input).
    const media = await db.media.findUnique({
        where: { id: input.mediaId },
        select: { id: true },
    });
    if (!media) {
        return { ok: false, reason: "MEDIA_NAO_ENCONTRADA" };
    }

    const created = await db.mediaComment.create({
        data: {
            mediaId: input.mediaId,
            authorUserId: input.authorUserId,
            text,
        },
        select: { id: true },
    });

    const updated = await db.media.findUnique({
        where: { id: input.mediaId },
        select: { commentsCount: true },
    });

    return {
        ok: true,
        commentId: created.id,
        commentsCount: updated?.commentsCount ?? 0,
    };
}

/**
 * Resultado de {@link removerComentario}.
 */
export type RemoverComentarioResult =
    | { ok: true; commentsCount: number }
    | { ok: false; reason: "NAO_ENCONTRADO" }
    | { ok: false; reason: "NAO_E_AUTOR" };

/**
 * Remove um comentário próprio. Apenas o autor pode excluir.
 */
export async function removerComentario(
    commentId: string,
    authorUserId: string,
): Promise<RemoverComentarioResult> {
    const comment = await db.mediaComment.findUnique({
        where: { id: commentId },
        select: { authorUserId: true, mediaId: true },
    });
    if (!comment) {
        return { ok: false, reason: "NAO_ENCONTRADO" };
    }
    if (comment.authorUserId !== authorUserId) {
        return { ok: false, reason: "NAO_E_AUTOR" };
    }

    await db.mediaComment.delete({
        where: { id: commentId },
        select: { id: true },
    });

    const updated = await db.media.findUnique({
        where: { id: comment.mediaId },
        select: { commentsCount: true },
    });

    return {
        ok: true,
        commentsCount: updated?.commentsCount ?? 0,
    };
}

/**
 * Lista os comentários de uma mídia, mais recentes primeiro.
 * Marca `isMine: true` quando o `viewerUserId` for autor do
 * comentário (caller usa pra mostrar botão de excluir).
 */
export async function listarComentarios(
    mediaId: string,
    viewerUserId: string | null,
    options: { limit?: number } = {},
): Promise<ReadonlyArray<CommentPublico>> {
    const limit = Math.max(1, Math.min(200, options.limit ?? 50));
    const rows = await db.mediaComment.findMany({
        where: { mediaId },
        orderBy: { createdAt: "desc" },
        take: limit,
        select: {
            id: true,
            text: true,
            createdAt: true,
            authorUserId: true,
            author: {
                select: {
                    nome: true,
                    identificador: true,
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
        text: row.text,
        createdAt: row.createdAt,
        isMine: row.authorUserId === viewerUserId,
        authorNome: row.author.nome,
        authorIdentificador: row.author.identificador,
        authorFotoUrl:
            row.author.client?.fotoPerfil
                ? `/api/storage/${row.author.client.fotoPerfil.storageKey}`
                : null,
    }));
}

/**
 * Lista os comentários publicados pelo `authorUserId` (Cliente),
 * mais recentes primeiro. Filtra mídias cujo dono ainda tem plano
 * vigente — Acompanhantes que cancelaram somem do histórico do
 * Cliente.
 *
 * Usado pela aba Atividade do painel do Cliente.
 */
export interface CommentDoCliente {
    id: string;
    text: string;
    createdAt: Date;
    /** Slug do dono da mídia (Acompanhante). Pra link no feed. */
    targetIdentificador: string;
    targetNome: string;
    mediaId: string;
}

export async function listarComentariosDoCliente(
    authorUserId: string,
    options: { limit?: number } = {},
): Promise<ReadonlyArray<CommentDoCliente>> {
    const limit = Math.max(1, Math.min(200, options.limit ?? 100));
    const rows = await db.mediaComment.findMany({
        where: {
            authorUserId,
            media: {
                owner: {
                    acompanhante: {
                        planoVigente: { not: null },
                    },
                },
            },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        select: {
            id: true,
            text: true,
            createdAt: true,
            mediaId: true,
            media: {
                select: {
                    owner: {
                        select: {
                            nome: true,
                            identificador: true,
                        },
                    },
                },
            },
        },
    });

    return rows.map((row) => ({
        id: row.id,
        text: row.text,
        createdAt: row.createdAt,
        mediaId: row.mediaId,
        targetNome: row.media.owner.nome,
        targetIdentificador: row.media.owner.identificador,
    }));
}

/**
 * Lista as curtidas dadas pelo Cliente (mídias curtidas), filtrando
 * Acompanhantes com plano vigente.
 */
export interface LikeDoCliente {
    mediaId: string;
    createdAt: Date;
    targetIdentificador: string;
    targetNome: string;
    mediaUrl: string;
    mediaKind: "PHOTO" | "VIDEO";
}

export async function listarLikesDoCliente(
    userId: string,
    options: { limit?: number } = {},
): Promise<ReadonlyArray<LikeDoCliente>> {
    const limit = Math.max(1, Math.min(200, options.limit ?? 100));
    const rows = await db.mediaLike.findMany({
        where: {
            userId,
            media: {
                owner: {
                    acompanhante: {
                        planoVigente: { not: null },
                    },
                },
            },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        select: {
            mediaId: true,
            createdAt: true,
            media: {
                select: {
                    storageKey: true,
                    kind: true,
                    owner: {
                        select: {
                            nome: true,
                            identificador: true,
                        },
                    },
                },
            },
        },
    });

    return rows.map((row) => ({
        mediaId: row.mediaId,
        createdAt: row.createdAt,
        targetNome: row.media.owner.nome,
        targetIdentificador: row.media.owner.identificador,
        mediaUrl: `/api/storage/${row.media.storageKey}`,
        mediaKind: row.media.kind === "VIDEO" ? "VIDEO" : "PHOTO",
    }));
}

/**
 * Conta agregadas usadas no header do painel do Cliente.
 */
export async function contarInteracoesDoCliente(userId: string): Promise<{
    likes: number;
    comentarios: number;
}> {
    const [likes, comentarios] = await Promise.all([
        db.mediaLike.count({
            where: {
                userId,
                media: {
                    owner: {
                        acompanhante: {
                            planoVigente: { not: null },
                        },
                    },
                },
            },
        }),
        db.mediaComment.count({
            where: {
                authorUserId: userId,
                media: {
                    owner: {
                        acompanhante: {
                            planoVigente: { not: null },
                        },
                    },
                },
            },
        }),
    ]);
    return { likes, comentarios };
}
