/**
 * Unit test do geocoding por região (T14).
 *
 * `geocodificarRegiao` resolve o centroide do bairro (ou da cidade
 * no fallback), sem jitter — perfis do mesmo bairro caem no mesmo
 * ponto pra agregação por bairro no mapa.
 *
 *   1. cidade/UF vazios → null (sem chamar fetch).
 *   2. com bairro: resolve o centroide do bairro (nivel=BAIRRO).
 *   3. bairro não encontrado → cai pro centro da cidade (nivel=CIDADE).
 *   4. sem bairro → centro da cidade direto.
 *   5. nada encontrado → null.
 *   6. erro de rede → null (best-effort).
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import { geocodificarRegiao } from "@/lib/geocode";

describe("geocodificarRegiao", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("cidade ou UF vazios → null sem chamar fetch", async () => {
        const spy = vi.spyOn(globalThis, "fetch");
        expect(
            await geocodificarRegiao({ cidadeNome: "", estadoSigla: "RJ" }),
        ).toBe(null);
        expect(
            await geocodificarRegiao({ cidadeNome: "Rio", estadoSigla: "" }),
        ).toBe(null);
        expect(spy).not.toHaveBeenCalled();
    });

    it("com bairro: resolve o centroide do bairro (nivel BAIRRO)", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue(
            jsonResponse([{ lat: "-22.95", lon: "-43.18" }]),
        );
        const out = await geocodificarRegiao({
            cidadeNome: "Rio de Janeiro",
            estadoSigla: "RJ",
            bairroNome: "Copacabana",
        });
        expect(out).not.toBe(null);
        expect(out?.lat).toBeCloseTo(-22.95, 6);
        expect(out?.lng).toBeCloseTo(-43.18, 6);
        expect(out?.nivel).toBe("BAIRRO");
    });

    it("bairro não encontrado → cai pro centro da cidade (nivel CIDADE)", async () => {
        const fetchMock = vi
            .spyOn(globalThis, "fetch")
            .mockResolvedValueOnce(jsonResponse([])) // bairro: vazio
            .mockResolvedValueOnce(
                jsonResponse([{ lat: "-23.0", lon: "-43.0" }]),
            ); // cidade: acha
        const out = await geocodificarRegiao({
            cidadeNome: "Rio de Janeiro",
            estadoSigla: "RJ",
            bairroNome: "BairroInexistente",
        });
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(out?.lat).toBeCloseTo(-23.0, 6);
        expect(out?.nivel).toBe("CIDADE");
    });

    it("sem bairro → centro da cidade direto (1 chamada)", async () => {
        const fetchMock = vi
            .spyOn(globalThis, "fetch")
            .mockResolvedValue(jsonResponse([{ lat: "-23.5", lon: "-46.6" }]));
        const out = await geocodificarRegiao({
            cidadeNome: "São Paulo",
            estadoSigla: "SP",
        });
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(out?.nivel).toBe("CIDADE");
    });

    it("nada encontrado → null", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse([]));
        const out = await geocodificarRegiao({
            cidadeNome: "CidadeFantasma",
            estadoSigla: "ZZ",
        });
        expect(out).toBe(null);
    });

    it("erro de rede → null (best-effort)", async () => {
        vi.spyOn(globalThis, "fetch").mockRejectedValue(
            new Error("network down"),
        );
        const out = await geocodificarRegiao({
            cidadeNome: "Rio",
            estadoSigla: "RJ",
        });
        expect(out).toBe(null);
    });
});

function jsonResponse(body: unknown): Response {
    return {
        ok: true,
        async json() {
            return body;
        },
    } as unknown as Response;
}
