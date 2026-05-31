/**
 * Unit test da agregação por bairro do mapa (T14).
 *
 * `listarBairrosParaMapa` agrupa perfis geocodificados por
 * coordenada (centroide do bairro) e devolve `{ label, lat, lng,
 * count, cidadeFallback }` — um marcador por bairro, sem info de
 * perfil individual.
 *
 *   1. agrupa perfis do mesmo bairro (mesma coord) num só item.
 *   2. count correto por bairro.
 *   3. label = nome do bairro.
 *   4. perfis sem bairro → cidadeFallback=true, label=cidade.
 *   5. ordena por count desc.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

interface Row {
    lat: number | null;
    lng: number | null;
    bairroNome: string | null;
    cidadeNome: string;
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

import { listarBairrosParaMapa } from "@/server/acompanhante-profile/buscar";

beforeEach(() => {
    stores.rows = [];
});

describe("listarBairrosParaMapa", () => {
    it("agrupa perfis do mesmo bairro e conta", async () => {
        // 3 na Água Verde (mesmo centroide), 2 na Velha.
        stores.rows = [
            { lat: -25.45, lng: -49.28, bairroNome: "Água Verde", cidadeNome: "Curitiba" },
            { lat: -25.45, lng: -49.28, bairroNome: "Água Verde", cidadeNome: "Curitiba" },
            { lat: -25.45, lng: -49.28, bairroNome: "Água Verde", cidadeNome: "Curitiba" },
            { lat: -26.91, lng: -49.06, bairroNome: "Velha", cidadeNome: "Blumenau" },
            { lat: -26.91, lng: -49.06, bairroNome: "Velha", cidadeNome: "Blumenau" },
        ];

        const out = await listarBairrosParaMapa({ filtros: {} });
        expect(out).toHaveLength(2);

        const agua = out.find((b) => b.label === "Água Verde");
        const velha = out.find((b) => b.label === "Velha");
        expect(agua?.count).toBe(3);
        expect(velha?.count).toBe(2);
        expect(agua?.cidadeFallback).toBe(false);
    });

    it("perfis sem bairro → fallback no centro da cidade", async () => {
        stores.rows = [
            { lat: -23.55, lng: -46.63, bairroNome: null, cidadeNome: "São Paulo" },
            { lat: -23.55, lng: -46.63, bairroNome: null, cidadeNome: "São Paulo" },
        ];
        const out = await listarBairrosParaMapa({ filtros: {} });
        expect(out).toHaveLength(1);
        expect(out[0]?.label).toBe("São Paulo");
        expect(out[0]?.cidadeFallback).toBe(true);
        expect(out[0]?.count).toBe(2);
    });

    it("ordena por count desc", async () => {
        stores.rows = [
            { lat: -1, lng: -1, bairroNome: "A", cidadeNome: "X" },
            { lat: -2, lng: -2, bairroNome: "B", cidadeNome: "X" },
            { lat: -2, lng: -2, bairroNome: "B", cidadeNome: "X" },
            { lat: -2, lng: -2, bairroNome: "B", cidadeNome: "X" },
        ];
        const out = await listarBairrosParaMapa({ filtros: {} });
        expect(out[0]?.label).toBe("B");
        expect(out[0]?.count).toBe(3);
        expect(out[1]?.label).toBe("A");
    });

    it("ignora linhas sem coordenada", async () => {
        stores.rows = [
            { lat: null, lng: null, bairroNome: "Sem geo", cidadeNome: "X" },
            { lat: -1, lng: -1, bairroNome: "Com geo", cidadeNome: "X" },
        ];
        const out = await listarBairrosParaMapa({ filtros: {} });
        expect(out).toHaveLength(1);
        expect(out[0]?.label).toBe("Com geo");
    });

    it("não devolve nenhuma info de perfil individual", async () => {
        stores.rows = [
            { lat: -1, lng: -1, bairroNome: "A", cidadeNome: "X" },
        ];
        const out = await listarBairrosParaMapa({ filtros: {} });
        const keys = Object.keys(out[0] ?? {}).sort();
        // Só label/lat/lng/count/cidadeFallback — sem identificador,
        // nome, fotoUrl, etc.
        expect(keys).toEqual(
            ["cidadeFallback", "count", "label", "lat", "lng"].sort(),
        );
    });
});
