/**
 * Stories Highlights (Destaques permanentes).
 *
 * Acompanhante salva Stories arquivados em "Destaques" agrupados
 * por título. Estes destaques aparecem no perfil público em rail
 * circular permanente — diferente dos Stories ativos que somem em
 * 24h.
 *
 * # Modelagem
 *
 * Reusa `Media` (role=STORY, status=ARCHIVED) com 2 colunas extras:
 *
 *   - `highlightTitle` (string|null): nome do destaque (≤20 chars).
 *     `null` significa "não está em nenhum destaque".
 *   - `highlightOrder` (int|null): ordem dentro do mesmo destaque.
 *
 * Stories ainda ativos (status=COMMITTED, expiresAt > now) NÃO podem
 * ser tagueados — service rejeita. Quando um story expira e vira
 * ARCHIVED, fica disponível pra ser tagueado.
 *
 * # Privacidade
 *
 * O dono adiciona/remove livremente. Visitante público lê via
 * `listarHighlightsPublicos`. Toggle/edit não exige nada além de
 * ownership do story (validamos que `ownerId === caller`).
 */

import { db } from "@/lib/db";

// ---------------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------------

/** Limite de caracteres do título do destaque. */
export const HIGHLIGHT_TITLE_MAX = 20;

/**
 * Resumo de um destaque. Cada item agrupa N stories que compartilham
 * o mesmo `highlightTitle`. A capa é o story mais recente do grupo.
 */
export interface HighlightResumo {
    /** Título do destaque (chave de agrupamento). */
    title: string;
    /** Total de stories nesse destaque. */
    total: number;
    /** Story mais recente (cover). */
    coverStorageKey: string;
    /** `kind` da cover (pra mostrar play badge se VIDEO). */
    coverKind: "PHOTO" | "VIDEO";
    /** ID da media usada como cover (pra deep-link). */
    coverMediaId: string;
}

/** Story individual dentro de um destaque (consumido pelo viewer). */
export interface HighlightStory {
    id: string;
    kind: "PHOTO" | "VIDEO";
    storageKey: string;
    posterStorageKey: string | null;
    caption: string | null;
    createdAt: Date;
    likesCount: number;
}

// ---------------------------------------------------------------------------
// Validação do título
// ---------------------------------------------------------------------------

export function validarHighlightTitle(input: unknown): input is string {
    if (typeof input !== "string") return false;
    const trimmed = input.trim();
    if (trimmed.length === 0) return false;
    if (trimmed.length > HIGHLIGHT_TITLE_MAX) return false;
    return true;
}

// ---------------------------------------------------------------------------
// Escrita: adicionar / remover / renomear
// ---------------------------------------------------------------------------

export type AdicionarAoDestaqueResult =
    | { ok: true }
    | {
        ok: false;
        reason:
        | "TITULO_INVALIDO"
        | "STORY_INVALIDO"
        | "STORY_NAO_ARQUIVADO"
        | "PERSISTENCIA";
    };

/**
 * Adiciona um Story ARCHIVED ao destaque com `title`. Cria o grupo
 * automaticamente se ainda não existir. `highlightOrder` é setado
 * como `max(existente) + 1` pra colocar no final do grupo.
 *
 * Falha com `STORY_NAO_ARQUIVADO` se a media não está com
 * `status=ARCHIVED` (ou seja, ainda ativo ou já deletado).
 */
export async function adicionarAoDestaque(input: {
    userId: string;
    storyId: string;
    title: string;
}): Promise<AdicionarAoDestaqueResult> {
    if (!validarHighlightTitle(input.title)) {
        return { ok: false, reason: "TITULO_INVALIDO" };
    }
    const titleTrim = input.title.trim();

    const media = await db.media.findUnique({
        where: { id: input.storyId },
        select: {
            ownerId: true,
            role: true,
            status: true,
        },
    });
    if (!media || media.ownerId !== input.userId || media.role !== "STORY") {
        return { ok: false, reason: "STORY_INVALIDO" };
    }
    if (media.status !== "ARCHIVED") {
        return { ok: false, reason: "STORY_NAO_ARQUIVADO" };
    }

    // Calcula ordem: max existente + 1 (vai pro fim do grupo).
    const maxExistente = await db.media.aggregate({
        where: {
            ownerId: input.userId,
            role: "STORY",
            highlightTitle: titleTrim,
        },
        _max: { highlightOrder: true },
    });
    const proximaOrdem = (maxExistente._max.highlightOrder ?? -1) + 1;

    try {
        await db.media.update({
            where: { id: input.storyId },
            data: {
                highlightTitle: titleTrim,
                highlightOrder: proximaOrdem,
            },
        });
    } catch {
        return { ok: false, reason: "PERSISTENCIA" };
    }
    return { ok: true };
}

export type RemoverDoDestaqueResult =
    | { ok: true }
    | { ok: false; reason: "STORY_INVALIDO" | "PERSISTENCIA" };

/**
 * Remove um Story do destaque (zera `highlightTitle` e
 * `highlightOrder`). Se era o único do grupo, o grupo some
 * naturalmente — a query de listagem ignora `highlightTitle=null`.
 */
export async function removerDoDestaque(input: {
    userId: string;
    storyId: string;
}): Promise<RemoverDoDestaqueResult> {
    const media = await db.media.findUnique({
        where: { id: input.storyId },
        select: { ownerId: true, role: true },
    });
    if (!media || media.ownerId !== input.userId || media.role !== "STORY") {
        return { ok: false, reason: "STORY_INVALIDO" };
    }
    try {
        await db.media.update({
            where: { id: input.storyId },
            data: {
                highlightTitle: null,
                highlightOrder: null,
            },
        });
    } catch {
        return { ok: false, reason: "PERSISTENCIA" };
    }
    return { ok: true };
}

// ---------------------------------------------------------------------------
// Leitura — painel privado e público
// ---------------------------------------------------------------------------

/**
 * Lista os destaques de um dono — agrupado por `highlightTitle`.
 *
 * Em uma única query traz todos os Stories ARCHIVED com
 * `highlightTitle != null`, ordenados por título e dentro do grupo
 * por `highlightOrder asc, createdAt desc`. Agrupamos em memória
 * — volume é baixo (poucos destaques por dono, poucos stories por
 * destaque) e Postgres `groupBy` com select de cover seria mais
 * código sem ganho real.
 */
export async function listarDestaques(
    ownerUserId: string,
): Promise<ReadonlyArray<HighlightResumo>> {
    const rows = await db.media.findMany({
        where: {
            ownerId: ownerUserId,
            role: "STORY",
            status: "ARCHIVED",
            highlightTitle: { not: null },
        },
        orderBy: [
            { highlightTitle: "asc" },
            { highlightOrder: "asc" },
            { createdAt: "desc" },
        ],
        select: {
            id: true,
            kind: true,
            storageKey: true,
            highlightTitle: true,
            createdAt: true,
        },
    });

    const grupos = new Map<
        string,
        {
            title: string;
            total: number;
            cover: { id: string; storageKey: string; kind: "PHOTO" | "VIDEO"; createdAt: Date };
        }
    >();

    for (const row of rows) {
        if (row.highlightTitle === null) continue;
        const existing = grupos.get(row.highlightTitle);
        const kind: "PHOTO" | "VIDEO" =
            row.kind === "VIDEO" ? "VIDEO" : "PHOTO";
        if (!existing) {
            grupos.set(row.highlightTitle, {
                title: row.highlightTitle,
                total: 1,
                cover: {
                    id: row.id,
                    storageKey: row.storageKey,
                    kind,
                    createdAt: row.createdAt,
                },
            });
        } else {
            existing.total += 1;
            // Cover = mais recente. Como ordenamos por
            // highlightOrder asc + createdAt desc, o primeiro item
            // do grupo já carrega o melhor candidato — substituir só
            // se o novo for mais recente (raro, mas defensivo).
            if (row.createdAt > existing.cover.createdAt) {
                existing.cover = {
                    id: row.id,
                    storageKey: row.storageKey,
                    kind,
                    createdAt: row.createdAt,
                };
            }
        }
    }

    return Array.from(grupos.values()).map((g) => ({
        title: g.title,
        total: g.total,
        coverStorageKey: g.cover.storageKey,
        coverKind: g.cover.kind,
        coverMediaId: g.cover.id,
    }));
}

/**
 * Versão pública. Hoje idêntica à privada (não temos flag
 * "destaque oculto"). Mantida como API separada pra que mudanças
 * futuras não exijam refatorar callers.
 */
export async function listarDestaquesPublicos(
    ownerUserId: string,
): Promise<ReadonlyArray<HighlightResumo>> {
    return listarDestaques(ownerUserId);
}

/**
 * Lista os Stories de um destaque específico (em ordem). Usado
 * quando o usuário clica num item do rail e abre o viewer.
 */
export async function listarStoriesDoDestaque(input: {
    ownerUserId: string;
    title: string;
}): Promise<ReadonlyArray<HighlightStory>> {
    const rows = await db.media.findMany({
        where: {
            ownerId: input.ownerUserId,
            role: "STORY",
            status: "ARCHIVED",
            highlightTitle: input.title,
        },
        orderBy: [
            { highlightOrder: "asc" },
            { createdAt: "desc" },
        ],
        select: {
            id: true,
            kind: true,
            storageKey: true,
            posterStorageKey: true,
            description: true,
            createdAt: true,
            likesCount: true,
        },
    });

    return rows.map((r) => ({
        id: r.id,
        kind: r.kind === "VIDEO" ? "VIDEO" : "PHOTO",
        storageKey: r.storageKey,
        posterStorageKey: r.posterStorageKey,
        caption: r.description,
        createdAt: r.createdAt,
        likesCount: r.likesCount,
    }));
}


/**
 * Mapeia `storyId → highlightTitle` para um conjunto de stories do
 * dono. `storyId`s que não estão em nenhum destaque ou cujo título
 * é null ficam fora do Map. Usado pelo painel pra renderizar o
 * badge "Em destaque [Title]" em cada tile arquivado.
 *
 * Single query — sem N+1.
 */
export async function mapearHighlightTitlesDoOwner(
    ownerUserId: string,
    storyIds: ReadonlyArray<string>,
): Promise<Map<string, string>> {
    if (storyIds.length === 0) return new Map();
    const rows = await db.media.findMany({
        where: {
            id: { in: storyIds as string[] },
            ownerId: ownerUserId,
            role: "STORY",
            highlightTitle: { not: null },
        },
        select: { id: true, highlightTitle: true },
    });
    const map = new Map<string, string>();
    for (const r of rows) {
        if (r.highlightTitle !== null) {
            map.set(r.id, r.highlightTitle);
        }
    }
    return map;
}
