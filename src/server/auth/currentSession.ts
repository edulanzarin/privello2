import { cookies, headers } from "next/headers";

import { db } from "@/lib/db";
import { SESSION_COOKIE_NAME } from "@/server/auth/sessionCookieName";
import { resolveSession, verifySessionCookie } from "@/server/auth/sessions";

/**
 * Forma simplificada da sessão consumida pela camada de UI.
 *
 * Carrega apenas o que os layouts/páginas precisam para renderizar
 * navegação consciente de auth:
 *
 * - `userId`: para queries específicas.
 * - `userType`: para discriminar `CLIENTE` vs `ACOMPANHANTE`.
 * - `identificador`: o handle público do usuário (parte após o `@`).
 *   Usado pela BottomNav da Acompanhante para montar a aba
 *   "Perfil público" apontando para `/acompanhantes/<identificador>`.
 *   É carregado em uma única consulta extra de `User` para evitar
 *   round-trips a cada layout.
 */
export type CurrentSession = {
    userId: string;
    userType: "CLIENTE" | "ACOMPANHANTE";
    identificador: string;
};

/**
 * Resolve a sessão ativa do request atual em Server Components.
 *
 * # Origem do `sessionId`
 *
 * 1. Header `x-session-id` injetado por `src/middleware.ts` quando a
 *    assinatura HMAC do cookie de sessão é válida — preferido por já
 *    ter passado pelo middleware (evita re-verificação).
 * 2. Cookie `sessionId` direto, como fallback para rotas que não
 *    estão no matcher do middleware (defesa em profundidade).
 *
 * # Quando retorna `null`
 *
 * - Não há header e o cookie está ausente/inválido.
 * - O `sessionId` resolvido não corresponde a nenhuma sessão viva
 *   (expirada, revogada ou inexistente).
 * - O `User` foi removido (defesa em profundidade — embora
 *   `Session.user` tenha cascade).
 *
 * Layouts que **exigem** auth devem usar
 * {@link import("./currentSession").requireCurrentSession} (ou
 * implementar o próprio redirect). Layouts que apenas adaptam UI
 * conforme o `userType` (ex.: BottomNav que troca "Conta" por
 * "Criar Conta") consomem este helper diretamente.
 */
export async function getCurrentSession(): Promise<CurrentSession | null> {
    const headerStore = await headers();
    const headerSessionId = headerStore.get("x-session-id");

    let sessionId: string | null = headerSessionId;
    if (!sessionId) {
        const cookieStore = await cookies();
        sessionId = await verifySessionCookie(
            cookieStore.get(SESSION_COOKIE_NAME)?.value,
        );
    }

    if (!sessionId) {
        return null;
    }

    const session = await resolveSession(sessionId);
    if (!session) {
        return null;
    }

    const user = await db.user.findUnique({
        where: { id: session.userId },
        select: { identificador: true },
    });
    if (!user) {
        return null;
    }

    return {
        userId: session.userId,
        userType: session.userType,
        identificador: user.identificador,
    };
}
