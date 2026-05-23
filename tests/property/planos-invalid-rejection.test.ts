// Feature: privello-platform, Property 24: Seleção inválida é rejeitada e mantém estado
/**
 * Property 24 — Seleção inválida é rejeitada e mantém estado.
 *
 * **Validates: Requirements 5.8**
 *
 * Statement (transcrito do design.md):
 *
 *   For any string `s` que não pertence a `{ "BASICO", "PREMIUM" }`,
 *   `selecionar(acompanhanteId, s)` retorna exatamente
 *   `{ ok: false, reason: "INVALIDO" }`, e `obterVigente(acompanhanteId)`
 *   continua retornando `null` quando a Acompanhante não tinha plano
 *   anterior. Em particular, nenhuma escrita no banco é realizada para
 *   uma seleção inválida — o estado pré-existente é preservado.
 *
 * O serviço sob teste é {@link import("@/server/planos").selecionar}, que
 * implementa a porta de validação por meio de
 * {@link import("@/domain/plano/definitions").isPlanoTipo} antes de tocar
 * no banco. A semântica esperada é "early return": para qualquer string
 * `s` fora de `{BASICO, PREMIUM}` o serviço deve retornar `INVALIDO`
 * sem chamar `findUnique` nem `update` em `acompanhante_profiles`.
 *
 * Como verificamos isso aqui:
 *
 *   - Mockamos `@/lib/db` com um `Map<userId, AcompanhanteRow>` pequeno
 *     e instrumentamos chamadas a `findUnique`/`update` com contadores.
 *     "DB helper para semear uma Acompanhante fresca" se traduz aqui
 *     em popular o store com uma linha de `planoVigente: null` (estado
 *     pós-onboarding, antes da Selecao_de_Plano).
 *   - Para cada `s` gerado por
 *     `fc.string().filter(s => s !== "BASICO" && s !== "PREMIUM")`,
 *     chamamos `selecionar(id, s)` e exigimos:
 *       1. resultado === `{ ok: false, reason: "INVALIDO" }`,
 *       2. `obterVigente(id)` continua resolvendo `null`,
 *       3. nenhuma escrita ocorreu no store (contador de `update` = 0).
 *   - O contador de `findUnique` para `selecionar` também deve ficar em
 *     0 (early return antes do DB). Como `obterVigente` SEMPRE chama
 *     `findUnique`, separamos os contadores entre as duas operações.
 *
 * Importante: o teste usa o subset mínimo do prisma surface que
 * `selecionar`/`obterVigente` consomem; qualquer regressão que comece a
 * chamar `update` em caminho inválido faz o teste falhar imediatamente.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import * as fc from "fast-check";
import { randomUUID } from "node:crypto";

// ---------------------------------------------------------------------------
// In-memory mock of `@/lib/db`
//
// `vi.hoisted` mantém a fábrica do mock e o teste compartilhando o mesmo
// store. Apenas as duas operações usadas por `selecionar`/`obterVigente`
// são implementadas; qualquer outra chamada é um sinal de regressão.
// ---------------------------------------------------------------------------

interface AcompanhanteRow {
    userId: string;
    planoVigente: "BASICO" | "PREMIUM" | null;
    planoSelecionadoEm: Date | null;
}

const mocks = vi.hoisted(() => {
    const store = new Map<string, AcompanhanteRow>();
    const counters = {
        findUnique: 0,
        update: 0,
    };
    return { store, counters };
});

vi.mock("@/lib/db", () => {
    const pick = <T extends Record<string, unknown>>(
        row: T,
        select?: Record<string, boolean>,
    ): Partial<T> => {
        if (!select) return row;
        const out: Record<string, unknown> = {};
        for (const k of Object.keys(select)) {
            if (select[k]) out[k] = row[k as keyof T];
        }
        return out as Partial<T>;
    };

    return {
        db: {
            acompanhanteProfile: {
                findUnique: async (args: {
                    where: { userId: string };
                    select?: Record<string, boolean>;
                }) => {
                    mocks.counters.findUnique += 1;
                    const row = mocks.store.get(args.where.userId);
                    if (!row) return null;
                    return pick(row, args.select);
                },
                update: async (args: {
                    where: { userId: string };
                    data: Partial<AcompanhanteRow>;
                    select?: Record<string, boolean>;
                }) => {
                    mocks.counters.update += 1;
                    const row = mocks.store.get(args.where.userId);
                    if (!row) {
                        throw new Error(
                            `[mock prisma] update: acompanhante '${args.where.userId}' not found`,
                        );
                    }
                    const next: AcompanhanteRow = { ...row };
                    if (args.data.planoVigente !== undefined) {
                        next.planoVigente = args.data.planoVigente ?? null;
                    }
                    if (args.data.planoSelecionadoEm !== undefined) {
                        next.planoSelecionadoEm =
                            (args.data.planoSelecionadoEm as Date | null) ?? null;
                    }
                    mocks.store.set(args.where.userId, next);
                    return pick(next, args.select);
                },
            },
        },
    };
});

// Imports devem vir DEPOIS do `vi.mock` para que o serviço capture o
// mock no momento em que é avaliado.
import { obterVigente, selecionar } from "@/server/planos";

// ---------------------------------------------------------------------------
// Test
// ---------------------------------------------------------------------------

describe("Property 24: seleção inválida é rejeitada e mantém estado", () => {
    beforeEach(() => {
        mocks.store.clear();
        mocks.counters.findUnique = 0;
        mocks.counters.update = 0;
    });

    it(
        "for any s NOT in {BASICO, PREMIUM}, selecionar rejects with INVALIDO and obterVigente stays null",
        async () => {
            await fc.assert(
                fc.asyncProperty(
                    fc.string().filter(
                        (s) => s !== "BASICO" && s !== "PREMIUM",
                    ),
                    async (s) => {
                        // Cada iteração começa com uma Acompanhante recém-
                        // -criada (sem plano), reproduzindo o estado pós-
                        // -onboarding, antes da Selecao_de_Plano.
                        mocks.store.clear();
                        mocks.counters.findUnique = 0;
                        mocks.counters.update = 0;

                        const acompanhanteId = randomUUID();
                        mocks.store.set(acompanhanteId, {
                            userId: acompanhanteId,
                            planoVigente: null,
                            planoSelecionadoEm: null,
                        });

                        // (1) selecionar deve rejeitar com INVALIDO.
                        const resultado = await selecionar(acompanhanteId, s);
                        expect(resultado).toEqual({
                            ok: false,
                            reason: "INVALIDO",
                        });

                        // Nenhuma escrita pode ter ocorrido no caminho
                        // inválido. O serviço também não deve precisar ler
                        // a linha — o early-return acontece antes do DB.
                        expect(mocks.counters.update).toBe(0);
                        expect(mocks.counters.findUnique).toBe(0);

                        // (2) obterVigente continua null (estado preservado).
                        const vigente = await obterVigente(acompanhanteId);
                        expect(vigente).toBeNull();

                        // E confirmamos no store: a linha não mudou.
                        const persistido = mocks.store.get(acompanhanteId);
                        expect(persistido).toEqual({
                            userId: acompanhanteId,
                            planoVigente: null,
                            planoSelecionadoEm: null,
                        });
                    },
                ),
                { numRuns: 50 },
            );
        },
    );
});
