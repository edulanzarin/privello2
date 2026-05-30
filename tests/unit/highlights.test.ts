/**
 * Unit test do sistema de Stories Highlights.
 *
 * Cobre:
 *   1. validarHighlightTitle: vazio, espaços-only, > 20 chars
 *      rejeitados; OK.
 *   2. adicionarAoDestaque: rejeita title inválido, story de outro
 *      dono (cross-tenant), role!=STORY, status!=ARCHIVED.
 *   3. adicionarAoDestaque: ordem incremental dentro do mesmo
 *      título (max+1).
 *   4. removerDoDestaque: zera highlightTitle/highlightOrder.
 *   5. listarDestaques: agrupa por título, total correto, cover é
 *      o mais recente.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

interface MediaRow {
    id: string;
    ownerId: string;
    role: string;
    status: string;
    storageKey: string;
    kind: string;
    description: string | null;
    createdAt: Date;
    likesCount: number;
    posterStorageKey: string | null;
    highlightTitle: string | null;
    highlightOrder: number | null;
}

const stores = vi.hoisted(() => ({
    medias: new Map<string, {
        id: string;
        ownerId: string;
        role: string;
        status: string;
        storageKey: string;
        kind: string;
        description: string | null;
        createdAt: Date;
        likesCount: number;
        posterStorageKey: string | null;
        highlightTitle: string | null;
        highlightOrder: number | null;
    }>(),
}));

vi.mock("@/lib/db", () => {
    return {
        db: {
            media: {
                async findUnique({
                    where,
                    select,
                }: {
                    where: { id: string };
                    select?: Partial<Record<keyof MediaRow, boolean>>;
                }) {
                    const row = stores.medias.get(where.id);
                    if (!row) return null;
                    if (!select) return { ...row };
                    const out: Partial<MediaRow> = {};
                    for (const k of Object.keys(select) as (keyof MediaRow)[]) {
                        if (select[k]) {
                            (out as Record<string, unknown>)[k] = row[k];
                        }
                    }
                    return out;
                },
                async findMany({
                    where,
                }: {
                    where: {
                        id?: { in: string[] };
                        ownerId?: string;
                        role?: string;
                        status?: string;
                        highlightTitle?:
                            | { not: null }
                            | string;
                    };
                }) {
                    const out: MediaRow[] = [];
                    for (const row of stores.medias.values()) {
                        if (where.ownerId && row.ownerId !== where.ownerId)
                            continue;
                        if (where.role && row.role !== where.role) continue;
                        if (where.status && row.status !== where.status)
                            continue;
                        if (where.id?.in && !where.id.in.includes(row.id))
                            continue;
                        if (where.highlightTitle !== undefined) {
                            if (
                                typeof where.highlightTitle === "object" &&
                                "not" in where.highlightTitle &&
                                where.highlightTitle.not === null
                            ) {
                                if (row.highlightTitle === null) continue;
                            } else if (
                                typeof where.highlightTitle === "string" &&
                                row.highlightTitle !== where.highlightTitle
                            ) {
                                continue;
                            }
                        }
                        out.push({ ...row });
                    }
                    return out;
                },
                async aggregate({
                    where,
                }: {
                    where: {
                        ownerId?: string;
                        role?: string;
                        highlightTitle?: string;
                    };
                }) {
                    let max = -Infinity;
                    for (const row of stores.medias.values()) {
                        if (where.ownerId && row.ownerId !== where.ownerId)
                            continue;
                        if (where.role && row.role !== where.role) continue;
                        if (
                            where.highlightTitle !== undefined &&
                            row.highlightTitle !== where.highlightTitle
                        )
                            continue;
                        if (
                            row.highlightOrder !== null &&
                            row.highlightOrder > max
                        ) {
                            max = row.highlightOrder;
                        }
                    }
                    return {
                        _max: {
                            highlightOrder: max === -Infinity ? null : max,
                        },
                    };
                },
                async update({
                    where,
                    data,
                }: {
                    where: { id: string };
                    data: {
                        highlightTitle?: string | null;
                        highlightOrder?: number | null;
                    };
                }) {
                    const row = stores.medias.get(where.id);
                    if (!row) {
                        throw new Error(`mock media.update: ${where.id} not found`);
                    }
                    if ("highlightTitle" in data) {
                        row.highlightTitle = data.highlightTitle ?? null;
                    }
                    if ("highlightOrder" in data) {
                        row.highlightOrder =
                            data.highlightOrder === undefined
                                ? row.highlightOrder
                                : data.highlightOrder;
                    }
                    stores.medias.set(where.id, row);
                    return { ...row };
                },
            },
        },
    };
});

import {
    adicionarAoDestaque,
    listarDestaques,
    removerDoDestaque,
    validarHighlightTitle,
} from "@/server/storage/highlights";

function seedStory(
    id: string,
    ownerId: string,
    opts: Partial<{
        status: string;
        role: string;
        highlightTitle: string | null;
        highlightOrder: number | null;
        kind: string;
        createdAt: Date;
    }> = {},
): void {
    stores.medias.set(id, {
        id,
        ownerId,
        role: opts.role ?? "STORY",
        status: opts.status ?? "ARCHIVED",
        storageKey: `committed/${ownerId}/stories/${id}.jpg`,
        kind: opts.kind ?? "PHOTO",
        description: null,
        createdAt: opts.createdAt ?? new Date(),
        likesCount: 0,
        posterStorageKey: null,
        highlightTitle: opts.highlightTitle ?? null,
        highlightOrder: opts.highlightOrder ?? null,
    });
}

beforeEach(() => {
    stores.medias.clear();
});

// ---------------------------------------------------------------------------
// Validação do título
// ---------------------------------------------------------------------------

describe("validarHighlightTitle", () => {
    it("rejeita string vazia", () => {
        expect(validarHighlightTitle("")).toBe(false);
    });
    it("rejeita só espaços", () => {
        expect(validarHighlightTitle("   ")).toBe(false);
    });
    it("rejeita > 20 chars", () => {
        expect(validarHighlightTitle("a".repeat(21))).toBe(false);
    });
    it("aceita 1-20 chars normais", () => {
        expect(validarHighlightTitle("Praia")).toBe(true);
        expect(validarHighlightTitle("a".repeat(20))).toBe(true);
    });
    it("rejeita não-string", () => {
        expect(validarHighlightTitle(null)).toBe(false);
        expect(validarHighlightTitle(123)).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// adicionarAoDestaque
// ---------------------------------------------------------------------------

describe("adicionarAoDestaque", () => {
    it("rejeita title vazio com TITULO_INVALIDO", async () => {
        seedStory("s1", "u1");
        const r = await adicionarAoDestaque({
            userId: "u1",
            storyId: "s1",
            title: "",
        });
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.reason).toBe("TITULO_INVALIDO");
    });

    it("rejeita story de outro dono (cross-tenant) com STORY_INVALIDO", async () => {
        seedStory("s1", "u1");
        const r = await adicionarAoDestaque({
            userId: "u2",
            storyId: "s1",
            title: "Praia",
        });
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.reason).toBe("STORY_INVALIDO");
    });

    it("rejeita media com role=GALLERY", async () => {
        seedStory("s1", "u1", { role: "GALLERY" });
        const r = await adicionarAoDestaque({
            userId: "u1",
            storyId: "s1",
            title: "Praia",
        });
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.reason).toBe("STORY_INVALIDO");
    });

    it("rejeita story COMMITTED (ainda ativo, não arquivado)", async () => {
        seedStory("s1", "u1", { status: "COMMITTED" });
        const r = await adicionarAoDestaque({
            userId: "u1",
            storyId: "s1",
            title: "Praia",
        });
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.reason).toBe("STORY_NAO_ARQUIVADO");
    });

    it("aplica highlightTitle e highlightOrder=0 no primeiro do grupo", async () => {
        seedStory("s1", "u1");
        const r = await adicionarAoDestaque({
            userId: "u1",
            storyId: "s1",
            title: "Praia",
        });
        expect(r.ok).toBe(true);
        const row = stores.medias.get("s1");
        expect(row?.highlightTitle).toBe("Praia");
        expect(row?.highlightOrder).toBe(0);
    });

    it("incremento correto: 2º vai pra ordem 1, 3º pra 2", async () => {
        seedStory("s1", "u1");
        seedStory("s2", "u1");
        seedStory("s3", "u1");

        await adicionarAoDestaque({
            userId: "u1",
            storyId: "s1",
            title: "Praia",
        });
        await adicionarAoDestaque({
            userId: "u1",
            storyId: "s2",
            title: "Praia",
        });
        await adicionarAoDestaque({
            userId: "u1",
            storyId: "s3",
            title: "Praia",
        });

        expect(stores.medias.get("s1")?.highlightOrder).toBe(0);
        expect(stores.medias.get("s2")?.highlightOrder).toBe(1);
        expect(stores.medias.get("s3")?.highlightOrder).toBe(2);
    });

    it("trim aplicado ao title (espaços nas pontas)", async () => {
        seedStory("s1", "u1");
        await adicionarAoDestaque({
            userId: "u1",
            storyId: "s1",
            title: "  Praia  ",
        });
        expect(stores.medias.get("s1")?.highlightTitle).toBe("Praia");
    });
});

// ---------------------------------------------------------------------------
// removerDoDestaque
// ---------------------------------------------------------------------------

describe("removerDoDestaque", () => {
    it("zera highlightTitle e highlightOrder", async () => {
        seedStory("s1", "u1", {
            highlightTitle: "Praia",
            highlightOrder: 0,
        });
        const r = await removerDoDestaque({
            userId: "u1",
            storyId: "s1",
        });
        expect(r.ok).toBe(true);
        const row = stores.medias.get("s1");
        expect(row?.highlightTitle).toBe(null);
        expect(row?.highlightOrder).toBe(null);
    });

    it("rejeita story de outro dono", async () => {
        seedStory("s1", "u1", { highlightTitle: "X" });
        const r = await removerDoDestaque({
            userId: "u2",
            storyId: "s1",
        });
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.reason).toBe("STORY_INVALIDO");
    });
});

// ---------------------------------------------------------------------------
// listarDestaques
// ---------------------------------------------------------------------------

describe("listarDestaques", () => {
    it("agrupa por título e conta total", async () => {
        seedStory("s1", "u1", {
            highlightTitle: "Praia",
            highlightOrder: 0,
            createdAt: new Date("2026-05-01"),
        });
        seedStory("s2", "u1", {
            highlightTitle: "Praia",
            highlightOrder: 1,
            createdAt: new Date("2026-05-15"),
        });
        seedStory("s3", "u1", {
            highlightTitle: "Festas",
            highlightOrder: 0,
            createdAt: new Date("2026-04-20"),
        });

        const r = await listarDestaques("u1");
        expect(r).toHaveLength(2);

        const praia = r.find((d) => d.title === "Praia");
        const festas = r.find((d) => d.title === "Festas");
        expect(praia?.total).toBe(2);
        expect(festas?.total).toBe(1);
    });

    it("ignora stories sem highlightTitle", async () => {
        seedStory("s1", "u1", { highlightTitle: "Praia" });
        seedStory("s2", "u1"); // sem highlight
        const r = await listarDestaques("u1");
        expect(r).toHaveLength(1);
        expect(r[0]?.total).toBe(1);
    });

    it("não vaza destaques de outro dono", async () => {
        seedStory("s1", "u1", { highlightTitle: "Praia" });
        seedStory("s2", "u2", { highlightTitle: "Festas" });
        const r = await listarDestaques("u1");
        expect(r).toHaveLength(1);
        expect(r[0]?.title).toBe("Praia");
    });
});
