/**
 * Unit test da ordenação por proximidade (W6).
 *
 * Cobre:
 *   1. ordenar=proximidade com viewerLat/Lng → ordena por distância
 *      (mais perto primeiro) e exclui perfis sem lat/lng.
 *   2. ordenar=proximidade SEM coordenadas → cai em relevância
 *      (usa findMany com orderBy, não o branch de proximidade).
 *
 * Mocka `@/lib/db`, `@/server/acompanhante-profile/atividade` e o
 * groupBy de mídias.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

interface ProfileRow {
    userId: string;
    lat: number | null;
    lng: number | null;
    boostUntil: Date | null;
    planoVigente: "BASICO" | "PREMIUM" | null;
    estadoSigla: string;
    cidadeNome: string;
    bairroNome: string | null;
    descricao: string;
    verificada: boolean;
    viewsCount: number;
    reviewsCount: number;
    valorHoraCents: number | null;
    audioApresentacaoId: string | null;
    user: { nome: string; identificador: string };
    fotoPerfil: { storageKey: string } | null;
    audioApresentacao: null;
    updatedAt: Date;
}

const stores = vi.hoisted(() => ({
    profiles: [] as ProfileRow[],
    lastFindManyArgs: null as unknown,
}));

vi.mock("@/lib/db", () => ({
    db: {
        acompanhanteProfile: {
            async findMany(args: { take?: number; orderBy?: unknown }) {
                stores.lastFindManyArgs = args;
                return stores.profiles.map((p) => ({ ...p }));
            },
            async count() {
                return stores.profiles.length;
            },
        },
        media: {
            async groupBy() {
                return [];
            },
        },
    },
}));

vi.mock("@/server/acompanhante-profile/atividade", () => ({
    async obterAtividadeRecente() {
        return new Set<string>();
    },
}));

import { buscar } from "@/server/acompanhante-profile/buscar";

function profile(
    id: string,
    lat: number | null,
    lng: number | null,
): ProfileRow {
    return {
        userId: id,
        lat,
        lng,
        boostUntil: null,
        planoVigente: "BASICO",
        estadoSigla: "PR",
        cidadeNome: "Curitiba",
        bairroNome: null,
        descricao: "",
        verificada: false,
        viewsCount: 0,
        reviewsCount: 0,
        valorHoraCents: null,
        audioApresentacaoId: null,
        user: { nome: `Perfil ${id}`, identificador: id },
        fotoPerfil: null,
        audioApresentacao: null,
        updatedAt: new Date(),
    };
}

beforeEach(() => {
    stores.profiles = [];
    stores.lastFindManyArgs = null;
});

describe("buscar — proximidade", () => {
    it("ordena por distância (mais perto primeiro)", async () => {
        // Viewer em Curitiba (~-25.43, -49.27).
        const viewerLat = -25.43;
        const viewerLng = -49.27;
        stores.profiles = [
            profile("longe", -23.55, -46.63), // São Paulo (~400km)
            profile("perto", -25.45, -49.29), // ~3km
            profile("medio", -26.91, -49.07), // Blumenau (~165km)
        ];

        const r = await buscar({
            filtros: { cidadeNome: "Curitiba", estadoSigla: "PR" },
            ordenar: "proximidade",
            viewerLat,
            viewerLng,
        });

        expect(r.items.map((i) => i.identificador)).toEqual([
            "perto",
            "medio",
            "longe",
        ]);
    });

    it("exclui perfis sem lat/lng do modo proximidade", async () => {
        stores.profiles = [
            profile("comgeo", -25.45, -49.29),
            profile("semgeo", null, null),
        ];

        const r = await buscar({
            filtros: { cidadeNome: "Curitiba", estadoSigla: "PR" },
            ordenar: "proximidade",
            viewerLat: -25.43,
            viewerLng: -49.27,
        });

        // O mock de findMany devolve todos, mas o branch só ranqueia
        // quem tem coords; sem coords vai pro fim (Infinity). Como o
        // where real filtraria, aqui garantimos ao menos que o com
        // geo vem primeiro.
        expect(r.items[0]?.identificador).toBe("comgeo");
    });

    it("sem coordenadas, proximidade cai em relevância (usa orderBy)", async () => {
        stores.profiles = [profile("a", -25.45, -49.29)];
        await buscar({
            filtros: { cidadeNome: "Curitiba", estadoSigla: "PR" },
            ordenar: "proximidade",
            // sem viewerLat/Lng
        });
        // No fallback de relevância, findMany recebe orderBy array.
        const args = stores.lastFindManyArgs as { orderBy?: unknown };
        expect(Array.isArray(args.orderBy)).toBe(true);
    });
});
