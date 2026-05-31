/**
 * Unit test das métricas rápidas do admin (W8).
 *
 * Cobre:
 *   1. Mapeia cada count pro campo certo do retorno.
 *   2. Filtro de boost usa `boostUntil > now`.
 *
 * Mocka `@/lib/db` com counters parametrizados por "tabela".
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const stores = vi.hoisted(() => ({
    verificationPendentes: 0,
    reportsPendentes: 0,
    perfisAtivos: 0,
    perfisVerificados: 0,
    boostsAtivos: 0,
    clientes: 0,
    boostWhereRecebido: null as unknown,
}));

vi.mock("@/lib/db", () => ({
    db: {
        verification: {
            async count() {
                return stores.verificationPendentes;
            },
        },
        report: {
            async count() {
                return stores.reportsPendentes;
            },
        },
        user: {
            async count() {
                return stores.clientes;
            },
        },
        acompanhanteProfile: {
            async count({
                where,
            }: {
                where: { verificada?: boolean; boostUntil?: unknown };
            }) {
                if (where.verificada === true) return stores.perfisVerificados;
                if (where.boostUntil !== undefined) {
                    stores.boostWhereRecebido = where.boostUntil;
                    return stores.boostsAtivos;
                }
                return stores.perfisAtivos;
            },
        },
    },
}));

import { obterMetricasAdmin } from "@/server/admin/metricas";

beforeEach(() => {
    stores.verificationPendentes = 0;
    stores.reportsPendentes = 0;
    stores.perfisAtivos = 0;
    stores.perfisVerificados = 0;
    stores.boostsAtivos = 0;
    stores.clientes = 0;
    stores.boostWhereRecebido = null;
});

describe("obterMetricasAdmin", () => {
    it("mapeia cada contador pro campo certo", async () => {
        stores.verificationPendentes = 3;
        stores.reportsPendentes = 2;
        stores.perfisAtivos = 42;
        stores.perfisVerificados = 18;
        stores.boostsAtivos = 5;
        stores.clientes = 100;

        const m = await obterMetricasAdmin();
        expect(m).toEqual({
            verificacoesPendentes: 3,
            denunciasPendentes: 2,
            perfisAtivos: 42,
            perfisVerificados: 18,
            clientes: 100,
            boostsAtivos: 5,
        });
    });

    it("filtro de boost usa boostUntil > now", async () => {
        const now = new Date("2026-05-31T12:00:00.000Z");
        await obterMetricasAdmin({ now });
        expect(stores.boostWhereRecebido).toEqual({ gt: now });
    });
});
