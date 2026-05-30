/**
 * Unit test do serviço de Favoritos.
 *
 * Cobre os invariantes essenciais do {@link toggleFavorito}:
 *
 *   1. Auto-favoritar (mesmo userId em ambos os lados) é sempre
 *      rejeitado com `AUTO_FAVORITAR`. Defesa contra dados malformados
 *      vindos do route handler.
 *   2. Marcar uma conta que NÃO é Acompanhante (Cliente, ou inexistente)
 *      é rejeitado com `ALVO_INVALIDO`.
 *   3. Toggle é idempotente: chamar 2x volta ao estado anterior.
 *   4. Marcar e depois consultar via `isFavorito` reflete o estado.
 *   5. `contarFavoritosDoOwner` conta corretamente N favoritações
 *      vindas de Clientes diferentes.
 *
 * Mocka apenas `@/lib/db` com a superfície mínima do Prisma usada por
 * `src/server/favorites/index.ts`. A lógica de validação é a real.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// In-memory mock of @/lib/db
// ---------------------------------------------------------------------------

type UserType = "CLIENTE" | "ACOMPANHANTE";

interface UserRow {
    id: string;
    type: UserType;
}

interface FavoriteRow {
    clientUserId: string;
    acompanhanteUserId: string;
    criadoEm: Date;
}

const stores = vi.hoisted(() => ({
    users: new Map<string, { id: string; type: "CLIENTE" | "ACOMPANHANTE" }>(),
    favorites: new Map<string, {
        clientUserId: string;
        acompanhanteUserId: string;
        criadoEm: Date;
    }>(),
}));

function favoriteKey(clientId: string, acompanhanteId: string): string {
    return `${clientId}::${acompanhanteId}`;
}

vi.mock("@/lib/db", () => {
    return {
        db: {
            user: {
                async findUnique({
                    where,
                    select,
                }: {
                    where: { id: string };
                    select?: { type?: boolean };
                }) {
                    const row = stores.users.get(where.id);
                    if (!row) return null;
                    if (select?.type) return { type: row.type };
                    return { ...row };
                },
            },
            clientFavorite: {
                async findUnique({
                    where,
                }: {
                    where: {
                        clientUserId_acompanhanteUserId: {
                            clientUserId: string;
                            acompanhanteUserId: string;
                        };
                    };
                }) {
                    const k = favoriteKey(
                        where.clientUserId_acompanhanteUserId.clientUserId,
                        where.clientUserId_acompanhanteUserId
                            .acompanhanteUserId,
                    );
                    const row = stores.favorites.get(k);
                    if (!row) return null;
                    return { clientUserId: row.clientUserId };
                },
                async create({
                    data,
                }: {
                    data: { clientUserId: string; acompanhanteUserId: string };
                }) {
                    const k = favoriteKey(
                        data.clientUserId,
                        data.acompanhanteUserId,
                    );
                    const row: FavoriteRow = {
                        clientUserId: data.clientUserId,
                        acompanhanteUserId: data.acompanhanteUserId,
                        criadoEm: new Date(),
                    };
                    stores.favorites.set(k, row);
                    return { ...row };
                },
                async delete({
                    where,
                }: {
                    where: {
                        clientUserId_acompanhanteUserId: {
                            clientUserId: string;
                            acompanhanteUserId: string;
                        };
                    };
                }) {
                    const k = favoriteKey(
                        where.clientUserId_acompanhanteUserId.clientUserId,
                        where.clientUserId_acompanhanteUserId
                            .acompanhanteUserId,
                    );
                    stores.favorites.delete(k);
                    return { clientUserId: "" };
                },
                async count({
                    where,
                }: {
                    where: { acompanhanteUserId: string };
                }) {
                    let n = 0;
                    for (const row of stores.favorites.values()) {
                        if (row.acompanhanteUserId === where.acompanhanteUserId) {
                            n++;
                        }
                    }
                    return n;
                },
            },
        },
    };
});

// Imports must come AFTER `vi.mock` so the mock replaces `@/lib/db`
// before `favorites/index.ts` captures its `db` reference.
import {
    contarFavoritosDoOwner,
    isFavorito,
    toggleFavorito,
} from "@/server/favorites";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function seedUser(id: string, type: UserType): void {
    stores.users.set(id, { id, type });
}

function seedAcompanhante(id: string): UserRow {
    seedUser(id, "ACOMPANHANTE");
    return { id, type: "ACOMPANHANTE" };
}

function seedCliente(id: string): UserRow {
    seedUser(id, "CLIENTE");
    return { id, type: "CLIENTE" };
}

beforeEach(() => {
    stores.users.clear();
    stores.favorites.clear();
});

// ---------------------------------------------------------------------------
// Casos de erro
// ---------------------------------------------------------------------------

describe("toggleFavorito — casos de erro", () => {
    it("rejeita auto-favoritar (mesmo userId nos dois lados)", async () => {
        const cli = seedCliente("c1");
        const result = await toggleFavorito({
            clientUserId: cli.id,
            acompanhanteUserId: cli.id,
        });
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.reason).toBe("AUTO_FAVORITAR");
    });

    it("rejeita alvo inexistente com ALVO_INVALIDO", async () => {
        const cli = seedCliente("c1");
        const result = await toggleFavorito({
            clientUserId: cli.id,
            acompanhanteUserId: "user-fantasma",
        });
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.reason).toBe("ALVO_INVALIDO");
    });

    it("rejeita quando alvo é outro Cliente (não Acompanhante)", async () => {
        const cli = seedCliente("c1");
        const outroCliente = seedCliente("c2");
        const result = await toggleFavorito({
            clientUserId: cli.id,
            acompanhanteUserId: outroCliente.id,
        });
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.reason).toBe("ALVO_INVALIDO");
    });
});

// ---------------------------------------------------------------------------
// Casos de sucesso — toggle
// ---------------------------------------------------------------------------

describe("toggleFavorito — toggle idempotente", () => {
    it("primeira chamada favorita; segunda desfaz", async () => {
        const cli = seedCliente("c1");
        const ac = seedAcompanhante("a1");

        const first = await toggleFavorito({
            clientUserId: cli.id,
            acompanhanteUserId: ac.id,
        });
        expect(first).toEqual({ ok: true, favorito: true });
        expect(
            await isFavorito({
                clientUserId: cli.id,
                acompanhanteUserId: ac.id,
            }),
        ).toBe(true);

        const second = await toggleFavorito({
            clientUserId: cli.id,
            acompanhanteUserId: ac.id,
        });
        expect(second).toEqual({ ok: true, favorito: false });
        expect(
            await isFavorito({
                clientUserId: cli.id,
                acompanhanteUserId: ac.id,
            }),
        ).toBe(false);
    });

    it("3 chamadas em sequência → marcado, desmarcado, marcado", async () => {
        const cli = seedCliente("c1");
        const ac = seedAcompanhante("a1");

        const r1 = await toggleFavorito({
            clientUserId: cli.id,
            acompanhanteUserId: ac.id,
        });
        const r2 = await toggleFavorito({
            clientUserId: cli.id,
            acompanhanteUserId: ac.id,
        });
        const r3 = await toggleFavorito({
            clientUserId: cli.id,
            acompanhanteUserId: ac.id,
        });

        expect(r1).toEqual({ ok: true, favorito: true });
        expect(r2).toEqual({ ok: true, favorito: false });
        expect(r3).toEqual({ ok: true, favorito: true });
    });
});

// ---------------------------------------------------------------------------
// Contagem
// ---------------------------------------------------------------------------

describe("contarFavoritosDoOwner", () => {
    it("retorna 0 quando ninguém salvou", async () => {
        const ac = seedAcompanhante("a1");
        expect(await contarFavoritosDoOwner(ac.id)).toBe(0);
    });

    it("conta N favoritações de Clientes diferentes", async () => {
        const ac = seedAcompanhante("a1");
        const c1 = seedCliente("c1");
        const c2 = seedCliente("c2");
        const c3 = seedCliente("c3");

        await toggleFavorito({
            clientUserId: c1.id,
            acompanhanteUserId: ac.id,
        });
        await toggleFavorito({
            clientUserId: c2.id,
            acompanhanteUserId: ac.id,
        });
        await toggleFavorito({
            clientUserId: c3.id,
            acompanhanteUserId: ac.id,
        });

        expect(await contarFavoritosDoOwner(ac.id)).toBe(3);

        // Um deles desmarca → contagem cai pra 2.
        await toggleFavorito({
            clientUserId: c2.id,
            acompanhanteUserId: ac.id,
        });
        expect(await contarFavoritosDoOwner(ac.id)).toBe(2);
    });

    it("não vaza contagem entre Acompanhantes diferentes", async () => {
        const a1 = seedAcompanhante("a1");
        const a2 = seedAcompanhante("a2");
        const c1 = seedCliente("c1");

        await toggleFavorito({
            clientUserId: c1.id,
            acompanhanteUserId: a1.id,
        });
        expect(await contarFavoritosDoOwner(a1.id)).toBe(1);
        expect(await contarFavoritosDoOwner(a2.id)).toBe(0);
    });
});
