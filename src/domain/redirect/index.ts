/**
 * Helpers para redirect "deep link" pós-login/cadastro.
 *
 * Estratégia: a tela de origem (perfil público, modal de curtir,
 * etc) anexa `?next=<url>` à URL de `/login` ou `/cadastro`. As
 * páginas de auth lêem esse `next` e, após sucesso, redirecionam
 * pra ele em vez do destino default.
 *
 * # Segurança (open redirect)
 *
 * Aceitar `next` cego é um vetor de phishing — atacante manda
 * `/login?next=https://evil.com` e o usuário é levado pra fora.
 * Por isso {@link sanitizarNext} só aceita caminhos relativos da
 * própria aplicação:
 *
 *   - Começam com `/` (path absoluto interno).
 *   - **Não** começam com `//` (protocol-relative, vai pra outro host).
 *   - **Não** contêm `\` (alguns browsers normalizam pra `/`).
 *   - **Não** contêm whitespace ou newlines.
 *   - Tamanho razoável (≤ 2048 chars).
 *
 * Em qualquer falha, retorna `null` — o caller cai no destino default.
 */

const MAX_NEXT_LENGTH = 2048;

/**
 * Valida e devolve o `next` saneado, ou `null` se inseguro.
 *
 * Aceita opcionalmente um array de prefixos proibidos extras
 * (ex.: pra impedir redirect ao próprio `/login` em loop).
 */
export function sanitizarNext(
    next: string | null | undefined,
    options: { proibidos?: ReadonlyArray<string> } = {},
): string | null {
    if (typeof next !== "string") return null;
    const trimmed = next.trim();
    if (trimmed.length === 0) return null;
    if (trimmed.length > MAX_NEXT_LENGTH) return null;
    if (!trimmed.startsWith("/")) return null;
    if (trimmed.startsWith("//")) return null;
    if (trimmed.includes("\\")) return null;
    if (/\s/.test(trimmed)) return null;
    // `/javascript:` ou similar não é problema (path interno) — o
    // browser interpreta como caminho — mas reforçamos:
    if (/^\/+(?:javascript|data|vbscript):/i.test(trimmed)) return null;
    for (const proibido of options.proibidos ?? []) {
        if (trimmed === proibido || trimmed.startsWith(`${proibido}?`) ||
            trimmed.startsWith(`${proibido}#`)) {
            return null;
        }
    }
    return trimmed;
}

/**
 * Constrói uma URL de auth (`/login` ou `/cadastro`) com `next`
 * anexado quando válido. Útil pra centralizar o pattern em
 * client components que precisam redirecionar.
 *
 * @example
 *   buildAuthUrl("/login", "/acompanhantes/julia")
 *     → "/login?next=%2Facompanhantes%2Fjulia"
 */
export function buildAuthUrl(
    base: "/login" | "/cadastro" | "/cliente/selecao-plano",
    next: string | null | undefined,
): string {
    const safe = sanitizarNext(next, { proibidos: [base] });
    if (safe === null) return base;
    return `${base}?next=${encodeURIComponent(safe)}`;
}
