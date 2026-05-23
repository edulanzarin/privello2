import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Unit tests for `Sistema_de_Autenticacao` logout (task 4.9).
 *
 * Cobre:
 * - `logout(sessionId)` delega a `revokeSession`, que marca
 *   `revokedAt = now()` no banco (Requirement 1.5).
 * - `logout` é idempotente: chamadas subsequentes não lançam.
 * - `clearSessionCookieHeader()` produz um `Set-Cookie` válido para
 *   apagar o cookie de sessão emitido por `signSessionCookie`
 *   (Requirement 1.7), preservando `Path`, `HttpOnly`, `SameSite=Lax`
 *   e marcando `Secure` apenas em produção.
 *
 * O módulo `@/server/auth/sessions` é mockado para evitar que o teste
 * tenha que tocar o banco de dados ou validar variáveis de ambiente
 * — esses caminhos são cobertos pelos testes property-based dedicados.
 */
vi.mock("@/server/auth/sessions", () => ({
    revokeSession: vi.fn().mockResolvedValue(undefined),
}));

import { revokeSession } from "@/server/auth/sessions";
import {
    SESSION_COOKIE_NAME,
    clearSessionCookieHeader,
    logout,
} from "@/server/auth/logout";

const ORIGINAL_NODE_ENV = process.env.NODE_ENV;

afterEach(() => {
    process.env.NODE_ENV = ORIGINAL_NODE_ENV;
});

describe("logout(sessionId)", () => {
    beforeEach(() => {
        vi.mocked(revokeSession).mockClear();
    });

    it("delega para revokeSession exatamente uma vez com o sessionId recebido", async () => {
        await logout("session-abc");
        expect(revokeSession).toHaveBeenCalledTimes(1);
        expect(revokeSession).toHaveBeenCalledWith("session-abc");
    });

    it("é idempotente: chamadas repetidas não lançam e propagam o sessionId", async () => {
        await logout("session-xyz");
        await logout("session-xyz");
        expect(revokeSession).toHaveBeenCalledTimes(2);
        expect(vi.mocked(revokeSession).mock.calls).toEqual([
            ["session-xyz"],
            ["session-xyz"],
        ]);
    });

    it("propaga o erro quando revokeSession rejeita", async () => {
        vi.mocked(revokeSession).mockRejectedValueOnce(new Error("db down"));
        await expect(logout("session-err")).rejects.toThrow("db down");
    });
});

describe("clearSessionCookieHeader()", () => {
    function parse(cookie: string): {
        nameValue: string;
        attrs: Map<string, string | true>;
    } {
        const [nameValue, ...rest] = cookie.split(";").map((part) => part.trim());
        const attrs = new Map<string, string | true>();
        for (const part of rest) {
            const eqIndex = part.indexOf("=");
            if (eqIndex === -1) {
                attrs.set(part.toLowerCase(), true);
            } else {
                attrs.set(
                    part.slice(0, eqIndex).toLowerCase(),
                    part.slice(eqIndex + 1),
                );
            }
        }
        return { nameValue, attrs };
    }

    it("zera o valor do cookie de sessão e usa Max-Age=0", () => {
        const header = clearSessionCookieHeader();
        const { nameValue, attrs } = parse(header);
        expect(nameValue).toBe(`${SESSION_COOKIE_NAME}=`);
        expect(attrs.get("max-age")).toBe("0");
    });

    it("preserva Path=/, HttpOnly e SameSite=Lax", () => {
        const header = clearSessionCookieHeader();
        const { attrs } = parse(header);
        expect(attrs.get("path")).toBe("/");
        expect(attrs.get("httponly")).toBe(true);
        expect(attrs.get("samesite")).toBe("Lax");
    });

    it("não inclui Secure fora de produção", () => {
        process.env.NODE_ENV = "test";
        const header = clearSessionCookieHeader();
        const { attrs } = parse(header);
        expect(attrs.has("secure")).toBe(false);
    });

    it("inclui Secure quando NODE_ENV=production", () => {
        process.env.NODE_ENV = "production";
        const header = clearSessionCookieHeader();
        const { attrs } = parse(header);
        expect(attrs.has("secure")).toBe(true);
    });

    it("usa o nome de cookie SESSION_COOKIE_NAME exportado pelo módulo", () => {
        const header = clearSessionCookieHeader();
        expect(header.startsWith(`${SESSION_COOKIE_NAME}=;`)).toBe(true);
    });
});
