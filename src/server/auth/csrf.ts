import { NextResponse } from "next/server";

/**
 * CSRF protection — same-origin via Origin/Referer header.
 *
 * Server Actions do Next.js já validam Origin nativamente, mas os
 * route handlers REST (`/api/...`) não. Este módulo centraliza a
 * checagem para uso pelos guards (`requireSession`,
 * `requireAcompanhante`, etc) ou diretamente pelos handlers que não
 * passam por guard (ex.: `POST /api/auth/login`, que precede a
 * sessão).
 *
 * # Estratégia
 *
 * Same-origin enforcement: o navegador só envia `Origin`/`Referer`
 * quando a request parte de um contexto controlado, e em mutações
 * cross-origin (formulário em outro site, fetch sem CORS) o `Origin`
 * vai estar diferente. Validamos comparando contra o `host` da
 * request — não precisa de tabela de tokens nem extra round-trip.
 *
 * Para webhooks externos (ex.: Mercado Pago) e o próprio
 * `/api/health`, isenções explicitas são feitas dentro do handler
 * antes de invocar o guard.
 *
 * # Métodos protegidos
 *
 * Apenas mutações: `POST`, `PUT`, `PATCH`, `DELETE`. `GET`/`HEAD` não
 * são checados — leitura idempotente não dispara CSRF clássico.
 */

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Retorna `true` quando a request passa o teste de same-origin.
 *
 * - Métodos seguros (GET/HEAD/OPTIONS) sempre passam.
 * - Para mutações: exige `Origin` ou `Referer` cujo `host` bata com
 *   o `host` da própria request. Sem nenhum dos dois headers, ou com
 *   host diferente, é rejeitada.
 *
 * Não valida formato de URL — `URL` lança em strings inválidas, e o
 * try/catch garante que falhamos de forma segura (rejeita).
 */
export function isSameOriginRequest(request: Request): boolean {
    if (SAFE_METHODS.has(request.method)) {
        return true;
    }

    const requestHost = request.headers.get("host");
    if (!requestHost) {
        return false;
    }

    const origin = request.headers.get("origin");
    const referer = request.headers.get("referer");

    const candidate = origin ?? referer;
    if (!candidate) {
        // Sem Origin nem Referer em mutação — bloquear. Browsers
        // sempre enviam Origin em fetch/XHR cross-origin.
        return false;
    }

    try {
        const parsed = new URL(candidate);
        return parsed.host === requestHost;
    } catch {
        return false;
    }
}

/**
 * Guard CSRF para route handlers. Devolve `null` quando ok, ou um
 * `NextResponse` 403 quando a request é cross-origin não autorizada.
 *
 * Padrão de uso:
 *
 *   export async function POST(req: Request) {
 *     const csrf = enforceCsrf(req);
 *     if (csrf) return csrf;
 *     // ... resto do handler
 *   }
 *
 * Os guards de auth (`requireSession`, `requireAcompanhante`, etc)
 * já chamam isso internamente — handlers que usam guards não
 * precisam invocar de novo.
 */
export function enforceCsrf(request: Request): NextResponse | null {
    if (isSameOriginRequest(request)) {
        return null;
    }
    return NextResponse.json(
        { ok: false, reason: "ORIGEM_INVALIDA" },
        { status: 403 },
    );
}
