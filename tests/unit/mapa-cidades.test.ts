/**
 * Unit test da agregação por cidade do mapa nacional.
 *
 * `listarCidadesParaMapa` agrupa perfis geocodificados por
 * `(cidade, UF)` e devolve `{ cidadeNome, estadoSigla, lat, lng,
 * count }` — um marcador por cidade pro mapa exibido quando nenhuma
 * cidade está selecionada.
 *
 *   1. agrupa perfis da mesma cidade e conta.
 *   2. lat/lng = média das coordenadas dos perfis da cidade.
 *   3. ordena por count desc.
 *   4. agrupa case-insensitive por cidade/UF.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

interface Row {
    lat: number | null;
    lng: number | null;
    cidadeNome: string;
    estadoSigla: string;
}

const stores = vi.hoisted(() => ({
    rows: [] as Row[],
}));

vi.mock("@/lib/db", () => {
    return {
        db: {
            acompanhanteProfile: {
                async findMany() {
                    return stores.rows.map((r) => ({ ...r }));
                },
            },
        },
    };
});

import { listarCidadesParaMapa } from "@/server/acompanhante-profile/buscar";

beforeEach(() => {
    stores.rows = [];
});

describe("listarCidadesParaMapa", () => {
    it("agrupa por cidade e conta; ordena por count desc", async () => {
        stores.rows = [
            { lat: -26.9, lng: -49.06, cidadeNome: "Blumenau", estadoSigla: "SC" },
            { lat: -26.92, lng: -49.08, cidadeNome: "Blumenau", estadoSigla: "SC" },
            { lat: -26.91, lng: -49.07, cidadeNome: "Blumenau", estadoSigla: "SC" },
            { lat: -25.43, lng: -49.27, cidadeNome: "Curitiba", estadoSigla: "PR" },
        ];

        const out = await listarCidadesParaMapa({ filtros: {} });
        expect(out).toHaveLength(2);
        // Maior primeiro.
        expect(out[0]?.cidadeNome).toBe("Blumenau");
        expect(out[0]?.count).toBe(3);
        expect(out[1]?.cidadeNome).toBe("Curitiba");
        expect(out[1]?.count).toBe(1);
    });

    it("lat/lng é a média das coordenadas da cidade", async () => {
        stores.rows = [
            { lat: -26.9, lng: -49.0, cidadeNome: "Blumenau", estadoSigla: "SC" },
            { lat: -26.8, lng: -49.2, cidadeNome: "Blumenau", estadoSigla: "SC" },
        ];
        const out = await listarCidadesParaMapa({ filtros: {} });
        expect(out).toHaveLength(1);
        expect(out[0]?.lat).toBeCloseTo(-26.85, 5);
        expect(out[0]?.lng).toBeCloseTo(-49.1, 5);
    });

    it("agrupa cidade/UF case-insensitive", async () => {
        stores.rows = [
            { lat: -25.43, lng: -49.27, cidadeNome: "Curitiba", estadoSigla: "PR" },
            { lat: -25.44, lng: -49.28, cidadeNome: "curitiba", estadoSigla: "pr" },
        ];
        const out = await listarCidadesParaMapa({ filtros: {} });
        expect(out).toHaveLength(1);
        expect(out[0]?.count).toBe(2);
    });

    it("ignora linhas sem coordenada", async () => {
        stores.rows = [
            { lat: null, lng: null, cidadeNome: "Curitiba", estadoSigla: "PR" },
            { lat: -25.43, lng: -49.27, cidadeNome: "Curitiba", estadoSigla: "PR" },
        ];
        const out = await listarCidadesParaMapa({ filtros: {} });
        expect(out).toHaveLength(1);
        expect(out[0]?.count).toBe(1);
    });
});
