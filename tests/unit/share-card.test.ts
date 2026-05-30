/**
 * Unit test do card-imagem de compartilhamento (T11).
 *
 * Cobre:
 *   1. escaparXml — escapa &, <, >, ", '.
 *   2. gerarShareCard: slug vazio → NAO_ENCONTRADO.
 *   3. perfil inexistente → NAO_ENCONTRADO.
 *   4. perfil oculto / sem plano → OCULTO.
 *   5. perfil OK com foto → PNG válido (header PNG) + etagSeed
 *      determinístico.
 *   6. perfil OK sem foto → ainda gera PNG (fallback).
 *
 * Usa sharp de verdade (sem mock) pra confirmar que o pipeline
 * roda; mocka apenas `@/lib/db` e o R2 client (via test seam).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

interface ProfileRow {
    perfilVisivel: boolean;
    planoVigente: "BASICO" | "PREMIUM" | null;
    cidadeNome: string;
    estadoSigla: string;
    verificada: boolean;
    boostUntil: Date | null;
    updatedAt: Date;
    user: { nome: string; identificador: string };
    fotoPerfil: { storageKey: string } | null;
}

const stores = vi.hoisted(() => ({
    profile: null as ProfileRow | null,
}));

vi.mock("@/lib/db", () => {
    return {
        db: {
            acompanhanteProfile: {
                async findFirst() {
                    return stores.profile ? { ...stores.profile } : null;
                },
            },
        },
    };
});

import {
    __setR2ClientForShareCardTests,
    escaparXml,
    gerarShareCard,
} from "@/server/acompanhante-profile/shareCard";
import type { R2Client } from "@/lib/storage/r2";

// Gera um PNG 100x100 vermelho como "foto" fake — sharp consegue
// processar (resize cover) sem precisar de R2 real.
import sharp from "sharp";

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
    stores.profile = null;
    __setR2ClientForShareCardTests(fakeR2);
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

describe("escaparXml", () => {
    it("escapa caracteres especiais", () => {
        expect(escaparXml('a & b < c > d "e" \'f\'')).toBe(
            "a &amp; b &lt; c &gt; d &quot;e&quot; &apos;f&apos;",
        );
    });
    it("texto sem especiais passa intacto", () => {
        expect(escaparXml("Júlia Santos")).toBe("Júlia Santos");
    });
});

describe("gerarShareCard — erros", () => {
    it("slug vazio → NAO_ENCONTRADO", async () => {
        const r = await gerarShareCard("   ");
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.reason).toBe("NAO_ENCONTRADO");
    });

    it("perfil inexistente → NAO_ENCONTRADO", async () => {
        stores.profile = null;
        const r = await gerarShareCard("fantasma");
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.reason).toBe("NAO_ENCONTRADO");
    });

    it("perfil oculto → OCULTO", async () => {
        stores.profile = baseProfile({ perfilVisivel: false });
        const r = await gerarShareCard("julia");
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.reason).toBe("OCULTO");
    });

    it("perfil sem plano → OCULTO", async () => {
        stores.profile = baseProfile({ planoVigente: null });
        const r = await gerarShareCard("julia");
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.reason).toBe("OCULTO");
    });
});

describe("gerarShareCard — sucesso", () => {
    it("perfil com foto → PNG válido 1080x1920 + etagSeed", async () => {
        stores.profile = baseProfile({});
        const r = await gerarShareCard("julia");
        expect(r.ok).toBe(true);
        if (!r.ok) return;

        // Header PNG: 0x89 'P' 'N' 'G'.
        expect(r.png[0]).toBe(0x89);
        expect(r.png[1]).toBe(0x50);
        expect(r.png[2]).toBe(0x4e);
        expect(r.png[3]).toBe(0x47);

        const meta = await sharp(r.png).metadata();
        expect(meta.width).toBe(1080);
        expect(meta.height).toBe(1920);

        expect(r.etagSeed).toContain("julia");
        expect(r.etagSeed).toContain("PREMIUM");
    });

    it("perfil sem foto → ainda gera PNG (fallback)", async () => {
        stores.profile = baseProfile({ fotoPerfil: null });
        const r = await gerarShareCard("julia");
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        const meta = await sharp(r.png).metadata();
        expect(meta.width).toBe(1080);
        expect(meta.height).toBe(1920);
    });

    it("etagSeed muda quando verificada muda", async () => {
        stores.profile = baseProfile({ verificada: false });
        const r1 = await gerarShareCard("julia");
        stores.profile = baseProfile({ verificada: true });
        const r2 = await gerarShareCard("julia");
        if (!r1.ok || !r2.ok) throw new Error("esperava sucesso");
        expect(r1.etagSeed).not.toBe(r2.etagSeed);
    });
});

function baseProfile(overrides: Partial<ProfileRow>): ProfileRow {
    return {
        perfilVisivel: true,
        planoVigente: "PREMIUM",
        cidadeNome: "Rio de Janeiro",
        estadoSigla: "RJ",
        verificada: true,
        boostUntil: null,
        updatedAt: new Date("2026-06-01T00:00:00.000Z"),
        user: { nome: "Júlia Santos", identificador: "julia" },
        fotoPerfil: { storageKey: "committed/u1/profile.jpg" },
        ...overrides,
    };
}
