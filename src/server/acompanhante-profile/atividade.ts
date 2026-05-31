/**
 * Presença "ativa recentemente" (W2).
 *
 * Sinaliza, de forma deliberadamente grossa, se uma Acompanhante
 * teve atividade na plataforma nas últimas horas — usando o
 * `Session.lastSeenAt` (atualizado no máximo a cada 60s pelo
 * `resolveSession`). NÃO é "online agora" em tempo real, nem expõe
 * timestamp: só um booleano "ativa hoje", pra dar frescor à vitrine
 * sem prometer chat ou rastrear a pessoa.
 *
 * # Privacidade / produto
 *
 * - Granularidade grossa (janela de horas), nunca "visto às 14h32".
 * - Só vale pra Acompanhante (a vitrine). Não expõe atividade de
 *   Cliente.
 * - Best-effort: em qualquer falha, devolve "não ativa" (Set vazio)
 *   — a ausência do selo é o estado seguro.
 */

import { db } from "@/lib/db";

/**
 * Janela que conta como "ativa recentemente". 24h cobre o uso
 * realista (a pessoa entrou hoje) sem ficar mostrando selo por
 * dias.
 */
const JANELA_ATIVIDADE_MS = 24 * 60 * 60 * 1000;

/**
 * Dado um conjunto de `userId`s, devolve o subconjunto que teve
 * sessão ativa (login vivo) dentro da {@link JANELA_ATIVIDADE_MS}.
 *
 * Uma única query agregada (groupBy por usuário com sessão recente)
 * — sem N+1. Sessões revogadas ainda contam como atividade passada
 * (a pessoa esteve aqui); o que importa é `lastSeenAt`.
 */
export async function obterAtividadeRecente(
    userIds: ReadonlyArray<string>,
    options: { now?: Date } = {},
): Promise<ReadonlySet<string>> {
    if (userIds.length === 0) return new Set();
    const now = options.now ?? new Date();
    const desde = new Date(now.getTime() - JANELA_ATIVIDADE_MS);

    try {
        const grupos = await db.session.groupBy({
            by: ["userId"],
            where: {
                userId: { in: userIds as string[] },
                lastSeenAt: { gte: desde },
            },
        });
        return new Set(grupos.map((g) => g.userId));
    } catch {
        // Best-effort: sem selo é o estado seguro.
        return new Set();
    }
}
