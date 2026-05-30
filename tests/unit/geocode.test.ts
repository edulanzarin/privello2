/**
 * Unit test do geocoding aproximado (T14).
 *
 * Foca na parte pura/determinística: `aplicarJitter` e o fluxo de
 * `geocodificarAproximado` com `fetch` mockado (sem rede real).
 *   1. aplicarJitter desloca dentro de [-amp, +amp] e clampa.
 *   2. geocodificarAproximado: cidade/UF vazios → null.
 *   3. tenta bairro primeiro, cai pra cidade quando bairro não acha.
 *   4. retorna null quando nada acha.
 *   5. aplica jitter por cima do centroide retornado.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import {
    aplicarJitter,
    geocodificarAproximado,
    GEOCODE_JITTER_DEG,
} from "@/lib/geocode";

describe("aplicarJitter", () => {
    it("rng=0.5 (centro) não desloca", () => {
        const base = { lat: -22.9, lng: -43.2 };
        const out = aplicarJitter(base, 0.01, () => 0.5);
        expect(out.lat).toBeCloseTo(-22.9, 10);
        expect(out.lng).toBeCloseTo(-43.2, 10);
    });

    it("rng=0 desloca -amp nas duas coords", () => {
        const base = { lat: 0, lng: 0 };
        const out = aplicarJitter(base, 0.01, () => 0);
        expect(out.lat).toBeCloseTo(-0.01, 10);
        expect(out.lng).toBeCloseTo(-0.01, 10);
    });

    it("rng→1 desloca +amp", () => {
        const base = { lat: 10, lng: 20 };
        const out = aplicarJitter(base, 0.02, () => 0.999999);
        expect(out.lat).toBeGreaterThan(10);
        expect(out.lat).toBeLessThanOrEqual(10.02);
        expect(out.lng).toBeGreaterThan(20);
    });

    it("clampa latitude em [-90, 90]", () => {
        const out = aplicarJitter({ lat: 89.999, lng: 0 }, 1, () => 1);
        expect(out.lat).toBeLessThanOrEqual(90);
    });

    it("normaliza longitude pra [-180, 180]", () => {
        const out = aplicarJitter({ lat: 0, lng: 179.999 }, 1, () => 1);
        expect(out.lng).toBeLessThanOrEqual(180);
        expect(out.lng).toBeGreaterThanOrEqual(-180);
    });
});

describe("geocodificarAproximado", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("cidade ou UF vazios → null sem chamar fetch", async () => {
        const spy = vi.spyOn(globalThis, "fetch");
        expect(
            await geocodificarAproximado({
                cidadeNome: "",
                estadoSigla: "RJ",
            }),
        ).toBe(null);
        expect(
            await geocodificarAproximado({
                cidadeNome: "Rio",
                estadoSigla: "",
            }),
        ).toBe(null);
        expect(spy).not.toHaveBeenCalled();
    });

    it("acha pelo bairro na 1ª tentativa (com jitter aplicado)", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue(
            jsonResponse([{ lat: "-22.95", lon: "-43.18" }]),
        );
        const out = await geocodificarAproximado({
            cidadeNome: "Rio de Janeiro",
            estadoSigla: "RJ",
            bairroNome: "Copacabana",
            options: { rng: () => 0.5 }, // centro → sem deslocamento
        });
        expect(out).not.toBe(null);
        expect(out?.lat).toBeCloseTo(-22.95, 6);
        expect(out?.lng).toBeCloseTo(-43.18, 6);
    });

    it("cai pra cidade quando bairro não retorna resultado", async () => {
        const fetchMock = vi
            .spyOn(globalThis, "fetch")
            // 1ª chamada (com bairro): vazio.
            .mockResolvedValueOnce(jsonResponse([]))
            // 2ª chamada (só cidade): acha.
            .mockResolvedValueOnce(
                jsonResponse([{ lat: "-23.0", lon: "-43.0" }]),
            );
        const out = await geocodificarAproximado({
            cidadeNome: "Rio de Janeiro",
            estadoSigla: "RJ",
            bairroNome: "BairroInexistente",
            options: { rng: () => 0.5 },
        });
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(out?.lat).toBeCloseTo(-23.0, 6);
    });

    it("retorna null quando nada acha", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse([]));
        const out = await geocodificarAproximado({
            cidadeNome: "CidadeFantasma",
            estadoSigla: "ZZ",
        });
        expect(out).toBe(null);
    });

    it("retorna null em erro de rede (best-effort)", async () => {
        vi.spyOn(globalThis, "fetch").mockRejectedValue(
            new Error("network down"),
        );
        const out = await geocodificarAproximado({
            cidadeNome: "Rio",
            estadoSigla: "RJ",
        });
        expect(out).toBe(null);
    });

    it("jitter real desloca o resultado (rng != 0.5)", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue(
            jsonResponse([{ lat: "-22.95", lon: "-43.18" }]),
        );
        const out = await geocodificarAproximado({
            cidadeNome: "Rio",
            estadoSigla: "RJ",
            options: { rng: () => 0 }, // -amp
        });
        expect(out?.lat).toBeCloseTo(-22.95 - GEOCODE_JITTER_DEG, 6);
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
