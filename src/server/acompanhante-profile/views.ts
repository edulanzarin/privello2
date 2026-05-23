import { cookies } from "next/headers";

import { db } from "@/lib/db";

/**
 * Cooldown padrão entre visualizações que contam para o mesmo
 * `userId` no mesmo viewer (anônimo ou autenticado). 6 horas é
 * um equilíbrio entre detectar tráfego de retorno legítimo e evitar
 * inflar o número via refresh agressivo.
 */
export const VIEW_COOLDOWN_SECONDS = 6 * 60 * 60;

/**
 * Prefixo do cookie de cooldown. Gravamos um cookie por perfil
 * visitado (chave `pv_<userId>`) com valor `1` e TTL de 6h. A
 * presença do cookie sinaliza "esse viewer já contou nas últimas 6h"
 * — pulamos o `UPDATE` sem deixar transparente o `userId` no nome
 * (cookie name não é PII porque o `userId` é UUID público).
 */
export const VIEW_COOLDOWN_COOKIE_PREFIX = "pv_";

/**
 * Resolve o nome do cookie de cooldown pra um `userId`. Helper
 * exposto pra que o route handler que faz a contagem use a mesma
 * convenção.
 */
export function buildViewCooldownCookieName(userId: string): string {
    return `${VIEW_COOLDOWN_COOKIE_PREFIX}${userId}`;
}

/**
 * Lê o cookie de cooldown e retorna `true` quando o viewer já contou
 * nas últimas 6h (pulamos o incremento). Pode ser chamado de
 * qualquer contexto com `next/headers` (RSC, Route Handler, Server
 * Action) — o `cookies()` em modo leitura é seguro em todos.
 */
export async function viewCooldownAtivo(targetUserId: string): Promise<boolean> {
    const cookieStore = await cookies();
    return (
        cookieStore.get(buildViewCooldownCookieName(targetUserId)) !== undefined
    );
}

/**
 * Resultado de {@link incrementarVisualizacao}.
 *
 * - `applied: true`: visualização contada, caller deve gravar o
 *   cookie de cooldown.
 * - `applied: false`: visualização pulada (auto-view, target não é
 *   Acompanhante, ou banco recusou). Caller não grava cookie.
 */
export type IncrementarVisualizacaoResult = { applied: boolean };

/**
 * Incrementa o contador de visualizações públicas do perfil de uma
 * Acompanhante. **Não toca em cookies** — quem grava o cookie de
 * cooldown é o Route Handler que orquestra a operação (porque
 * `cookies().set()` é proibido em RSC, e o caller deste módulo
 * idealmente roda em Route Handler).
 *
 * Falha silenciosamente em qualquer erro de banco — vista é métrica,
 * não pode derrubar a página pública.
 *
 * @param targetUserId - `userId` do dono do perfil sendo visualizado.
 * @param viewerUserId - `userId` do visitante autenticado, ou `null`
 *   para anônimos. Quando o visitante é a própria Acompanhante,
 *   o incremento é pulado (não faz sentido auto-view).
 */
export async function incrementarVisualizacao(
    targetUserId: string,
    viewerUserId: string | null,
): Promise<IncrementarVisualizacaoResult> {
    if (viewerUserId !== null && viewerUserId === targetUserId) {
        return { applied: false };
    }

    try {
        await db.acompanhanteProfile.update({
            where: { userId: targetUserId },
            data: { viewsCount: { increment: 1 } },
            select: { userId: true },
        });
        return { applied: true };
    } catch {
        // Métrica não derruba página.
        return { applied: false };
    }
}
