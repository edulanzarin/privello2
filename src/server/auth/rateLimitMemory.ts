/**
 * Rate limit em memória — janela deslizante.
 *
 * Guarda contagens por chave (`bucket:client`) numa `Map` global
 * por instância. Não é distribuído — se a aplicação rodar atrás
 * de múltiplas instâncias, cada uma tem o próprio contador. Isso
 * é aceitável pra cenários de **defesa contra scrapers/abuso**:
 * mesmo que um atacante coordene N hits por instância, cada
 * instância dispara seu próprio bloqueio.
 *
 * Para limites críticos (login, reset), preferimos a tabela
 * `LoginAttempt` no banco que é distribuída e auditável.
 *
 * # Uso
 *
 * ```ts
 * const result = checkRateLimit("check-availability", clientId, {
 *     max: 30,
 *     windowMs: 60_000,
 * });
 * if (!result.ok) return new Response(..., { status: 429 });
 * ```
 *
 * # Limpeza
 *
 * Cada call expira janelas antigas e remove a entrada quando o
 * bucket fica vazio — sem leak de memória ao longo do tempo. Não
 * tem cron — limpeza piggy-back.
 */

interface BucketState {
    /** Timestamps (ms) das requisições dentro da janela. */
    hits: number[];
}

const STATE = new Map<string, BucketState>();

export interface RateLimitInput {
    /** Tamanho máximo da janela em milissegundos. */
    windowMs: number;
    /** Quantas requisições são permitidas dentro da janela. */
    max: number;
    /** Relógio injetável (testes). Padrão: `Date.now()`. */
    now?: () => number;
}

export interface RateLimitResult {
    ok: boolean;
    /** Quantas requisições restam na janela. */
    remaining: number;
    /** Em quanto tempo (ms) a janela libera próxima requisição. */
    retryAfterMs: number;
}

/**
 * Avalia (e registra) uma requisição contra o rate limit do par
 * `(bucket, clientKey)`.
 *
 * - `bucket`: nome lógico do limite (ex.: `"check-availability"`).
 * - `clientKey`: identificador do chamador (IP, userId, etc.).
 *
 * Retorna `ok: false` quando a requisição **não** deve ser
 * processada (já estourou a janela).
 */
export function checkRateLimit(
    bucket: string,
    clientKey: string,
    input: RateLimitInput,
): RateLimitResult {
    const now = (input.now ?? Date.now)();
    const windowStart = now - input.windowMs;
    const key = `${bucket}:${clientKey}`;

    const state = STATE.get(key) ?? { hits: [] };
    // Remove timestamps fora da janela.
    state.hits = state.hits.filter((t) => t > windowStart);

    if (state.hits.length >= input.max) {
        // Calcula quanto falta pro hit mais antigo "sair" da janela.
        const oldest = state.hits[0] ?? now;
        const retryAfterMs = Math.max(0, oldest + input.windowMs - now);
        // Mantém a entrada (ainda há hits válidos).
        STATE.set(key, state);
        return { ok: false, remaining: 0, retryAfterMs };
    }

    state.hits.push(now);
    STATE.set(key, state);

    // Cleanup oportunista — quando a entrada é a única e
    // tem só este hit, agenda uma limpeza após a janela passar.
    // (Evita leak quando o tráfego é esparso.)
    if (state.hits.length === 1 && typeof setTimeout !== "undefined") {
        setTimeout(() => {
            const cur = STATE.get(key);
            if (!cur) return;
            const stillValid = cur.hits.filter(
                (t) => t > Date.now() - input.windowMs,
            );
            if (stillValid.length === 0) {
                STATE.delete(key);
            } else {
                cur.hits = stillValid;
            }
        }, input.windowMs + 1000).unref?.();
    }

    return {
        ok: true,
        remaining: input.max - state.hits.length,
        retryAfterMs: 0,
    };
}

/**
 * Extrai um identificador do cliente a partir de uma `Request`.
 *
 * Tenta cabeçalhos do reverso primeiro (`x-forwarded-for`,
 * `x-real-ip`, `cf-connecting-ip`), porque `request.ip` no Next
 * runtime não é confiável atrás de proxy. Cai pra `"unknown"`
 * em último caso — ainda agrupa abusos sem fingerprint.
 */
export function clientKeyFromRequest(request: Request): string {
    const headers = request.headers;
    const xff = headers.get("x-forwarded-for");
    if (xff) {
        // Primeiro IP da cadeia X-Forwarded-For — o cliente original.
        const first = xff.split(",")[0]?.trim();
        if (first && first.length > 0) return first;
    }
    const real = headers.get("x-real-ip");
    if (real && real.trim().length > 0) return real.trim();
    const cf = headers.get("cf-connecting-ip");
    if (cf && cf.trim().length > 0) return cf.trim();
    return "unknown";
}

/**
 * Limpa todo o estado — usado em testes pra garantir
 * isolamento entre casos.
 */
export function __resetRateLimitForTests(): void {
    STATE.clear();
}
