/**
 * Unit test do `obterStatsAvancadas` (T10).
 *
 * Cobre:
 *   1. Heatmap: só células com views > 0.
 *   2. Origens: completa as 4 origens em ordem fixa (mesmo com 0).
 *   3. Conversão: whatsappClicks / views * 100, arredondado a 1
 *      casa; null quando views = 0.
 *   4. Top mídias: vem ordenado por likes desc (o mock devolve
 *      na ordem que o service pediu).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const stores = vi.hoisted(() => ({
    hourly: [] as Array<{ weekday: number; hour: number; views: number }>,
    origins: [] as Array<{ origin: string; views: number }>,
    profile: null as
        | { viewsCount: number; whatsappClicksCount: number }
        | null,
    medias: [] as Array<{
        id: string;
        kind: string;
        storageKey: string;
        likesCount: number;
        commentsCount: number;
    }>,
}));

vi.mock("@/lib/db", () => {
    return {
        db: {
            profileHourlyStat: {
                async findMany() {
                    return stores.hourly.map((h) => ({ ...h }));
                },
            },
            profileOriginStat: {
                async findMany() {
                    return stores.origins.map((o) => ({ ...o }));
                },
            },
            acompanhanteProfile: {
                async findUnique() {
                    return stores.profile ? { ...stores.profile } : null;
                },
            },
            media: {
                async findMany() {
                    return stores.medias.map((m) => ({ ...m }));
                },
            },
        },
    };
});

import { obterStatsAvancadas } from "@/server/acompanhante-profile/stats";

beforeEach(() => {
    stores.hourly = [];
    stores.origins = [];
    stores.profile = { viewsCount: 0, whatsappClicksCount: 0 };
    stores.medias = [];
});

describe("obterStatsAvancadas — heatmap", () => {
    it("inclui só células com views > 0", async () => {
        stores.hourly = [
            { weekday: 1, hour: 14, views: 5 },
            { weekday: 2, hour: 9, views: 0 },
            { weekday: 6, hour: 23, views: 3 },
        ];
        const r = await obterStatsAvancadas("u1");
        expect(r.heatmap).toHaveLength(2);
        expect(r.heatmap).toContainEqual({ weekday: 1, hour: 14, views: 5 });
        expect(r.heatmap).toContainEqual({ weekday: 6, hour: 23, views: 3 });
    });
});

describe("obterStatsAvancadas — origens", () => {
    it("completa as 4 origens em ordem fixa", async () => {
        stores.origins = [
            { origin: "BUSCA", views: 10 },
            { origin: "COMPARTILHADO", views: 4 },
        ];
        const r = await obterStatsAvancadas("u1");
        expect(r.origens).toHaveLength(4);
        expect(r.origens.map((o) => o.origin)).toEqual([
            "BUSCA",
            "HOME",
            "COMPARTILHADO",
            "DIRECT",
        ]);
        const busca = r.origens.find((o) => o.origin === "BUSCA");
        const home = r.origens.find((o) => o.origin === "HOME");
        expect(busca?.views).toBe(10);
        expect(home?.views).toBe(0);
    });
});

describe("obterStatsAvancadas — conversão", () => {
    it("calcula conversão com 1 casa decimal", async () => {
        stores.profile = { viewsCount: 200, whatsappClicksCount: 15 };
        const r = await obterStatsAvancadas("u1");
        // 15/200 = 7.5%
        expect(r.conversao).toBe(7.5);
        expect(r.totalViews).toBe(200);
        expect(r.totalWhatsappClicks).toBe(15);
    });

    it("conversão null quando não há views", async () => {
        stores.profile = { viewsCount: 0, whatsappClicksCount: 0 };
        const r = await obterStatsAvancadas("u1");
        expect(r.conversao).toBe(null);
    });

    it("arredonda corretamente (1 casa)", async () => {
        stores.profile = { viewsCount: 3, whatsappClicksCount: 1 };
        const r = await obterStatsAvancadas("u1");
        // 1/3 = 33.333% → 33.3
        expect(r.conversao).toBe(33.3);
    });
});

describe("obterStatsAvancadas — top mídias", () => {
    it("mapeia mídias preservando ordem do banco", async () => {
        stores.medias = [
            {
                id: "m1",
                kind: "PHOTO",
                storageKey: "k1",
                likesCount: 50,
                commentsCount: 3,
            },
            {
                id: "m2",
                kind: "VIDEO",
                storageKey: "k2",
                likesCount: 20,
                commentsCount: 1,
            },
        ];
        const r = await obterStatsAvancadas("u1");
        expect(r.topMidias).toHaveLength(2);
        expect(r.topMidias[0]?.mediaId).toBe("m1");
        expect(r.topMidias[0]?.kind).toBe("PHOTO");
        expect(r.topMidias[1]?.kind).toBe("VIDEO");
    });
});
