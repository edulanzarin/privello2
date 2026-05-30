/**
 * Unit test do domínio de classificação de origem (T10).
 *
 * Funções puras — sem mock de DB/request.
 */

import { describe, expect, it } from "vitest";

import {
    bucketsHeatmap,
    classificarOrigem,
    isViewOrigin,
} from "@/domain/stats/origem";

const HOST = "privello.com";

describe("classificarOrigem", () => {
    it("sem referrer → DIRECT", () => {
        expect(classificarOrigem(null, HOST)).toBe("DIRECT");
        expect(classificarOrigem("", HOST)).toBe("DIRECT");
        expect(classificarOrigem(undefined, HOST)).toBe("DIRECT");
    });

    it("referrer malformado → DIRECT", () => {
        expect(classificarOrigem("não-é-url", HOST)).toBe("DIRECT");
    });

    it("referrer externo → COMPARTILHADO", () => {
        expect(
            classificarOrigem("https://instagram.com/alguem", HOST),
        ).toBe("COMPARTILHADO");
        expect(
            classificarOrigem("https://www.google.com/search?q=x", HOST),
        ).toBe("COMPARTILHADO");
        expect(
            classificarOrigem("https://wa.me/", HOST),
        ).toBe("COMPARTILHADO");
    });

    it("home interna → HOME", () => {
        expect(classificarOrigem(`https://${HOST}/`, HOST)).toBe("HOME");
        expect(classificarOrigem(`https://${HOST}`, HOST)).toBe("HOME");
    });

    it("busca interna → BUSCA", () => {
        expect(
            classificarOrigem(`https://${HOST}/acompanhantes`, HOST),
        ).toBe("BUSCA");
        expect(
            classificarOrigem(
                `https://${HOST}/acompanhantes?cidade=Rio&uf=RJ`,
                HOST,
            ),
        ).toBe("BUSCA");
        expect(
            classificarOrigem(`https://${HOST}/acompanhantes/`, HOST),
        ).toBe("BUSCA");
    });

    it("perfil individual interno → DIRECT (não é busca)", () => {
        expect(
            classificarOrigem(`https://${HOST}/acompanhantes/joana`, HOST),
        ).toBe("DIRECT");
    });

    it("outra página interna → DIRECT", () => {
        expect(
            classificarOrigem(`https://${HOST}/cliente`, HOST),
        ).toBe("DIRECT");
    });

    it("siteHost ausente → qualquer referrer vira COMPARTILHADO", () => {
        expect(
            classificarOrigem(`https://${HOST}/acompanhantes`, null),
        ).toBe("COMPARTILHADO");
    });

    it("compara host case-insensitive", () => {
        expect(
            classificarOrigem(`https://PRIVELLO.com/`, "privello.com"),
        ).toBe("HOME");
    });

    it("funciona com host:porta (localhost dev)", () => {
        expect(
            classificarOrigem(
                "http://localhost:3000/acompanhantes",
                "localhost:3000",
            ),
        ).toBe("BUSCA");
    });
});

describe("isViewOrigin", () => {
    it("aceita os 4 valores", () => {
        expect(isViewOrigin("BUSCA")).toBe(true);
        expect(isViewOrigin("HOME")).toBe(true);
        expect(isViewOrigin("DIRECT")).toBe(true);
        expect(isViewOrigin("COMPARTILHADO")).toBe(true);
    });
    it("rejeita inválidos", () => {
        expect(isViewOrigin("busca")).toBe(false);
        expect(isViewOrigin("")).toBe(false);
        expect(isViewOrigin(null)).toBe(false);
        expect(isViewOrigin(42)).toBe(false);
    });
});

describe("bucketsHeatmap", () => {
    it("extrai weekday (UTC) e hour (UTC)", () => {
        // 2026-06-01 é uma segunda-feira. 14:30 UTC.
        const d = new Date("2026-06-01T14:30:00.000Z");
        const { weekday, hour } = bucketsHeatmap(d);
        expect(weekday).toBe(1); // segunda (getUTCDay: dom=0)
        expect(hour).toBe(14);
    });

    it("domingo = 0", () => {
        // 2026-05-31 é domingo.
        const d = new Date("2026-05-31T03:00:00.000Z");
        expect(bucketsHeatmap(d).weekday).toBe(0);
        expect(bucketsHeatmap(d).hour).toBe(3);
    });

    it("sábado = 6, hora 23", () => {
        // 2026-06-06 é sábado.
        const d = new Date("2026-06-06T23:59:00.000Z");
        expect(bucketsHeatmap(d).weekday).toBe(6);
        expect(bucketsHeatmap(d).hour).toBe(23);
    });
});
