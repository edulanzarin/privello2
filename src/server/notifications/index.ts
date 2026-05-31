/**
 * Sistema de Notificações in-site (V2).
 *
 * Central de avisos do usuário — foco na Acompanhante. **Tudo no
 * site, nunca por email.** Eventos que geram notificação:
 *
 * - `NOVA_AVALIACAO`        — alguém deixou uma avaliação no perfil.
 * - `NOVO_FAVORITO`         — um Cliente salvou o perfil.
 * - `VERIFICACAO_APROVADA`  — admin aprovou a verificação.
 * - `VERIFICACAO_REJEITADA` — admin rejeitou (motivo no payload).
 * - `BOOST_ATIVADO`         — boost passou a valer.
 *
 * # Forma do payload
 *
 * Cada `type` tem um shape próprio de `payload` (ver
 * {@link NotificationPayloadMap}). O service de criação é tipado por
 * tipo, então quem dispara não monta JSON solto — passa o objeto
 * certo e o TypeScript garante o shape. Na leitura, normalizamos de
 * volta pro union {@link NotificationItem}.
 *
 * # Disparo best-effort
 *
 * As notificações são um efeito colateral secundário: a criação
 * **nunca** deve derrubar a operação principal (avaliar, favoritar,
 * aprovar verificação, ativar boost). Por isso {@link criarNotificacao}
 * engole erros e devolve `null` em falha — o caller segue normalmente.
 * Quando há uma transação em curso, passe o `tx` pra manter atomicidade
 * (a notificação entra/desfaz junto com o resto).
 */

import type { Prisma, PrismaClient } from "@prisma/client";

import { db } from "@/lib/db";
import { logger } from "@/lib/observability/logger";

const log = logger("notifications");

/**
 * Cliente Prisma ou client de transação — permite criar a
 * notificação dentro de um `db.$transaction` quando faz sentido
 * atomicidade (ex.: verificação, boost).
 */
type DbClient = PrismaClient | Prisma.TransactionClient;

// ---------------------------------------------------------------------------
// Tipos de payload por categoria
// ---------------------------------------------------------------------------

/**
 * Mapa `type -> shape do payload`. Fonte da verdade do que cada
 * notificação carrega. Mantém criação e leitura em sincronia.
 */
export interface NotificationPayloadMap {
    NOVA_AVALIACAO: {
        /** Nome de exibição de quem avaliou. */
        autorNome: string;
        /** `@identificador` de quem avaliou (link pro perfil). */
        autorIdentificador: string;
    };
    NOVO_FAVORITO: {
        /**
         * Total acumulado de favoritos após esta marcação. A UI
         * mostra "X pessoas já te salvaram" sem revelar QUEM
         * (privacidade do Cliente).
         */
        total: number;
    };
    VERIFICACAO_APROVADA: {
        /** Quando a verificação expira (ISO) — a Acompanhante renova depois. */
        expiraEm: string;
    };
    VERIFICACAO_REJEITADA: {
        /** Motivo informado pelo admin (texto livre). */
        motivo: string;
    };
    BOOST_ATIVADO: {
        /** Quando o boost deixa de valer (ISO). */
        expiraEm: string;
    };
    BUSCA_NOVA_CORRESPONDENCIA: {
        /** Rótulo amigável da busca salva que casou. */
        buscaLabel: string;
        /** Nome de exibição do perfil novo que apareceu. */
        perfilNome: string;
        /** `@identificador` do perfil novo (link). */
        perfilIdentificador: string;
    };
    RESUMO_SEMANAL: {
        /** Visitas ao perfil na semana. */
        visitas: number;
        /** Curtidas recebidas na semana. */
        curtidas: number;
        /** Novos favoritos na semana. */
        novosFavoritos: number;
        /** Perguntas pendentes de resposta (snapshot atual). */
        perguntasPendentes: number;
    };
}

/** União dos tipos de notificação. */
export type NotificationKind = keyof NotificationPayloadMap;

/**
 * Notificação normalizada pra UI. `payload` é discriminado por
 * `type` — um `switch (n.type)` estreita o shape automaticamente.
 */
export type NotificationItem = {
    [K in NotificationKind]: {
        id: string;
        type: K;
        payload: NotificationPayloadMap[K];
        lida: boolean;
        criadoEm: Date;
    };
}[NotificationKind];

// ---------------------------------------------------------------------------
// Criar
// ---------------------------------------------------------------------------

/**
 * Cria uma notificação pro `userId`. Best-effort: nunca lança —
 * em falha devolve `null` e loga no console (o caller segue).
 *
 * Tipado por categoria: o `payload` precisa casar com o `type`
 * via {@link NotificationPayloadMap}.
 *
 * @param client Opcional. Passe o `tx` pra criar dentro de uma
 *   transação em curso (atomicidade com o efeito principal). Sem
 *   ele, usa o `db` global.
 */
export async function criarNotificacao<K extends NotificationKind>(input: {
    userId: string;
    type: K;
    payload: NotificationPayloadMap[K];
    client?: DbClient;
}): Promise<string | null> {
    const client = input.client ?? db;
    try {
        const row = await client.notification.create({
            data: {
                userId: input.userId,
                type: input.type,
                // Prisma aceita `InputJsonValue`; nossos payloads são
                // objetos planos serializáveis.
                payload: input.payload as Prisma.InputJsonValue,
            },
            select: { id: true },
        });
        return row.id;
    } catch (error) {
        // Efeito secundário: não derruba a operação principal.
        log.error("falha ao criar notificação", error, {
            userId: input.userId,
            type: input.type,
        });
        return null;
    }
}

// ---------------------------------------------------------------------------
// Listar
// ---------------------------------------------------------------------------

/**
 * Lista as notificações do usuário, mais recentes primeiro.
 * Tolerante a linhas legadas/inválidas: descarta `type` fora do
 * enum conhecido em vez de quebrar a UI.
 */
export async function listarNotificacoes(
    userId: string,
    options: { limit?: number; offset?: number } = {},
): Promise<ReadonlyArray<NotificationItem>> {
    const limit = Math.max(1, Math.min(100, options.limit ?? 30));
    const offset = Math.max(0, options.offset ?? 0);

    const rows = await db.notification.findMany({
        where: { userId },
        orderBy: { criadoEm: "desc" },
        skip: offset,
        take: limit,
        select: {
            id: true,
            type: true,
            payload: true,
            lidaEm: true,
            criadoEm: true,
        },
    });

    const items: NotificationItem[] = [];
    for (const r of rows) {
        items.push({
            id: r.id,
            // `type` vem do enum Prisma — bate com NotificationKind.
            type: r.type as NotificationKind,
            // O payload foi gravado pelo nosso próprio writer tipado,
            // então o shape casa com o type. Cast estreito controlado.
            payload: r.payload as NotificationItem["payload"],
            lida: r.lidaEm !== null,
            criadoEm: r.criadoEm,
        } as NotificationItem);
    }
    return items;
}

// ---------------------------------------------------------------------------
// Contar não lidas
// ---------------------------------------------------------------------------

/**
 * Quantas notificações não lidas o usuário tem. Usado pelo badge
 * do sininho.
 */
export async function contarNaoLidas(userId: string): Promise<number> {
    return db.notification.count({
        where: { userId, lidaEm: null },
    });
}

// ---------------------------------------------------------------------------
// Marcar como lida
// ---------------------------------------------------------------------------

/**
 * Marca uma notificação específica como lida. Só afeta linhas do
 * próprio `userId` (escopo de segurança — ninguém marca a alheia).
 * Idempotente: re-chamar não muda `lidaEm` já preenchido.
 */
export async function marcarComoLida(input: {
    userId: string;
    notificationId: string;
}): Promise<{ ok: true }> {
    await db.notification.updateMany({
        where: {
            id: input.notificationId,
            userId: input.userId,
            lidaEm: null,
        },
        data: { lidaEm: new Date() },
    });
    return { ok: true };
}

/**
 * Marca TODAS as não lidas do usuário como lidas. Usado quando ele
 * abre o dropdown / a aba de notificações. Retorna quantas foram
 * afetadas.
 */
export async function marcarTodasComoLidas(
    userId: string,
): Promise<{ ok: true; afetadas: number }> {
    const result = await db.notification.updateMany({
        where: { userId, lidaEm: null },
        data: { lidaEm: new Date() },
    });
    return { ok: true, afetadas: result.count };
}
