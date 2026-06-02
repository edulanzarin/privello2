/**
 * Unit test do Boost programado (T09).
 *
 * Parte 1 — domínio `normalizarBoostStartAt` (puro, sem mock):
 *   - null/undefined/"" → imediato.
 *   - data inválida → invalido DATA_INVALIDA.
 *   - passado ou quase-agora (< 5min) → imediato.
 *   - > 30 dias → invalido FORA_DA_JANELA.
 *   - dentro da janela → agendado.
 *
 * Parte 2 — service `ativarBoostsAgendados` (mock de @/lib/db):
 *   - ativa boost APPROVED com startAt no passado e activatesAt null.
 *   - ignora boost com startAt no futuro.
 *   - ignora boost já ativado (activatesAt != null).
 *   - estende boostUntil cumulativamente.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
    BOOST_DURATION_MS,
    normalizarBoostStartAt,
} from "@/domain/boost/definitions";

// ---------------------------------------------------------------------------
// Parte 1 — domínio puro
// ---------------------------------------------------------------------------

describe("normalizarBoostStartAt", () => {
    const now = new Date("2026-06-01T12:00:00.000Z");

    it("null/undefined/'' → imediato", () => {
        expect(normalizarBoostStartAt(null, now)).toEqual({ kind: "imediato" });
        expect(normalizarBoostStartAt(undefined, now)).toEqual({
            kind: "imediato",
        });
        expect(normalizarBoostStartAt("", now)).toEqual({ kind: "imediato" });
    });

    it("data inválida → invalido DATA_INVALIDA", () => {
        expect(normalizarBoostStartAt("não-é-data", now)).toEqual({
            kind: "invalido",
            reason: "DATA_INVALIDA",
        });
    });

    it("passado → imediato", () => {
        const ontem = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        expect(normalizarBoostStartAt(ontem, now)).toEqual({
            kind: "imediato",
        });
    });

    it("daqui a 2min (< 5min) → imediato", () => {
        const quase = new Date(now.getTime() + 2 * 60 * 1000);
        expect(normalizarBoostStartAt(quase, now)).toEqual({
            kind: "imediato",
        });
    });

    it("daqui a 31 dias → invalido FORA_DA_JANELA", () => {
        const distante = new Date(now.getTime() + 31 * 24 * 60 * 60 * 1000);
        expect(normalizarBoostStartAt(distante, now)).toEqual({
            kind: "invalido",
            reason: "FORA_DA_JANELA",
        });
    });

    it("daqui a 2 dias → agendado", () => {
        const futuro = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
        const r = normalizarBoostStartAt(futuro, now);
        expect(r.kind).toBe("agendado");
        if (r.kind === "agendado") {
            expect(r.startAt.getTime()).toBe(futuro.getTime());
        }
    });

    it("aceita ISO string dentro da janela", () => {
        const r = normalizarBoostStartAt("2026-06-03T18:00:00.000Z", now);
        expect(r.kind).toBe("agendado");
    });
});

// ---------------------------------------------------------------------------
// Parte 2 — service ativarBoostsAgendados
// ---------------------------------------------------------------------------

interface BoostRow {
    id: string;
    userId: string;
    status: string;
    startAt: Date | null;
    activatesAt: Date | null;
    expiresAt: Date | null;
}

interface ProfileRow {
    userId: string;
    boostUntil: Date | null;
}

const stores = vi.hoisted(() => ({
    boosts: new Map<string, {
        id: string;
        userId: string;
        status: string;
        startAt: Date | null;
        activatesAt: Date | null;
        expiresAt: Date | null;
    }>(),
    profiles: new Map<string, { userId: string; boostUntil: Date | null }>(),
}));

vi.mock("@/lib/payments/stripe", () => ({
    StripeError: class extends Error {},
    createStripeClient: () => ({
        isConfigured: () => false,
    }),
}));

vi.mock("@/lib/db", () => {
    const boostPayment = {
        async findMany({
            where,
        }: {
            where: {
                status?: string;
                activatesAt?: null;
                startAt?: { not: null; lte: Date };
            };
        }) {
            const out: BoostRow[] = [];
            for (const row of stores.boosts.values()) {
                if (where.status && row.status !== where.status) continue;
                if (
                    where.activatesAt === null &&
                    row.activatesAt !== null
                )
                    continue;
                if (where.startAt) {
                    if (row.startAt === null) continue;
                    if (row.startAt.getTime() > where.startAt.lte.getTime())
                        continue;
                }
                out.push({ ...row });
            }
            return out.map((r) => ({ id: r.id, userId: r.userId }));
        },
        async findUnique({
            where,
            select,
        }: {
            where: { id: string };
            select?: Partial<Record<keyof BoostRow, boolean>>;
        }) {
            const row = stores.boosts.get(where.id);
            if (!row) return null;
            if (!select) return { ...row };
            const out: Partial<BoostRow> = {};
            for (const k of Object.keys(select) as (keyof BoostRow)[]) {
                if (select[k]) (out as Record<string, unknown>)[k] = row[k];
            }
            return out;
        },
        async update({
            where,
            data,
        }: {
            where: { id: string };
            data: { activatesAt?: Date; expiresAt?: Date };
        }) {
            const row = stores.boosts.get(where.id);
            if (!row) throw new Error("boost not found");
            if (data.activatesAt !== undefined) row.activatesAt = data.activatesAt;
            if (data.expiresAt !== undefined) row.expiresAt = data.expiresAt;
            stores.boosts.set(where.id, row);
            return { ...row };
        },
    };
    const acompanhanteProfile = {
        async findUnique({
            where,
            select,
        }: {
            where: { userId: string };
            select?: Partial<Record<keyof ProfileRow, boolean>>;
        }) {
            const row = stores.profiles.get(where.userId);
            if (!row) return null;
            if (!select) return { ...row };
            const out: Partial<ProfileRow> = {};
            for (const k of Object.keys(select) as (keyof ProfileRow)[]) {
                if (select[k]) (out as Record<string, unknown>)[k] = row[k];
            }
            return out;
        },
        async update({
            where,
            data,
        }: {
            where: { userId: string };
            data: { boostUntil?: Date };
        }) {
            const row = stores.profiles.get(where.userId);
            if (!row) throw new Error("profile not found");
            if (data.boostUntil !== undefined) row.boostUntil = data.boostUntil;
            stores.profiles.set(where.userId, row);
            return { ...row };
        },
    };
    return {
        db: {
            boostPayment,
            acompanhanteProfile,
            async $transaction<T>(fn: (tx: unknown) => Promise<T>): Promise<T> {
                return fn({ boostPayment, acompanhanteProfile });
            },
        },
    };
});

import { ativarBoostsAgendados } from "@/server/boost";

function seedProfile(userId: string, boostUntil: Date | null): void {
    stores.profiles.set(userId, { userId, boostUntil });
}

function seedBoost(
    id: string,
    userId: string,
    opts: Partial<{
        status: string;
        startAt: Date | null;
        activatesAt: Date | null;
    }> = {},
): void {
    stores.boosts.set(id, {
        id,
        userId,
        status: opts.status ?? "APPROVED",
        startAt: opts.startAt ?? null,
        activatesAt: opts.activatesAt ?? null,
        expiresAt: null,
    });
}

beforeEach(() => {
    stores.boosts.clear();
    stores.profiles.clear();
});

describe("ativarBoostsAgendados", () => {
    const now = new Date("2026-06-10T18:00:00.000Z");

    it("ativa boost agendado cujo startAt já passou", async () => {
        seedProfile("u1", null);
        seedBoost("b1", "u1", {
            startAt: new Date(now.getTime() - 60_000), // 1min atrás
        });

        const r = await ativarBoostsAgendados({ now });
        expect(r.ativados).toBe(1);

        const profile = stores.profiles.get("u1");
        const expected = now.getTime() + BOOST_DURATION_MS;
        expect(profile?.boostUntil?.getTime()).toBe(expected);

        const boost = stores.boosts.get("b1");
        expect(boost?.activatesAt?.getTime()).toBe(now.getTime());
        expect(boost?.expiresAt?.getTime()).toBe(expected);
    });

    it("ignora boost com startAt no futuro", async () => {
        seedProfile("u1", null);
        seedBoost("b1", "u1", {
            startAt: new Date(now.getTime() + 60 * 60 * 1000), // 1h no futuro
        });

        const r = await ativarBoostsAgendados({ now });
        expect(r.ativados).toBe(0);
        expect(stores.profiles.get("u1")?.boostUntil).toBe(null);
    });

    it("ignora boost já ativado (activatesAt != null)", async () => {
        seedProfile("u1", null);
        seedBoost("b1", "u1", {
            startAt: new Date(now.getTime() - 60_000),
            activatesAt: new Date(now.getTime() - 30_000),
        });

        const r = await ativarBoostsAgendados({ now });
        expect(r.ativados).toBe(0);
    });

    it("ignora boost PENDING (não aprovado)", async () => {
        seedProfile("u1", null);
        seedBoost("b1", "u1", {
            status: "PENDING",
            startAt: new Date(now.getTime() - 60_000),
        });

        const r = await ativarBoostsAgendados({ now });
        expect(r.ativados).toBe(0);
    });

    it("estende boostUntil cumulativamente quando já há janela ativa", async () => {
        const janelaAtual = new Date(now.getTime() + 6 * 60 * 60 * 1000); // +6h
        seedProfile("u1", janelaAtual);
        seedBoost("b1", "u1", {
            startAt: new Date(now.getTime() - 60_000),
        });

        await ativarBoostsAgendados({ now });
        // Cumulativo: parte do fim da janela atual, + 24h.
        const expected = janelaAtual.getTime() + BOOST_DURATION_MS;
        expect(stores.profiles.get("u1")?.boostUntil?.getTime()).toBe(expected);
    });

    it("ativa múltiplos boosts de donos diferentes", async () => {
        seedProfile("u1", null);
        seedProfile("u2", null);
        seedBoost("b1", "u1", { startAt: new Date(now.getTime() - 1000) });
        seedBoost("b2", "u2", { startAt: new Date(now.getTime() - 1000) });

        const r = await ativarBoostsAgendados({ now });
        expect(r.ativados).toBe(2);
        expect(stores.profiles.get("u1")?.boostUntil).not.toBe(null);
        expect(stores.profiles.get("u2")?.boostUntil).not.toBe(null);
    });
});
