/**
 * Unit test do `reordenarGaleria`.
 *
 * Cobre:
 *   1. Lista vazia ou ids duplicados → INPUT_INVALIDO.
 *   2. id que não pertence ao caller → ALVO_INVALIDO (defesa contra
 *      mass-assign cross-user).
 *   3. id em status diferente de COMMITTED → ALVO_INVALIDO.
 *   4. Ordem aplicada corresponde ao índice na lista (0 → primeiro).
 *   5. Reordenar 2 vezes mantém o estado consistente.
 *
 * Mock mínimo de `@/lib/db` espelhando a superfície usada por
 * `reordenarGaleria`: `media.findMany`, `media.update` e
 * `db.$transaction([promises])`.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

interface MediaRow {
    id: string;
    ownerId: string;
    role: string;
    status: string;
    sortOrder: number;
}

const stores = vi.hoisted(() => ({
    medias: new Map<string, {
        id: string;
        ownerId: string;
        role: string;
        status: string;
        sortOrder: number;
    }>(),
}));

function buildUpdate(
    where: { id: string },
    data: { sortOrder: number },
): Promise<unknown> {
    return new Promise((resolve, reject) => {
        const row = stores.medias.get(where.id);
        if (!row) {
            reject(new Error(`mock media.update: id=${where.id} not found`));
            return;
        }
        // Apply on resolution to mirror real Prisma's batched semantics
        // (a $transaction([promises]) executes them in order).
        queueMicrotask(() => {
            row.sortOrder = data.sortOrder;
            stores.medias.set(where.id, row);
            resolve({ id: row.id });
        });
    });
}

vi.mock("@/lib/db", () => {
    return {
        db: {
            media: {
                async findMany({
                    where,
                }: {
                    where: {
                        id?: { in: string[] };
                        ownerId?: string;
                        role?: string;
                        status?: string;
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
                        out.push({ ...row });
                    }
                    return out;
                },
                update: ({
                    where,
                    data,
                }: {
                    where: { id: string };
                    data: { sortOrder: number };
                }) => buildUpdate(where, data),
            },
            async $transaction(promises: Promise<unknown>[]) {
                return Promise.all(promises);
            },
        },
    };
});

// Imports must come AFTER `vi.mock`.
import { reordenarGaleria } from "@/server/storage/galleryMedia";

function seedMedia(
    id: string,
    ownerId: string,
    opts: Partial<{ role: string; status: string; sortOrder: number }> = {},
): void {
    stores.medias.set(id, {
        id,
        ownerId,
        role: opts.role ?? "GALLERY",
        status: opts.status ?? "COMMITTED",
        sortOrder: opts.sortOrder ?? 0,
    });
}

beforeEach(() => {
    stores.medias.clear();
});

// ---------------------------------------------------------------------------
// Casos de erro
// ---------------------------------------------------------------------------

describe("reordenarGaleria — input inválido", () => {
    it("rejeita lista vazia", async () => {
        const r = await reordenarGaleria({ userId: "u1", ids: [] });
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.reason).toBe("INPUT_INVALIDO");
    });

    it("rejeita ids duplicados", async () => {
        seedMedia("m1", "u1");
        const r = await reordenarGaleria({
            userId: "u1",
            ids: ["m1", "m1"],
        });
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.reason).toBe("INPUT_INVALIDO");
    });

    it("rejeita id de outro usuário (cross-tenant)", async () => {
        seedMedia("m1", "u1");
        seedMedia("m2", "u2");
        const r = await reordenarGaleria({
            userId: "u1",
            ids: ["m1", "m2"],
        });
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.reason).toBe("ALVO_INVALIDO");
    });

    it("rejeita id com role!=GALLERY", async () => {
        seedMedia("m1", "u1", { role: "STORY" });
        const r = await reordenarGaleria({
            userId: "u1",
            ids: ["m1"],
        });
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.reason).toBe("ALVO_INVALIDO");
    });

    it("rejeita id com status!=COMMITTED", async () => {
        seedMedia("m1", "u1", { status: "PENDING_REPAIR" });
        const r = await reordenarGaleria({
            userId: "u1",
            ids: ["m1"],
        });
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.reason).toBe("ALVO_INVALIDO");
    });

    it("rejeita id inexistente", async () => {
        const r = await reordenarGaleria({
            userId: "u1",
            ids: ["fantasma"],
        });
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.reason).toBe("ALVO_INVALIDO");
    });
});

// ---------------------------------------------------------------------------
// Sucesso
// ---------------------------------------------------------------------------

describe("reordenarGaleria — aplica ordem", () => {
    it("ordem aplicada corresponde ao índice na lista", async () => {
        seedMedia("a", "u1", { sortOrder: 5 });
        seedMedia("b", "u1", { sortOrder: 5 });
        seedMedia("c", "u1", { sortOrder: 5 });

        const r = await reordenarGaleria({
            userId: "u1",
            ids: ["c", "a", "b"],
        });
        expect(r).toEqual({ ok: true, total: 3 });

        expect(stores.medias.get("c")?.sortOrder).toBe(0);
        expect(stores.medias.get("a")?.sortOrder).toBe(1);
        expect(stores.medias.get("b")?.sortOrder).toBe(2);
    });

    it("reordenar 2 vezes deixa o estado consistente", async () => {
        seedMedia("a", "u1");
        seedMedia("b", "u1");
        seedMedia("c", "u1");

        await reordenarGaleria({
            userId: "u1",
            ids: ["a", "b", "c"],
        });
        await reordenarGaleria({
            userId: "u1",
            ids: ["c", "b", "a"],
        });

        expect(stores.medias.get("c")?.sortOrder).toBe(0);
        expect(stores.medias.get("b")?.sortOrder).toBe(1);
        expect(stores.medias.get("a")?.sortOrder).toBe(2);
    });

    it("subset não cobre toda a galeria mas não quebra (apenas ids enviados são atualizados)", async () => {
        seedMedia("a", "u1", { sortOrder: 0 });
        seedMedia("b", "u1", { sortOrder: 1 });
        seedMedia("c", "u1", { sortOrder: 2 });

        // Reordena só a + b; c permanece com sortOrder=2.
        const r = await reordenarGaleria({
            userId: "u1",
            ids: ["b", "a"],
        });
        expect(r).toEqual({ ok: true, total: 2 });
        expect(stores.medias.get("b")?.sortOrder).toBe(0);
        expect(stores.medias.get("a")?.sortOrder).toBe(1);
        expect(stores.medias.get("c")?.sortOrder).toBe(2);
    });
});
