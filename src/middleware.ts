import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE_NAME } from "@/server/auth/sessionCookieName";
import { verifySessionCookie } from "@/server/auth/sessionCookie";

/**
 * Privello — middleware de proteção de rotas.
 *
 * # Restrição do Edge Runtime
 *
 * O Next.js Middleware roda no Edge Runtime, que **não tem acesso ao
 * Prisma Client** (o `@prisma/client` depende de APIs Node.js e
 * binaries nativas que não estão disponíveis em Edge). Por isso este
 * middleware faz apenas a verificação leve da **assinatura HMAC** do
 * cookie de sessão — operação que depende somente de `node:crypto` e
 * é compatível com Edge — e **delega o lookup completo no banco**
 * (incluindo a checagem de `planoVigente` exigida pelos Requirements
 * 5.5 e 5.10) para os layouts dos route groups `(cliente)` e
 * `(acompanhante)`. Esses layouts são Server Components que rodam no
 * runtime Node.js e podem chamar `resolveSession` + `obterVigente`
 * livremente.
 *
 * # Comportamento
 *
 * - Lê o cookie `sessionId` e valida sua assinatura via
 *   {@link verifySessionCookie}.
 * - Em rotas protegidas (`/cliente/*`, `/acompanhante/*`) sem
 *   assinatura válida, redireciona para `/login` (Requirements 1.6 e
 *   1.7). Como o middleware não consegue confirmar revogação ou
 *   expiração (que vivem no banco), uma assinatura válida apenas
 *   permite a passagem; o layout downstream confirma o estado real da
 *   sessão.
 * - Em qualquer rota matched, propaga em headers internos:
 *     - `x-session-id`: presente apenas quando o cookie tem assinatura
 *       válida; consumido por layouts/Server Components que precisam
 *       chamar `resolveSession` sem reler/reverificar o cookie.
 *     - `x-pathname`: o `pathname` da requisição atual; usado pelo
 *       layout `(acompanhante)` para decidir entre redirecionar para
 *       `/acompanhante/selecao-plano` ou para a área principal
 *       (Requirements 5.5 e 5.10), já que layouts não recebem o
 *       pathname diretamente.
 * - Para evitar spoofing por clientes que enviem cabeçalhos
 *   `x-session-id` arbitrários no request, o middleware sempre
 *   **remove** qualquer valor existente desses cabeçalhos antes de
 *   reescrevê-los. Como o matcher cobre todas as rotas que vão ler
 *   esses headers, o ataque está fechado.
 *
 * # Rotas públicas dentro do matcher
 *
 * `/login` e `/cadastro/*` ficam no matcher para que o middleware
 * possa propagar `x-session-id` (útil para que essas páginas detectem
 * usuários já autenticados). O middleware **não** força redirect
 * nessas rotas — as próprias páginas decidem o que fazer.
 */

/** Prefixos de rota que exigem cookie de sessão com assinatura válida. */
const PROTECTED_PREFIXES = ["/cliente", "/acompanhante"] as const;

/** Headers internos sob controle exclusivo do middleware. */
const X_SESSION_ID_HEADER = "x-session-id";
const X_PATHNAME_HEADER = "x-pathname";
const X_SEARCH_HEADER = "x-search";

function isProtectedPath(pathname: string): boolean {
    return PROTECTED_PREFIXES.some(
        (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    );
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
    const { pathname } = request.nextUrl;
    const rawCookie =
        request.cookies.get(SESSION_COOKIE_NAME)?.value ?? null;
    const sessionId = await verifySessionCookie(rawCookie);

    if (sessionId === null && isProtectedPath(pathname)) {
        const loginUrl = new URL("/login", request.url);
        return NextResponse.redirect(loginUrl);
    }

    const requestHeaders = new Headers(request.headers);
    // Remove qualquer valor enviado pelo cliente para evitar spoofing.
    requestHeaders.delete(X_SESSION_ID_HEADER);
    requestHeaders.delete(X_SEARCH_HEADER);
    requestHeaders.set(X_PATHNAME_HEADER, pathname);
    // Expõe a query string pra layouts/Server Components (ex.: o
    // layout da Acompanhante preserva `?payment=success` ao
    // redirecionar pra seleção de plano após pagamento PIX pendente).
    requestHeaders.set(X_SEARCH_HEADER, request.nextUrl.search);
    if (sessionId !== null) {
        requestHeaders.set(X_SESSION_ID_HEADER, sessionId);
    }

    return NextResponse.next({
        request: { headers: requestHeaders },
    });
}

export const config = {
    matcher: [
        // Áreas privadas — exigem sessão válida.
        "/cliente/:path*",
        "/acompanhante/:path*",
        // Áreas públicas com navegação consciente de auth — o
        // middleware injeta `x-session-id` quando há cookie válido para
        // que o `(shell)/layout.tsx` possa adaptar a `BottomNav`
        // (`Conta` ↔ `Criar Conta`).
        "/",
        "/acompanhantes/:path*",
        "/reels/:path*",
        // Páginas de auth/cadastro — recebem `x-session-id` para
        // permitir que detectem usuários já autenticados.
        "/login",
        "/cadastro/:path*",
    ],
};
