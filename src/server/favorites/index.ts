/**
 * Sistema de Favoritos / Salvos.
 *
 * Cliente marca Acompanhantes como favorita pra acessar rápido
 * depois. Toggle idempotente — chamar marcar 2x não cria duplicata.
 *
 * # Privacidade
 *
 * - **Cliente** vê a própria lista de favoritas.
 * - **Acompanhante** vê apenas o COUNT total. Não vê QUEM são os
 *   Clientes — caller que precisa dessa info pede via tabela
 *   diretamente, mas a UI nunca mostra (privacidade do Cliente,
 *   muitos preferem manter discrição).
 *
 * # Lifecycle
 *
 * Cascade automático: deletar Cliente OU Acompanhante limpa as
 * marcações. Não há soft-delete — favorito é estado leve.
 */

import { db } from "@/lib/db";

// ---------------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------------

/**
 * Item da lista de favoritas do Cliente. Espelha info pública
 * mínima da Acompanhante pra renderizar o card sem join extra.
 */
export interface FavoritoItem {
    /** Slug (`@`) da Acompanhante. */
    identificador: string;
    /** Nome de exibição. */
    nome: string;
    /** URL pública da foto de perfil ou `null`. */
    fotoUrl: string | null;
    /** Cidade onde atende (opcional). */
    cidadeNome: string;
    /** UF. */
    estadoSigla: string;
    /** Bairro (quando preenchido). */
    bairroNome: string | null;
    /** Quando este favorito foi adicionado. */
    favoritadoEm: Date;
    /** `true` quando a Acompanhante tem identidade verificada. */
    verificada: boolean;
}

// ---------------------------------------------------------------------------
// Toggle (marcar / desmarcar)
// ---------------------------------------------------------------------------

export type ToggleFavoritoResult =
    | { ok: true; favorito: boolean }
    | {
        ok: false;
        reason: "ALVO_INVALIDO" | "AUTO_FAVORITAR" | "PERSISTENCIA";
    };

/**
 * Inverte o estado: se já é favorito, remove; senão, adiciona.
 *
 * Falha se:
 * - `acompanhanteUserId` não existe ou não é uma Acompanhante
 *   visível (perfil oculto / sem plano / Cliente).
 * - `clientUserId === acompanhanteUserId` (auto-favoritar).
 *
 * Retorna o novo estado em `favorito`.
 */
export async function toggleFavorito(input: {
    clientUserId: string;
    acompanhanteUserId: string;
}): Promise<ToggleFavoritoResult> {
    if (input.clientUserId === input.acompanhanteUserId) {
        return { ok: false, reason: "AUTO_FAVORITAR" };
    }

    // Valida alvo: precisa ser User do tipo ACOMPANHANTE.
    // Cliente não favorita Cliente. (Acompanhante visível ou não
    // não importa — o favorito segue valendo mesmo se ela esconder
    // o perfil temporariamente; ao reabrir, volta a aparecer.)
    const target = await db.user.findUnique({
        where: { id: input.acompanhanteUserId },
        select: { type: true },
    });
    if (!target || target.type !== "ACOMPANHANTE") {
        return { ok: false, reason: "ALVO_INVALIDO" };
    }

    try {
        const existing = await db.clientFavorite.findUnique({
            where: {
                clientUserId_acompanhanteUserId: {
                    clientUserId: input.clientUserId,
                    acompanhanteUserId: input.acompanhanteUserId,
                },
            },
            select: { clientUserId: true },
        });

        if (existing) {
            await db.clientFavorite.delete({
                where: {
                    clientUserId_acompanhanteUserId: {
                        clientUserId: input.clientUserId,
                        acompanhanteUserId: input.acompanhanteUserId,
                    },
                },
            });
            return { ok: true, favorito: false };
        }

        await db.clientFavorite.create({
            data: {
                clientUserId: input.clientUserId,
                acompanhanteUserId: input.acompanhanteUserId,
            },
        });
        return { ok: true, favorito: true };
    } catch {
        return { ok: false, reason: "PERSISTENCIA" };
    }
}

// ---------------------------------------------------------------------------
// Listar favoritos do Cliente
// ---------------------------------------------------------------------------

/**
 * Lista as Acompanhantes favoritadas pelo Cliente, ordem desc por
 * adição. Filtra só perfis com `type=ACOMPANHANTE` (defesa contra
 * dados antigos malformados — não deveria existir).
 *
 * **Não filtra** perfis ocultos: se a Acompanhante escondeu o
 * perfil, a favorita continua na lista do Cliente (cinza, sem
 * link). Hoje não temos UI pra esse caso — em iteração futura,
 * marcar visualmente.
 */
export async function listarFavoritos(
    clientUserId: string,
    options: { limit?: number; offset?: number } = {},
): Promise<ReadonlyArray<FavoritoItem>> {
    const limit = Math.max(1, Math.min(100, options.limit ?? 50));
    const offset = Math.max(0, options.offset ?? 0);

    const rows = await db.clientFavorite.findMany({
        where: { clientUserId },
        orderBy: { criadoEm: "desc" },
        skip: offset,
        take: limit,
        select: {
            criadoEm: true,
            acompanhante: {
                select: {
                    identificador: true,
                    nome: true,
                    type: true,
                    acompanhante: {
                        select: {
                            estadoSigla: true,
                            cidadeNome: true,
                            bairroNome: true,
                            verificada: true,
                            fotoPerfil: { select: { storageKey: true } },
                        },
                    },
                },
            },
        },
    });

    const items: FavoritoItem[] = [];
    for (const r of rows) {
        // Defesa: registro órfão sem profile não vira card.
        const ac = r.acompanhante.acompanhante;
        if (!ac) continue;
        if (r.acompanhante.type !== "ACOMPANHANTE") continue;

        items.push({
            identificador: r.acompanhante.identificador,
            nome: r.acompanhante.nome,
            fotoUrl: ac.fotoPerfil
                ? `/api/storage/${ac.fotoPerfil.storageKey}`
                : null,
            cidadeNome: ac.cidadeNome,
            estadoSigla: ac.estadoSigla,
            bairroNome: ac.bairroNome,
            favoritadoEm: r.criadoEm,
            verificada: ac.verificada,
        });
    }
    return items;
}

// ---------------------------------------------------------------------------
// É favorito? (lookup por par)
// ---------------------------------------------------------------------------

/**
 * Diz se o par (cliente, acompanhante) está marcado como favorito.
 * Usado pelo perfil público pra renderizar o estado inicial do
 * `BookmarkButton`.
 */
export async function isFavorito(input: {
    clientUserId: string;
    acompanhanteUserId: string;
}): Promise<boolean> {
    const row = await db.clientFavorite.findUnique({
        where: {
            clientUserId_acompanhanteUserId: {
                clientUserId: input.clientUserId,
                acompanhanteUserId: input.acompanhanteUserId,
            },
        },
        select: { clientUserId: true },
    });
    return row !== null;
}

// ---------------------------------------------------------------------------
// Contar quem favoritou (Acompanhante)
// ---------------------------------------------------------------------------

/**
 * Quantos Clientes salvaram esta Acompanhante. Mostrado como
 * métrica privada no painel — a Acompanhante NÃO vê a lista,
 * apenas o número.
 */
export async function contarFavoritosDoOwner(
    acompanhanteUserId: string,
): Promise<number> {
    return db.clientFavorite.count({
        where: { acompanhanteUserId },
    });
}
