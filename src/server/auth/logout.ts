import { revokeSession } from "@/server/auth/sessions";
import { SESSION_COOKIE_NAME } from "@/server/auth/sessionCookieName";

export { SESSION_COOKIE_NAME };

/**
 * Sistema_de_Autenticacao — operação de logout.
 *
 * Este módulo implementa a parte do design (`Sistema_de_Autenticacao`)
 * responsável por encerrar uma sessão autenticada. Conforme o
 * Requirement 1.5, a sessão é marcada como revogada (definindo
 * `revokedAt = now()`) e, conforme o Requirement 1.7, o cookie
 * correspondente é apagado pelo cliente após o handler HTTP devolver o
 * header `Set-Cookie` produzido por {@link clearSessionCookieHeader}.
 *
 * A revogação real da sessão é delegada ao repositório em
 * `src/server/auth/sessions.ts` (função `revokeSession`), que é
 * idempotente e nunca lança para sessões inexistentes — invariantes
 * úteis ao implementar logout.
 */

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

/**
 * Nome do cookie que carrega o `sessionId` assinado emitido por
 * `signSessionCookie` em `src/server/auth/sessions.ts`.
 *
 * Em **produção** usa o prefixo `__Host-` que dá garantias extras
 * pelo browser: cookie SÓ é aceito quando vem com `Secure` + `Path=/`
 * + sem `Domain`. Bloqueia cookie injection a partir de subdomínios
 * comprometidos. Em dev (HTTP), o prefixo seria rejeitado pelo
 * browser; mantemos `sessionId` puro pra continuar funcionando.
 */

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

/**
 * Encerra a sessão `sessionId` marcando `revokedAt = now()` no banco.
 *
 * Esta função é um wrapper fino sobre {@link revokeSession} que existe
 * para dar à camada HTTP um ponto de entrada nomeado segundo o caso de
 * uso (logout) descrito pelos Requirements 1.5 e 1.7. É idempotente:
 * chamadas subsequentes para o mesmo `sessionId` (mesmo já revogado ou
 * inexistente) não lançam e não sobrescrevem o `revokedAt` original.
 *
 * Após esta função resolver, qualquer chamada a `resolveSession` com o
 * mesmo `sessionId` retornará `null`, satisfazendo o Requirement 1.7.
 *
 * @param sessionId Identificador opaco da sessão a encerrar.
 */
export async function logout(sessionId: string): Promise<void> {
    await revokeSession(sessionId);
}

/**
 * Constrói o valor do header `Set-Cookie` que apaga o cookie de sessão.
 *
 * O cookie é zerado com `Max-Age=0` e valor vazio, mantendo os mesmos
 * `Path`, `HttpOnly`, `SameSite=Lax` e — em produção — `Secure` usados
 * pelo cookie original. Manter os atributos idênticos é necessário
 * porque navegadores só sobrescrevem o cookie quando o nome, path e
 * domínio batem com o cookie a apagar.
 *
 * @returns Valor pronto para uso no header `Set-Cookie`.
 */
export function clearSessionCookieHeader(): string {
    const parts = [
        `${SESSION_COOKIE_NAME}=`,
        "Path=/",
        "Max-Age=0",
        "HttpOnly",
        "SameSite=Lax",
    ];

    if (process.env.NODE_ENV === "production") {
        parts.push("Secure");
    }

    return parts.join("; ");
}
