/**
 * Unit test do card-imagem de compartilhamento por cidade (V6).
 *
 * Cobre:
 *   1. cidade/uf inválidos → CIDADE_INVALIDA.
 *   2. cidade sem perfis → SEM_RESULTADOS.
 *   3. cidade com perfis (com fotos) → PNG válido 1080×1920 +
 *      etagSeed contendo cidade/uf/contagem.
 *   4. cidade com perfis sem foto → ainda gera PNG (fallback).
 *   5. etagSeed muda quando a contagem muda.
 *
 * Usa sharp de verdade; mocka `@/lib/db` (count + findMany) e o R2
 * via test seam.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";

const stores = vi.hoisted(() => ({
    total: 0,
    fotos: [] as Array<{ fotoPerfil: { storageKey: string } | null }>,
}));

vi.mock("@/lib/db", () => {
    return {
        db: {
            acompanhanteProfile: {
                async count() {
                    return stores.total;
                },
                async findMany() {
                    return stores.fotos.map((f) => ({ ...f }));
                },
            },
        },
    };
});

import {
    __setR2ClientForShareCityTests,
    gerarShareCityCard,
} from "@/server/acompanhante-profile/shareCityCard";
import type { R2Client } from "@/lib/storage/r2";

let fotoBytes: Uint8Array;

const fakeR2: R2Client = {
    async putStaged(key) {
        return { key };
    },
    async commit(_s, finalKey) {
        return { key: finalKey };
    },
    async deleteObject() {},
    async presignedUrl(key) {
        return `https://fake/${key}`;
    },
    async fetch() {
        return fotoBytes;
    },
};

beforeEach(async () => {
    stores.total = 0;
    stores.fotos = [];
    __setR2ClientForShareCityTests(fakeR2);
    fotoBytes = await sharp({
        create: {
            width: 200,
            height: 200,
            channels: 3,
            background: { r: 220, g: 80, b: 60 },
        },
    })
        .jpeg()
        .toBuffer();
});

describe("gerarShareCityCard — validação", () => {
    it("cidade vazia → CIDADE_INVALIDA", async () => {
        const r = await gerarShareCityCard({
            cidadeNome: "  ",
            estadoSigla: "SP",
        });
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.reason).toBe("CIDADE_INVALIDA");
    });

    it("uf inválida (tamanho != 2) → CIDADE_INVALIDA", async () => {
        const r = await gerarShareCityCard({
            cidadeNome: "Curitiba",
            estadoSigla: "Paraná",
        });
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.reason).toBe("CIDADE_INVALIDA");
    });

    it("nenhum perfil na cidade → SEM_RESULTADOS", async () => {
        stores.total = 0;
        const r = await gerarShareCityCard({
            cidadeNome: "Curitiba",
            estadoSigla: "PR",
        });
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.reason).toBe("SEM_RESULTADOS");
    });
});

describe("gerarShareCityCard — sucesso", () => {
    it("com fotos → PNG 1080×1920 + etagSeed com cidade/contagem", async () => {
        stores.total = 7;
        stores.fotos = [
            { fotoPerfil: { storageKey: "a.jpg" } },
            { fotoPerfil: { storageKey: "b.jpg" } },
        ];
        const r = await gerarShareCityCard({
            cidadeNome: "Curitiba",
            estadoSigla: "PR",
        });
        expect(r.ok).toBe(true);
        if (!r.ok) return;

        // Header PNG.
        expect(r.png.subarray(0, 8)).toEqual(
            Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        );
        const meta = await sharp(r.png).metadata();
        expect(meta.width).toBe(1080);
        expect(meta.height).toBe(1920);

        expect(r.etagSeed).toContain("curitiba");
        expect(r.etagSeed).toContain("PR");
        expect(r.etagSeed).toContain("7");
    });

    it("sem fotos → ainda gera PNG (fallback gradiente)", async () => {
        stores.total = 3;
        stores.fotos = [];
        const r = await gerarShareCityCard({
            cidadeNome: "Blumenau",
            estadoSigla: "SC",
        });
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        const meta = await sharp(r.png).metadata();
        expect(meta.width).toBe(1080);
        expect(meta.height).toBe(1920);
    });

    it("etagSeed muda quando a contagem muda", async () => {
        stores.fotos = [{ fotoPerfil: { storageKey: "a.jpg" } }];
        stores.total = 2;
        const r1 = await gerarShareCityCard({
            cidadeNome: "Curitiba",
            estadoSigla: "PR",
        });
        stores.total = 5;
        const r2 = await gerarShareCityCard({
            cidadeNome: "Curitiba",
            estadoSigla: "PR",
        });
        if (!r1.ok || !r2.ok) throw new Error("esperava sucesso");
        expect(r1.etagSeed).not.toBe(r2.etagSeed);
    });
});
