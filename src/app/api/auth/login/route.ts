import { NextResponse } from "next/server";
import { z } from "zod";

import { enforceCsrf } from "@/server/auth/csrf";
import { login } from "@/server/auth/login";
import { SESSION_COOKIE_NAME } from "@/server/auth/sessionCookieName";
import { signSessionCookie } from "@/server/auth/sessions";

/**
 * Sistema_de_Autenticacao — handler HTTP de `POST /api/auth/login`.
 *
 * Este handler é a fachada HTTP do caso de uso `login` em
 * `src/server/auth/login.ts`. Mantém-se intencionalmente fino: validação
 * sintática do corpo via Zod, delegação ao serviço, mapeamento de
 * resultados em respostas JSON e definição do cookie de sessão.
 *
 * Mapeamento de respostas:
 *
 * - Body inválido (ex.: `email`/`password` não são strings) → `400` com
 *   `{ ok: false, reason: "VALIDACAO" }`. Esse caso é apenas defesa
 *   contra payloads malformados; a UI nunca deveria emitir esse 400.
 * - `RATE_LIMITED` (Requirement 1.8) → `429` com header `Retry-After: 900`
 *   (15 minutos em segundos) e `{ ok: false, reason: "RATE_LIMITED" }`.
 * - `INVALID_CREDENTIALS` (Requirements 1.2 e 1.3) → `401` com
 *   `{ ok: false, reason: "INVALID_CREDENTIALS" }`. A resposta é
 *   intencionalmente idêntica para email inexistente e senha incorreta.
 * - Sucesso (Requirement 1.1) → `200` com `{ ok: true, userType }` e
 *   `Set-Cookie` carregando o `sessionId` assinado por
 *   {@link signSessionCookie}, marcado como `HttpOnly`, `SameSite=Lax`,
 *   `Path=/`, com `Secure` em produção e expiração coincidente com
 *   `session.expiresAt` para que o cliente o descarte ao expirar
 *   (Requirement 1.6 / 1.7).
 */

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

/**
 * Janela do rate limit em segundos (Requirement 1.8): 15 minutos. Usado
 * como valor do header `Retry-After` quando o login é bloqueado.
 */
const RATE_LIMIT_RETRY_AFTER_SECONDS = 15 * 60;

// ---------------------------------------------------------------------------
// Schema do corpo
// ---------------------------------------------------------------------------

/**
 * Schema do corpo de `POST /api/auth/login`. Aceita `login` (email ou
 * `@usuario`) ou `email` (nome legado, mantido para compatibilidade).
 * A validação semântica (formato/tamanho) ocorre na camada interna.
 */
const loginBodySchema = z
    .object({
        login: z.string().optional(),
        email: z.string().optional(),
        password: z.string(),
    })
    .refine(
        (body) =>
            (typeof body.login === "string" && body.login.length > 0) ||
            (typeof body.email === "string" && body.email.length > 0),
        { message: "Informe email ou nome de usuário." },
    );

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

/**
 * Manipula `POST /api/auth/login`.
 *
 * @param request Requisição HTTP. O corpo é decodificado como JSON.
 * @returns Resposta JSON com status conforme o mapeamento documentado
 *          no header deste módulo.
 */
export async function POST(request: Request): Promise<NextResponse> {
    const csrf = enforceCsrf(request);
    if (csrf) return csrf;

    let rawBody: unknown;
    try {
        rawBody = await request.json();
    } catch {
        return NextResponse.json(
            { ok: false, reason: "VALIDACAO" },
            { status: 400 },
        );
    }

    const parsed = loginBodySchema.safeParse(rawBody);
    if (!parsed.success) {
        return NextResponse.json(
            { ok: false, reason: "VALIDACAO" },
            { status: 400 },
        );
    }

    const result = await login(
        parsed.data.login ?? parsed.data.email ?? "",
        parsed.data.password,
    );

    if (!result.ok) {
        if (result.reason === "RATE_LIMITED") {
            return NextResponse.json(
                { ok: false, reason: "RATE_LIMITED" },
                {
                    status: 429,
                    headers: {
                        "Retry-After": String(RATE_LIMIT_RETRY_AFTER_SECONDS),
                    },
                },
            );
        }
        return NextResponse.json(
            { ok: false, reason: "INVALID_CREDENTIALS" },
            { status: 401 },
        );
    }

    const response = NextResponse.json(
        { ok: true, userType: result.session.userType },
        { status: 200 },
    );

    response.cookies.set({
        name: SESSION_COOKIE_NAME,
        value: await signSessionCookie(result.session.id),
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        expires: result.session.expiresAt,
    });

    return response;
}
