/**
 * Logger estruturado da Privello (V7 — observabilidade).
 *
 * Emite uma linha JSON por evento no stdout/stderr — formato que
 * agregadores (CloudWatch, Loki, Datadog, etc.) parseiam direto, sem
 * regex frágil. Substitui os `console.*` crus espalhados pelos
 * pontos críticos (webhooks, cleanup, side effects best-effort).
 *
 * # Princípios
 *
 * - **Sem dependência paga**: usa só `console` por baixo. Quando o
 *   produto quiser plugar Sentry/Datadog, o ponto único de saída é
 *   {@link emit} — troca lá e pronto.
 * - **Campos canônicos**: `ts` (ISO), `level`, `scope`, `msg` e um
 *   `context` opcional (objeto serializável). Erros viram
 *   `{ name, message, stack }` achatado, nunca o objeto cru (que
 *   serializa como `{}`).
 * - **Sem PII sensível**: o caller decide o que vai no `context`.
 *   Logue ids (userId, paymentId), nunca segredos/tokens.
 *
 * # Uso
 *
 * ```ts
 * import { logger } from "@/lib/observability/logger";
 *
 * const log = logger("mp/webhook");
 * log.error("falha ao processar", err, { paymentId });
 * log.info("boost ativado", { userId, expiraEm });
 * ```
 */

/** Severidade do evento. Ordem crescente de gravidade. */
export type LogLevel = "debug" | "info" | "warn" | "error";

/** Contexto estruturado anexado a um log. Valores serializáveis. */
export type LogContext = Record<string, unknown>;

/**
 * API de log com escopo fixo (ex.: `"mp/webhook"`). Devolvida por
 * {@link logger}.
 */
export interface ScopedLogger {
    debug: (msg: string, context?: LogContext) => void;
    info: (msg: string, context?: LogContext) => void;
    warn: (msg: string, context?: LogContext) => void;
    /**
     * Loga em nível `error`. O 2º argumento pode ser o erro
     * capturado (`unknown`) — é normalizado pra `{ name, message,
     * stack }`. O 3º é contexto extra opcional.
     */
    error: (msg: string, error?: unknown, context?: LogContext) => void;
}

/**
 * Normaliza um valor de erro arbitrário (`unknown`) num objeto
 * serializável. `Error` vira `{ name, message, stack }`; outros
 * valores viram `{ message: String(value) }`. Em produção a stack
 * é omitida pra log mais enxuto (e menos vazamento de caminhos).
 */
export function normalizeError(error: unknown): LogContext {
    if (error instanceof Error) {
        const base: LogContext = {
            name: error.name,
            message: error.message,
        };
        if (process.env.NODE_ENV !== "production" && error.stack) {
            base.stack = error.stack;
        }
        return base;
    }
    return { message: String(error) };
}

/**
 * Ponto único de saída. Monta a linha JSON e escreve no console
 * apropriado (`error`/`warn`/`log`). Centralizar aqui facilita
 * plugar um sink externo depois sem tocar nos call sites.
 */
function emit(
    level: LogLevel,
    scope: string,
    msg: string,
    context?: LogContext,
): void {
    const entry: Record<string, unknown> = {
        ts: new Date().toISOString(),
        level,
        scope,
        msg,
    };
    if (context && Object.keys(context).length > 0) {
        entry.context = context;
    }

    let line: string;
    try {
        line = JSON.stringify(entry);
    } catch {
        // Contexto com referência circular / não-serializável:
        // degrada pro essencial em vez de estourar.
        line = JSON.stringify({ ts: entry.ts, level, scope, msg });
    }

    if (level === "error") {
        console.error(line);
    } else if (level === "warn") {
        console.warn(line);
    } else {
        console.log(line);
    }
}

/**
 * Cria um {@link ScopedLogger} com `scope` fixo. Use um escopo
 * curto e estável por subsistema (`"mp/webhook"`, `"cleanup"`,
 * `"notifications"`).
 */
export function logger(scope: string): ScopedLogger {
    return {
        debug: (msg, context) => emit("debug", scope, msg, context),
        info: (msg, context) => emit("info", scope, msg, context),
        warn: (msg, context) => emit("warn", scope, msg, context),
        error: (msg, error, context) =>
            emit("error", scope, msg, {
                ...(error !== undefined
                    ? { error: normalizeError(error) }
                    : {}),
                ...(context ?? {}),
            }),
    };
}
