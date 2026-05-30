/**
 * Unit test do `obterCompletude`.
 *
 * Cobre:
 *   1. Perfil zerado → 0%, 9 itens, todos faltantes.
 *   2. Perfil completo → 100%, todos cumpridos.
 *   3. Cumprimento parcial — percentual proporcional + itens
 *      faltantes vêm primeiro na lista.
 *   4. Item "verificacao" só vira completo quando
 *      `perfil.verificada=true` E `Verification.status=APROVADA`.
 *   5. Item "descricao" exige >= 100 chars; com menos não conta.
 *   6. Item "galeria" exige >= 5 mídias.
 *
 * Mock de `@/lib/db` espelha apenas a superfície usada por
 * `obterCompletude`: `acompanhanteProfile.findUnique`,
 * `media.count`, `verification.findUnique`.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

interface ProfileRow {
    fotoPerfilId: string | null;
    capaPerfilId: string | null;
    descricao: string;
    audioApresentacaoId: string | null;
    verificada: boolean;
    pesoKg: number | null;
    alturaCm: number | null;
    tamanhoPe: number | null;
    etnia: string | null;
    corOlhos: string | null;
    estiloCabelo: string | null;
    tamanhoCabelo: string | null;
    diasAtende: ReadonlyArray<string>;
    formasPagamento: ReadonlyArray<string>;
}

const stores = vi.hoisted(() => ({
    profiles: new Map<string, {
        fotoPerfilId: string | null;
        capaPerfilId: string | null;
        descricao: string;
        audioApresentacaoId: string | null;
        verificada: boolean;
        pesoKg: number | null;
        alturaCm: number | null;
        tamanhoPe: number | null;
        etnia: string | null;
        corOlhos: string | null;
        estiloCabelo: string | null;
        tamanhoCabelo: string | null;
        diasAtende: ReadonlyArray<string>;
        formasPagamento: ReadonlyArray<string>;
    }>(),
    galleryCounts: new Map<string, number>(),
    storiesCounts: new Map<string, number>(),
    verifications: new Map<string, { status: string }>(),
}));

vi.mock("@/lib/db", () => {
    return {
        db: {
            acompanhanteProfile: {
                async findUnique({
                    where,
                }: {
                    where: { userId: string };
                }) {
                    const row = stores.profiles.get(where.userId);
                    if (!row) return null;
                    return { ...row };
                },
            },
            media: {
                async count({
                    where,
                }: {
                    where: {
                        ownerId: string;
                        role: string;
                        status?: unknown;
                    };
                }) {
                    if (where.role === "GALLERY") {
                        return stores.galleryCounts.get(where.ownerId) ?? 0;
                    }
                    if (where.role === "STORY") {
                        return stores.storiesCounts.get(where.ownerId) ?? 0;
                    }
                    return 0;
                },
            },
            verification: {
                async findUnique({
                    where,
                }: {
                    where: { userId: string };
                }) {
                    const row = stores.verifications.get(where.userId);
                    if (!row) return null;
                    return { status: row.status };
                },
            },
        },
    };
});

import { obterCompletude } from "@/server/acompanhante-profile/completude";

function blankProfile(): ProfileRow {
    return {
        fotoPerfilId: null,
        capaPerfilId: null,
        descricao: "",
        audioApresentacaoId: null,
        verificada: false,
        pesoKg: null,
        alturaCm: null,
        tamanhoPe: null,
        etnia: null,
        corOlhos: null,
        estiloCabelo: null,
        tamanhoCabelo: null,
        diasAtende: [],
        formasPagamento: [],
    };
}

function fullProfile(): ProfileRow {
    return {
        fotoPerfilId: "media-foto",
        capaPerfilId: "media-capa",
        descricao: "x".repeat(120),
        audioApresentacaoId: "media-audio",
        verificada: true,
        pesoKg: 60,
        alturaCm: 165,
        tamanhoPe: 36,
        etnia: "BRANCA",
        corOlhos: "CASTANHO",
        estiloCabelo: "LISO",
        tamanhoCabelo: "MEDIO",
        diasAtende: ["SEGUNDA"],
        formasPagamento: ["DINHEIRO"],
    };
}

beforeEach(() => {
    stores.profiles.clear();
    stores.galleryCounts.clear();
    stores.storiesCounts.clear();
    stores.verifications.clear();
});

// ---------------------------------------------------------------------------
// Casos
// ---------------------------------------------------------------------------

describe("obterCompletude — perfil zerado", () => {
    it("retorna 0% quando nada está preenchido", async () => {
        stores.profiles.set("u1", blankProfile());
        const r = await obterCompletude("u1");
        expect(r.percentual).toBe(0);
        expect(r.completos).toBe(0);
        expect(r.total).toBe(9);
        expect(r.itens).toHaveLength(9);
        expect(r.itens.every((i) => !i.completo)).toBe(true);
    });

    it("retorna estrutura vazia quando não há perfil (Cliente)", async () => {
        const r = await obterCompletude("user-cliente");
        expect(r.percentual).toBe(0);
        expect(r.completos).toBe(0);
        expect(r.total).toBe(0);
        expect(r.itens).toHaveLength(0);
    });
});

describe("obterCompletude — perfil completo", () => {
    it("retorna 100% quando tudo preenchido", async () => {
        stores.profiles.set("u1", fullProfile());
        stores.galleryCounts.set("u1", 5);
        stores.storiesCounts.set("u1", 1);
        stores.verifications.set("u1", { status: "APROVADA" });

        const r = await obterCompletude("u1");
        expect(r.percentual).toBe(100);
        expect(r.completos).toBe(9);
        expect(r.total).toBe(9);
        expect(r.itens.every((i) => i.completo)).toBe(true);
    });
});

describe("obterCompletude — itens parciais", () => {
    it("descricao com 99 chars não conta como completo", async () => {
        stores.profiles.set("u1", { ...fullProfile(), descricao: "x".repeat(99) });
        stores.galleryCounts.set("u1", 5);
        stores.storiesCounts.set("u1", 1);
        stores.verifications.set("u1", { status: "APROVADA" });

        const r = await obterCompletude("u1");
        const desc = r.itens.find((i) => i.key === "descricao");
        expect(desc?.completo).toBe(false);
        expect(r.percentual).toBeLessThan(100);
    });

    it("galeria com 4 mídias não conta como completo", async () => {
        stores.profiles.set("u1", fullProfile());
        stores.galleryCounts.set("u1", 4);
        stores.storiesCounts.set("u1", 1);
        stores.verifications.set("u1", { status: "APROVADA" });

        const r = await obterCompletude("u1");
        const galeria = r.itens.find((i) => i.key === "galeria");
        expect(galeria?.completo).toBe(false);
    });

    it("verificacao exige perfil.verificada=true E Verification=APROVADA", async () => {
        // Cenário 1: verificada=true mas verification ausente.
        stores.profiles.set("u1", { ...fullProfile(), verificada: true });
        stores.galleryCounts.set("u1", 5);
        stores.storiesCounts.set("u1", 1);
        // Sem entrada em verifications.

        const r1 = await obterCompletude("u1");
        const v1 = r1.itens.find((i) => i.key === "verificacao");
        expect(v1?.completo).toBe(false);

        // Cenário 2: verification=APROVADA mas verificada=false (mirror desync).
        stores.profiles.set("u1", { ...fullProfile(), verificada: false });
        stores.verifications.set("u1", { status: "APROVADA" });

        const r2 = await obterCompletude("u1");
        const v2 = r2.itens.find((i) => i.key === "verificacao");
        expect(v2?.completo).toBe(false);

        // Cenário 3: ambos true.
        stores.profiles.set("u1", { ...fullProfile(), verificada: true });
        stores.verifications.set("u1", { status: "APROVADA" });
        const r3 = await obterCompletude("u1");
        const v3 = r3.itens.find((i) => i.key === "verificacao");
        expect(v3?.completo).toBe(true);
    });

    it("aparencia exige TODOS os campos preenchidos", async () => {
        stores.profiles.set("u1", { ...fullProfile(), corOlhos: null });
        stores.galleryCounts.set("u1", 5);
        stores.storiesCounts.set("u1", 1);
        stores.verifications.set("u1", { status: "APROVADA" });

        const r = await obterCompletude("u1");
        const ap = r.itens.find((i) => i.key === "aparencia");
        expect(ap?.completo).toBe(false);
    });

    it("itens faltantes vêm primeiro na ordenação", async () => {
        // 50%: foto + capa + descricao + audio cumpridos;
        // resto faltando.
        stores.profiles.set("u1", {
            ...blankProfile(),
            fotoPerfilId: "f",
            capaPerfilId: "c",
            descricao: "x".repeat(120),
            audioApresentacaoId: "a",
        });
        stores.galleryCounts.set("u1", 0);
        stores.storiesCounts.set("u1", 0);

        const r = await obterCompletude("u1");
        // Os primeiros itens da lista devem ser !completo.
        const primeiroCompleto = r.itens.findIndex((i) => i.completo);
        const primeiroFaltante = r.itens.findIndex((i) => !i.completo);
        expect(primeiroFaltante).toBe(0);
        expect(primeiroCompleto).toBeGreaterThan(primeiroFaltante);
    });
});
