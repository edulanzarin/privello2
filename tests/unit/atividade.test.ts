/**
 * Unit test da presença "ativa recentemente" (W2).
 *
 * Cobre:
 *   1. lista vazia → Set vazio (sem query).
 *   2. devolve só userIds com sessão dentro da janela de 24h.
 *   3. falha no DB → Set vazio (best-effort).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

interface SessionRow {
    userId: string;
    lastSeenAt: Date;
}

const stores = vi.hoisted(() => ({
    sessions: [] as SessionRow[],
    fail: { value: false },
}));

vi.mock("@/lib/db", () => ({
    db: {
        session: {
            async groupBy({
                where,
            }: {
                by: string[];
                where: {
                    userId: { in: string[] };
                    lastSeenAt: { gte: Date };
                };
            }) {
                if (stores.fail.value) throw new Error("db down");
                const ids = new Set(where.userId.in);
                const recent = new Set<string>();
                for (const s of stores.sessions) {
                    if (
                        ids.has(s.userId) &&
                        s.lastSeenAt.getTime() >= where.lastSeenAt.gte.getTime()
                    ) {
                        recent.add(s.userId);
                    }
                }
                return Array.from(recent).map((userId) => ({ userId }));
            },
        },
    },
}));

import { obterAtividadeRecente } from "@/server/acompanhante-profile/atividade";

const NOW = new Date("2026-05-31T12:00:00.000Z");

beforeEach(() => {
    stores.sessions = [];
    stores.fail.value = false;
});

describe("obterAtividadeRecente", () => {
    it("lista vazia → Set vazio", async () => {
        const r = await obterAtividadeRecente([], { now: NOW });
        expect(r.size).toBe(0);
    });

    it("devolve só quem teve sessão nas últimas 24h", async () => {
        stores.sessions = [
            // ativa há 1h → conta
            { userId: "a", lastSeenAt: new Date(NOW.getTime() - 3_600_000) },
            // ativa há 30h → não conta
            {
                userId: "b",
                lastSeenAt: new Date(NOW.getTime() - 30 * 3_600_000),
            },
        ];
        const r = await obterAtividadeRecente(["a", "b", "c"], { now: NOW });
        expect(r.has("a")).toBe(true);
        expect(r.has("b")).toBe(false);
        expect(r.has("c")).toBe(false);
        expect(r.size).toBe(1);
    });

    it("falha no DB → Set vazio (best-effort)", async () => {
        stores.fail.value = true;
        stores.sessions = [
            { userId: "a", lastSeenAt: NOW },
        ];
        const r = await obterAtividadeRecente(["a"], { now: NOW });
        expect(r.size).toBe(0);
    });
});
