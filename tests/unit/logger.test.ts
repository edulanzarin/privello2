/**
 * Unit test do logger estruturado (V7 — observabilidade).
 *
 * Cobre:
 *   1. Emite uma linha JSON com ts/level/scope/msg.
 *   2. `info`/`warn` escolhem o console correto; `error` usa
 *      console.error.
 *   3. `error(msg, err)` normaliza o Error em `{ name, message }`.
 *   4. `context` é anexado; ausente quando vazio.
 *   5. `normalizeError` lida com não-Error.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { logger, normalizeError } from "@/lib/observability/logger";

let logSpy: ReturnType<typeof vi.spyOn>;
let warnSpy: ReturnType<typeof vi.spyOn>;
let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
    logSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
});

function ultimaLinha(spy: ReturnType<typeof vi.spyOn>): Record<string, unknown> {
    const call = spy.mock.calls.at(-1);
    if (!call) throw new Error("nenhuma chamada registrada");
    return JSON.parse(call[0] as string) as Record<string, unknown>;
}

describe("logger — formato", () => {
    it("emite JSON com ts/level/scope/msg", () => {
        const log = logger("teste");
        log.info("oi");
        const entry = ultimaLinha(logSpy);
        expect(entry.level).toBe("info");
        expect(entry.scope).toBe("teste");
        expect(entry.msg).toBe("oi");
        expect(typeof entry.ts).toBe("string");
        // ts é ISO parseável.
        expect(Number.isNaN(Date.parse(entry.ts as string))).toBe(false);
    });

    it("info/warn/error escolhem o console certo", () => {
        const log = logger("s");
        log.info("a");
        log.warn("b");
        log.error("c");
        expect(logSpy).toHaveBeenCalledTimes(1);
        expect(warnSpy).toHaveBeenCalledTimes(1);
        expect(errorSpy).toHaveBeenCalledTimes(1);
    });

    it("anexa context quando presente", () => {
        const log = logger("s");
        log.info("com ctx", { userId: "u1", n: 3 });
        const entry = ultimaLinha(logSpy);
        expect(entry.context).toEqual({ userId: "u1", n: 3 });
    });

    it("omite context quando vazio", () => {
        const log = logger("s");
        log.info("sem ctx");
        const entry = ultimaLinha(logSpy);
        expect("context" in entry).toBe(false);
    });
});

describe("logger — erro", () => {
    it("normaliza Error em { name, message } dentro de context.error", () => {
        const log = logger("s");
        log.error("falhou", new Error("boom"), { paymentId: "p1" });
        const entry = ultimaLinha(errorSpy);
        expect(entry.level).toBe("error");
        const ctx = entry.context as Record<string, unknown>;
        const err = ctx.error as Record<string, unknown>;
        expect(err.name).toBe("Error");
        expect(err.message).toBe("boom");
        expect(ctx.paymentId).toBe("p1");
    });

    it("error sem objeto de erro não cria a chave error", () => {
        const log = logger("s");
        log.error("só msg");
        const entry = ultimaLinha(errorSpy);
        expect("context" in entry).toBe(false);
    });
});

describe("normalizeError", () => {
    it("Error vira { name, message }", () => {
        const out = normalizeError(new TypeError("x"));
        expect(out.name).toBe("TypeError");
        expect(out.message).toBe("x");
    });

    it("não-Error vira { message: String(value) }", () => {
        expect(normalizeError("falha textual")).toEqual({
            message: "falha textual",
        });
        expect(normalizeError(42)).toEqual({ message: "42" });
    });
});
