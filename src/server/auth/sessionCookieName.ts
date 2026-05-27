/**
 * Nome do cookie de sessão.
 *
 * Centralizado pra que todos os call sites compartilhem o mesmo
 * nome. Em **produção** usa o prefixo `__Host-` que adiciona
 * proteções pelo browser: cookie só é aceito com `Secure`,
 * `Path=/`, sem `Domain` — bloqueia cookie injection vindo de
 * subdomínios comprometidos. Em dev (HTTP) o prefixo seria
 * rejeitado, então mantemos o nome simples.
 *
 * Edge-safe: avaliado uma vez no boot do worker.
 */
export const SESSION_COOKIE_NAME =
    process.env.NODE_ENV === "production" ? "__Host-sessionId" : "sessionId";
