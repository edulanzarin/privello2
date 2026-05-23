import { NextResponse, type NextRequest } from "next/server";

import {
    SESSION_COOKIE_NAME,
    clearSessionCookieHeader,
    logout,
} from "@/server/auth/logout";
import { verifySessionCookie } from "@/server/auth/sessions";

/**
 * Sistema_de_Autenticacao — handler HTTP de `POST /api/auth/logout`.
 *
 * Este handler executa a operação de logout descrita pelos Requirements
 * 1.5 (encerrar sessão) e 1.7 (rejeitar requisições subsequentes que
 * apresentem credenciais previamente invalidadas):
 *
 * 1. Lê o cookie `sessionId` da requisição.
 * 2. Verifica a assinatura HMAC com {@link verifySessionCookie} e, em
 *    caso de sucesso, encerra a sessão via {@link logout} (idempotente
 *    para sessões inexistentes ou já revogadas).
 * 3. Sempre retorna `200` com `Set-Cookie: <clearSessionCookieHeader>`
 *    para apagar o cookie no cliente — inclusive quando o cookie está
 *    ausente, malformado ou tem assinatura inválida. Isso preserva a
 *    idempotência do endpoint e não diferencia "estava logado" de "não
 *    estava logado" na resposta HTTP.
 */

/**
 * Manipula `POST /api/auth/logout`.
 *
 * @param request Requisição HTTP. O cookie de sessão é lido daqui.
 * @returns       `200` com `Set-Cookie` que apaga o cookie de sessão.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
    const cookieValue = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    const sessionId = await verifySessionCookie(cookieValue);
    if (sessionId !== null) {
        await logout(sessionId);
    }

    const response = NextResponse.json({ ok: true }, { status: 200 });
    response.headers.append("Set-Cookie", clearSessionCookieHeader());
    return response;
}
