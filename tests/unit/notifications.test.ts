/**
 * Unit test do serviço de Notificações in-site (V2).
 *
 * Cobre os invariantes do `src/server/notifications/index.ts`:
 *
 *   1. `criarNotificacao` persiste o payload tipado e devolve o id.
 *   2. `criarNotificacao` é best-effort: erro no insert vira `null`
 *      (não propaga) pra não derrubar a operação principal.
 *   3. `listarNotificacoes` devolve ordem desc + flag `lida`
 *      derivada de `lidaEm`.
 *   4. `contarNaoLidas` conta só as com `lidaEm === null`.
 *   5. `marcarComoLida` só afeta a notificação do próprio userId
 *      (escopo de segurança) e é idempotente.
 *   6. `marcarTodasComoLidas` zera as não lidas e retorna o total
 *      afetado.
 *
 * Mocka `@/lib/db` com a superfície mínima de `notification` usada
 * pelo serviço. A lógica é a real.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

interface NotificationRow {
    id: string;
    userId: string;
    type: string;
    payload: unknown;
    lidaEm: Date | null;
    criadoEm: Date;
}

const stores = vi.hoisted(() => ({
    notifications: [] as NotificationRow[],
    nextId: { n: 1 },
    failCreate: { value: false },
}));

vi.mock("@/lib/db", () => {
    return {
        db: {
            notification: {
                async create({
                    data,
                    select,
                }: {
                    data: {
                        userId: string;
                        type: string;
                        payload: unknown;
                    };
                    select?: { id?: boolean };
                }) {
                    if (stores.failCreate.value) {
                        throw new Error("simulated insert failure");
                    }
                    const row: NotificationRow = {
                        id: `n${stores.nextId.n++}`,
                        userId: data.userId,
                        type: data.type,
                        payload: data.payload,
                        lidaEm: null,
                        criadoEm: new Date(Date.now() + stores.nextId.n),
                    };
                    stores.notifications.push(row);
                    return select?.id ? { id: row.id } : { ...row };
                },
                async findMany({
                    where,
                    skip = 0,
                    take = 30,
                }: {
                    where: { userId: string };
                    orderBy?: unknown;
                    skip?: number;
                    take?: number;
                    select?: unknown;
                }) {
                    const rows = stores.notifications
                        .filter((r) => r.userId === where.userId)
                        .sort(
                            (a, b) =>
                                b.criadoEm.getTime() - a.criadoEm.getTime(),
                        )
                        .slice(skip, skip + take);
                    return rows.map((r) => ({
                        id: r.id,
                        type: r.type,
                        payload: r.payload,
                        lidaEm: r.lidaEm,
                        criadoEm: r.criadoEm,
                    }));
                },
                async count({
                    where,
                }: {
                    where: { userId: string; lidaEm?: null };
                }) {
                    return stores.notifications.filter((r) => {
                        if (r.userId !== where.userId) return false;
                        if (where.lidaEm === null) return r.lidaEm === null;
                        return true;
                    }).length;
                },
                async updateMany({
                    where,
                    data,
                }: {
                    where: {
                        id?: string;
                        userId: string;
                        lidaEm?: null;
                    };
                    data: { lidaEm: Date };
                }) {
                    let count = 0;
                    for (const r of stores.notifications) {
                        if (r.userId !== where.userId) continue;
                        if (where.id !== undefined && r.id !== where.id)
                            continue;
                        if (where.lidaEm === null && r.lidaEm !== null)
                            continue;
                        r.lidaEm = data.lidaEm;
                        count++;
                    }
                    return { count };
                },
            },
        },
    };
});

import {
    contarNaoLidas,
    criarNotificacao,
    listarNotificacoes,
    marcarComoLida,
    marcarTodasComoLidas,
} from "@/server/notifications";

beforeEach(() => {
    stores.notifications.length = 0;
    stores.nextId.n = 1;
    stores.failCreate.value = false;
});

describe("criarNotificacao", () => {
    it("persiste o payload tipado e devolve o id", async () => {
        const id = await criarNotificacao({
            userId: "u1",
            type: "NOVA_AVALIACAO",
            payload: { autorNome: "Ana", autorIdentificador: "ana" },
        });
        expect(id).not.toBeNull();
        expect(stores.notifications).toHaveLength(1);
        expect(stores.notifications[0].payload).toEqual({
            autorNome: "Ana",
            autorIdentificador: "ana",
        });
    });

    it("é best-effort: erro no insert vira null sem propagar", async () => {
        stores.failCreate.value = true;
        const id = await criarNotificacao({
            userId: "u1",
            type: "NOVO_FAVORITO",
            payload: { total: 3 },
        });
        expect(id).toBeNull();
        expect(stores.notifications).toHaveLength(0);
    });
});

describe("listarNotificacoes", () => {
    it("retorna ordem desc com flag lida derivada de lidaEm", async () => {
        await criarNotificacao({
            userId: "u1",
            type: "NOVO_FAVORITO",
            payload: { total: 1 },
        });
        await criarNotificacao({
            userId: "u1",
            type: "BOOST_ATIVADO",
            payload: { expiraEm: new Date().toISOString() },
        });

        const items = await listarNotificacoes("u1");
        expect(items).toHaveLength(2);
        // Mais recente primeiro.
        expect(items[0].type).toBe("BOOST_ATIVADO");
        expect(items[0].lida).toBe(false);
    });

    it("não vaza notificações entre usuários", async () => {
        await criarNotificacao({
            userId: "u1",
            type: "NOVO_FAVORITO",
            payload: { total: 1 },
        });
        await criarNotificacao({
            userId: "u2",
            type: "NOVO_FAVORITO",
            payload: { total: 1 },
        });
        const items = await listarNotificacoes("u2");
        expect(items).toHaveLength(1);
    });
});

describe("contarNaoLidas e marcação", () => {
    it("conta só as não lidas", async () => {
        await criarNotificacao({
            userId: "u1",
            type: "NOVO_FAVORITO",
            payload: { total: 1 },
        });
        await criarNotificacao({
            userId: "u1",
            type: "NOVO_FAVORITO",
            payload: { total: 2 },
        });
        expect(await contarNaoLidas("u1")).toBe(2);
    });

    it("marcarComoLida só afeta a notificação do próprio userId", async () => {
        await criarNotificacao({
            userId: "u1",
            type: "NOVO_FAVORITO",
            payload: { total: 1 },
        });
        const alvo = stores.notifications[0].id;

        // Outro usuário tentando marcar a alheia não tem efeito.
        await marcarComoLida({ userId: "u2", notificationId: alvo });
        expect(await contarNaoLidas("u1")).toBe(1);

        // Dono marca → vira lida.
        await marcarComoLida({ userId: "u1", notificationId: alvo });
        expect(await contarNaoLidas("u1")).toBe(0);

        // Idempotente: re-chamar não quebra.
        await marcarComoLida({ userId: "u1", notificationId: alvo });
        expect(await contarNaoLidas("u1")).toBe(0);
    });

    it("marcarTodasComoLidas zera as não lidas e retorna o total", async () => {
        await criarNotificacao({
            userId: "u1",
            type: "NOVO_FAVORITO",
            payload: { total: 1 },
        });
        await criarNotificacao({
            userId: "u1",
            type: "BOOST_ATIVADO",
            payload: { expiraEm: new Date().toISOString() },
        });

        const result = await marcarTodasComoLidas("u1");
        expect(result).toEqual({ ok: true, afetadas: 2 });
        expect(await contarNaoLidas("u1")).toBe(0);
    });
});
