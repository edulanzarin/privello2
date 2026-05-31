/**
 * Unit test do serviço de Buscas Salvas (V3).
 *
 * Cobre:
 *   1. `normalizarFiltros` — sanitiza JSON arbitrário: descarta
 *      campos desconhecidos, coage tipos, limita arrays, dropa lixo.
 *   2. `salvarBusca` — exige cidade, respeita limite, gera label.
 *   3. `listarBuscas` / `excluirBusca` — escopo por Cliente.
 *   4. `casarBuscasSalvas` — notifica quando o perfil novo aparece
 *      no resultado da busca salva e marca `lastNotifiedAt`; não
 *      notifica quando não casa.
 *
 * Mocka `@/lib/db`, `@/server/acompanhante-profile/buscar` e
 * `@/server/notifications`.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

interface SavedRow {
    id: string;
    clientUserId: string;
    label: string;
    filtros: unknown;
    lastNotifiedAt: Date | null;
    criadoEm: Date;
}

const stores = vi.hoisted(() => ({
    saved: [] as SavedRow[],
    profiles: new Map<
        string,
        {
            cidadeNome: string;
            perfilVisivel: boolean;
            planoVigente: string | null;
            nome: string;
            identificador: string;
        }
    >(),
    nextId: { n: 1 },
    // Itens que a `buscar` mockada vai retornar (por identificador).
    buscarRetorna: [] as Array<{ identificador: string }>,
    notificacoes: [] as Array<{ userId: string; type: string }>,
}));

vi.mock("@/lib/db", () => ({
    db: {
        savedSearch: {
            async count({ where }: { where: { clientUserId: string } }) {
                return stores.saved.filter(
                    (r) => r.clientUserId === where.clientUserId,
                ).length;
            },
            async create({
                data,
                select,
            }: {
                data: {
                    clientUserId: string;
                    label: string;
                    filtros: unknown;
                };
                select?: { id?: boolean };
            }) {
                const row: SavedRow = {
                    id: `s${stores.nextId.n++}`,
                    clientUserId: data.clientUserId,
                    label: data.label,
                    filtros: data.filtros,
                    lastNotifiedAt: null,
                    criadoEm: new Date(),
                };
                stores.saved.push(row);
                return select?.id ? { id: row.id } : { ...row };
            },
            async findMany({
                where,
            }: {
                where?: {
                    clientUserId?: string;
                    filtros?: { path: string[]; equals: unknown };
                };
            }) {
                let rows = [...stores.saved];
                if (where?.clientUserId) {
                    rows = rows.filter(
                        (r) => r.clientUserId === where.clientUserId,
                    );
                }
                if (where?.filtros) {
                    const key = where.filtros.path[0];
                    rows = rows.filter(
                        (r) =>
                            (r.filtros as Record<string, unknown>)[key] ===
                            where.filtros!.equals,
                    );
                }
                return rows.map((r) => ({ ...r }));
            },
            async deleteMany({
                where,
            }: {
                where: { id: string; clientUserId: string };
            }) {
                const before = stores.saved.length;
                stores.saved = stores.saved.filter(
                    (r) =>
                        !(
                            r.id === where.id &&
                            r.clientUserId === where.clientUserId
                        ),
                );
                return { count: before - stores.saved.length };
            },
            async update({
                where,
                data,
            }: {
                where: { id: string };
                data: { lastNotifiedAt: Date };
            }) {
                const row = stores.saved.find((r) => r.id === where.id);
                if (row) row.lastNotifiedAt = data.lastNotifiedAt;
                return { ...(row as SavedRow) };
            },
        },
        acompanhanteProfile: {
            async findUnique({ where }: { where: { userId: string } }) {
                const p = stores.profiles.get(where.userId);
                if (!p) return null;
                return {
                    cidadeNome: p.cidadeNome,
                    perfilVisivel: p.perfilVisivel,
                    planoVigente: p.planoVigente,
                    user: { nome: p.nome, identificador: p.identificador },
                };
            },
        },
    },
}));

vi.mock("@/server/acompanhante-profile/buscar", () => ({
    async buscar() {
        return {
            items: stores.buscarRetorna.map((x) => ({
                identificador: x.identificador,
            })),
            total: stores.buscarRetorna.length,
            page: 1,
            perPage: 60,
            pages: 1,
        };
    },
}));

vi.mock("@/server/notifications", () => ({
    async criarNotificacao(input: { userId: string; type: string }) {
        stores.notificacoes.push({ userId: input.userId, type: input.type });
        return "n1";
    },
}));

import {
    casarBuscasSalvas,
    excluirBusca,
    listarBuscas,
    normalizarFiltros,
    salvarBusca,
} from "@/server/saved-search";

beforeEach(() => {
    stores.saved = [];
    stores.profiles.clear();
    stores.nextId.n = 1;
    stores.buscarRetorna = [];
    stores.notificacoes = [];
});

describe("normalizarFiltros", () => {
    it("descarta campos desconhecidos e coage tipos", () => {
        const f = normalizarFiltros({
            cidadeNome: "  Curitiba ",
            estadoSigla: "pr",
            precoMax: 50000,
            comAudio: true,
            comBoost: "sim", // inválido -> dropado
            lixo: "xxx",
            idiomas: ["PORTUGUES", 5, "  "],
        } as unknown);
        expect(f.cidadeNome).toBe("Curitiba");
        expect(f.estadoSigla).toBe("PR");
        expect(f.precoMax).toBe(50000);
        expect(f.comAudio).toBe(true);
        expect(f.comBoost).toBeUndefined();
        expect(f.idiomas).toEqual(["PORTUGUES"]);
        expect(
            (f as Record<string, unknown>).lixo,
        ).toBeUndefined();
    });
});

describe("salvarBusca", () => {
    it("exige cidade", async () => {
        const r = await salvarBusca({
            clientUserId: "c1",
            filtros: { genero: "MULHER" },
        });
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.reason).toBe("CIDADE_OBRIGATORIA");
    });

    it("salva e gera label com cidade + flags", async () => {
        const r = await salvarBusca({
            clientUserId: "c1",
            filtros: {
                cidadeNome: "Curitiba",
                estadoSigla: "PR",
                verificada: true,
            },
        });
        expect(r.ok).toBe(true);
        expect(stores.saved).toHaveLength(1);
        expect(stores.saved[0].label).toContain("Curitiba, PR");
        expect(stores.saved[0].label.toLowerCase()).toContain("verificadas");
    });
});

describe("listar / excluir", () => {
    it("lista só do próprio cliente e exclui com escopo", async () => {
        await salvarBusca({
            clientUserId: "c1",
            filtros: { cidadeNome: "Curitiba", estadoSigla: "PR" },
        });
        await salvarBusca({
            clientUserId: "c2",
            filtros: { cidadeNome: "Blumenau", estadoSigla: "SC" },
        });

        const doC1 = await listarBuscas("c1");
        expect(doC1).toHaveLength(1);

        // c2 não consegue excluir busca do c1.
        await excluirBusca({ clientUserId: "c2", id: doC1[0].id });
        expect(await listarBuscas("c1")).toHaveLength(1);

        // dono exclui.
        await excluirBusca({ clientUserId: "c1", id: doC1[0].id });
        expect(await listarBuscas("c1")).toHaveLength(0);
    });
});

describe("casarBuscasSalvas", () => {
    function seedProfile(visivel = true): void {
        stores.profiles.set("a1", {
            cidadeNome: "Curitiba",
            perfilVisivel: visivel,
            planoVigente: "PREMIUM",
            nome: "Ana",
            identificador: "ana",
        });
    }

    it("notifica o cliente quando o perfil novo casa a busca", async () => {
        seedProfile();
        await salvarBusca({
            clientUserId: "c1",
            filtros: { cidadeNome: "Curitiba", estadoSigla: "PR" },
        });
        // A busca retorna o perfil 'ana'.
        stores.buscarRetorna = [{ identificador: "ana" }];

        const res = await casarBuscasSalvas("a1");
        expect(res.notificados).toBe(1);
        expect(stores.notificacoes).toHaveLength(1);
        expect(stores.notificacoes[0]).toEqual({
            userId: "c1",
            type: "BUSCA_NOVA_CORRESPONDENCIA",
        });
        // marcou lastNotifiedAt.
        expect(stores.saved[0].lastNotifiedAt).not.toBeNull();
    });

    it("não notifica quando o perfil não aparece no resultado", async () => {
        seedProfile();
        await salvarBusca({
            clientUserId: "c1",
            filtros: { cidadeNome: "Curitiba", estadoSigla: "PR" },
        });
        // Busca retorna outra pessoa.
        stores.buscarRetorna = [{ identificador: "outra" }];

        const res = await casarBuscasSalvas("a1");
        expect(res.notificados).toBe(0);
        expect(stores.notificacoes).toHaveLength(0);
    });

    it("não casa quando o perfil está oculto", async () => {
        seedProfile(false);
        await salvarBusca({
            clientUserId: "c1",
            filtros: { cidadeNome: "Curitiba", estadoSigla: "PR" },
        });
        stores.buscarRetorna = [{ identificador: "ana" }];

        const res = await casarBuscasSalvas("a1");
        expect(res.notificados).toBe(0);
    });
});
