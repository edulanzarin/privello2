/**
 * Unit test do resumo semanal in-site (W3).
 *
 * Cobre:
 *   1. Não envia se já houve RESUMO_SEMANAL nos últimos 7 dias
 *      (guarda de cadência).
 *   2. Não envia quando não há atividade nenhuma (evita ruído).
 *   3. Envia com payload agregado correto quando há atividade.
 *   4. Best-effort: falha num perfil não derruba os demais.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const stores = vi.hoisted(() => ({
    perfis: [] as Array<{ userId: string }>,
    ultimoResumoPorUser: new Map<string, boolean>(),
    dailySumPorUser: new Map<string, { views: number; likes: number }>(),
    favoritosPorUser: new Map<string, number>(),
    pendentesPorUser: new Map<string, number>(),
    failAggFor: new Set<string>(),
    criadas: [] as Array<{ userId: string; type: string; payload: unknown }>,
}));

vi.mock("@/lib/db", () => ({
    db: {
        acompanhanteProfile: {
            async findMany() {
                return stores.perfis.map((p) => ({ ...p }));
            },
        },
        notification: {
            async findFirst({ where }: { where: { userId: string } }) {
                return stores.ultimoResumoPorUser.get(where.userId)
                    ? { id: "n-old" }
                    : null;
            },
        },
        profileDailyStat: {
            async aggregate({ where }: { where: { userId: string } }) {
                if (stores.failAggFor.has(where.userId)) {
                    throw new Error("agg falhou");
                }
                const s = stores.dailySumPorUser.get(where.userId) ?? {
                    views: 0,
                    likes: 0,
                };
                return { _sum: { views: s.views, likes: s.likes } };
            },
        },
        clientFavorite: {
            async count({ where }: { where: { acompanhanteUserId: string } }) {
                return stores.favoritosPorUser.get(where.acompanhanteUserId) ?? 0;
            },
        },
        acompanhanteQuestion: {
            async count({ where }: { where: { targetUserId: string } }) {
                return stores.pendentesPorUser.get(where.targetUserId) ?? 0;
            },
        },
    },
}));

vi.mock("@/server/notifications", () => ({
    async criarNotificacao(input: {
        userId: string;
        type: string;
        payload: unknown;
    }) {
        stores.criadas.push(input);
        return "n-new";
    },
}));

import { enviarResumosSemanais } from "@/server/notifications/resumoSemanal";

const NOW = new Date("2026-05-31T12:00:00.000Z");

beforeEach(() => {
    stores.perfis = [];
    stores.ultimoResumoPorUser = new Map();
    stores.dailySumPorUser = new Map();
    stores.favoritosPorUser = new Map();
    stores.pendentesPorUser = new Map();
    stores.failAggFor = new Set();
    stores.criadas = [];
});

describe("enviarResumosSemanais", () => {
    it("pula quem já recebeu resumo nos últimos 7 dias", async () => {
        stores.perfis = [{ userId: "a" }];
        stores.ultimoResumoPorUser.set("a", true);
        stores.dailySumPorUser.set("a", { views: 50, likes: 5 });

        const r = await enviarResumosSemanais({ now: NOW });
        expect(r.enviados).toBe(0);
        expect(stores.criadas).toHaveLength(0);
    });

    it("não envia quando não há atividade alguma", async () => {
        stores.perfis = [{ userId: "a" }];
        // tudo zero
        const r = await enviarResumosSemanais({ now: NOW });
        expect(r.enviados).toBe(0);
        expect(stores.criadas).toHaveLength(0);
    });

    it("envia com payload agregado quando há atividade", async () => {
        stores.perfis = [{ userId: "a" }];
        stores.dailySumPorUser.set("a", { views: 42, likes: 7 });
        stores.favoritosPorUser.set("a", 3);
        stores.pendentesPorUser.set("a", 2);

        const r = await enviarResumosSemanais({ now: NOW });
        expect(r.enviados).toBe(1);
        expect(stores.criadas).toHaveLength(1);
        expect(stores.criadas[0].type).toBe("RESUMO_SEMANAL");
        expect(stores.criadas[0].payload).toEqual({
            visitas: 42,
            curtidas: 7,
            novosFavoritos: 3,
            perguntasPendentes: 2,
        });
    });

    it("best-effort: falha num perfil não impede os outros", async () => {
        stores.perfis = [{ userId: "a" }, { userId: "b" }];
        stores.failAggFor.add("a");
        stores.dailySumPorUser.set("b", { views: 10, likes: 0 });

        const r = await enviarResumosSemanais({ now: NOW });
        expect(r.enviados).toBe(1);
        expect(stores.criadas.map((c) => c.userId)).toEqual(["b"]);
    });
});
