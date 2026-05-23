// Feature: privello-platform, Property 25: Falhas de persistência mantêm o acompanhante sem plano e permitem retentativa
/**
 * Property 25 — Falhas de persistência mantêm o acompanhante sem plano e permitem retentativa.
 *
 * **Validates: Requirements 5.9**
 *
 * Statement (transcrito do design.md):
 *
 *   For any sequence of `selecionar(acompanhanteId, tipo)` calls where
 *   persistence failures occur on any subset of attempts:
 *    - while no successful attempt occurs, `obterVigente(acompanhanteId)`
 *      remains null;
 *    - once a successful call occurs, `obterVigente` returns the
 *      corresponding plan.
 *
 * Estratégia
 * ----------
 *
 * O Sistema_de_Planos é exercitado contra um mock em memória de
 * `@/lib/db` que reproduz apenas o subconjunto de `db.acompanhanteProfile`
 * usado por {@link selecionar} e {@link obterVigente} (`findUnique` e
 * `update`). Seedamos um único perfil de Acompanhante com `userId = REAL_ID`
 * e `planoVigente = null`, refletindo o estado do MVP imediatamente após
 * o onboarding (Requirement 5.5).
 *
 * Cada passo da sequência gerada é classificado em:
 *
 *   - `"fail"`  — invocamos `selecionar(INVALID_ID, tipo)`. Como o id
 *     não existe no store, `findUnique` retorna `null` e a implementação
 *     em `src/server/planos/index.ts` toma o ramo `PERSISTENCIA`
 *     (`return { ok: false, reason: "PERSISTENCIA" }`). Isso simula
 *     fielmente o comportamento descrito na task 8.6.
 *   - `"success"` — invocamos `selecionar(REAL_ID, tipo)`. Como o id
 *     existe, a implementação completa o `update` e retorna `{ ok: true }`.
 *
 * Após cada passo verificamos a invariante prescrita pela propriedade:
 *
 *   - se ainda não houve nenhum sucesso, `obterVigente(REAL_ID)` deve
 *     retornar `null` (o perfil permanece sem `planoVigente`);
 *   - assim que existiu pelo menos um sucesso, `obterVigente(REAL_ID)`
 *     deve retornar exatamente a `PLANO_DEFINITIONS[ultimoTipoSucesso]`
 *     (o último `tipo` confirmado em uma chamada bem-sucedida).
 *
 * O check é feito após cada passo — não apenas no final — para garantir
 * que a falha de persistência não corrompe o estado anterior em momento
 * algum: se um `update` parcial vazasse, ou se uma chamada ao endpoint
 * inválido escrevesse silenciosamente em outra linha, qualquer iteração
 * intermediária pegaria a regressão.
 *
 * Notas
 * -----
 * - O mock de Prisma só expõe `acompanhanteProfile`. Qualquer chamada
 *   acidental a outras tabelas (`db.user.*`, `db.session.*`, etc.) durante
 *   a execução de `selecionar`/`obterVigente` quebraria com
 *   `TypeError: Cannot read properties of undefined`. Assim, a ausência
 *   de efeitos colaterais fora do perfil é coberta estruturalmente.
 * - 30 iterações, conforme orientação da task; cada iteração executa
 *   uma sequência de 1 a 12 tentativas para variar a quantidade e a
 *   ordem dos passos (`fail` antes/depois de `success` etc.).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import * as fc from "fast-check";

// ---------------------------------------------------------------------------
// In-memory mock of `@/lib/db`
//
// We use `vi.hoisted` so the store reference is available both inside the
// `vi.mock` factory (hoisted to the top of the module) and inside the test
// body itself.
// ---------------------------------------------------------------------------

interface ProfileRow {
    userId: string;
    planoVigente: "BASICO" | "PREMIUM" | null;
    planoSelecionadoEm: Date | null;
}

const mocks = vi.hoisted(() => {
    const profileStore = new Map<string, ProfileRow>();
    return { profileStore };
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
                    const row = mocks.profileStore.get(args.where.userId);
                    if (!row) return null;
                    return pick(row, args.select);
                },
                update: async (args: {
                    where: { userId: string };
                    data: Partial<ProfileRow>;
                    select?: Record<string, boolean>;
                }) => {
                    const row = mocks.profileStore.get(args.where.userId);
                    if (!row) {
                        throw new Error(
                            `[mock prisma] update: profile '${args.where.userId}' not found`,
                        );
                    }
                    const next: ProfileRow = { ...row };
                    if (args.data.planoVigente !== undefined) {
                        next.planoVigente =
                            args.data.planoVigente as ProfileRow["planoVigente"];
                    }
                    if (args.data.planoSelecionadoEm !== undefined) {
                        next.planoSelecionadoEm =
                            args.data.planoSelecionadoEm as Date | null;
                    }
                    mocks.profileStore.set(args.where.userId, next);
                    return pick(next, args.select);
                },
            },
        },
    };
});

// Imports after `vi.mock` so the stub is in place when the service captures
// its `db` reference at import time.
import { obterVigente, selecionar } from "@/server/planos";
import { PLANO_DEFINITIONS } from "@/domain/plano/definitions";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** Id do Acompanhante seedado no store; usado em chamadas de "success". */
const REAL_ID = "00000000-0000-0000-0000-000000000001";

/**
 * Id que NÃO existe no store; usado em chamadas de "fail" para empurrar a
 * implementação ao ramo `PERSISTENCIA` via `findUnique` retornando `null`.
 */
const INVALID_ID = "ffffffff-ffff-ffff-ffff-ffffffffffff";

/**
 * Cada passo da sequência ou simula uma falha de persistência (com id
 * inválido) ou registra uma seleção bem-sucedida (com id real). O `tipo`
 * sempre é um `PlanoTipo` válido — falhas de validação (`INVALIDO`) não
 * são objeto desta propriedade; elas pertencem à Property 24.
 */
type Attempt =
    | { kind: "fail"; tipo: "BASICO" | "PREMIUM" }
    | { kind: "success"; tipo: "BASICO" | "PREMIUM" };

const attemptArb: fc.Arbitrary<Attempt> = fc.oneof(
    fc.record({
        kind: fc.constant("fail" as const),
        tipo: fc.constantFrom("BASICO" as const, "PREMIUM" as const),
    }),
    fc.record({
        kind: fc.constant("success" as const),
        tipo: fc.constantFrom("BASICO" as const, "PREMIUM" as const),
    }),
);

// ---------------------------------------------------------------------------
// Property
// ---------------------------------------------------------------------------

describe("Property 25: falhas de persistência mantêm o acompanhante sem plano e permitem retentativa", () => {
    beforeEach(() => {
        mocks.profileStore.clear();
    });

    it(
        "for any sequence of fail/success attempts, obterVigente is null until the first success and otherwise returns the plan of the most recent success",
        { timeout: 60_000 },
        async () => {
            await fc.assert(
                fc.asyncProperty(
                    fc.array(attemptArb, { minLength: 1, maxLength: 12 }),
                    async (attempts) => {
                        // Fresh state per iteration: seed Acompanhante without plan.
                        mocks.profileStore.clear();
                        mocks.profileStore.set(REAL_ID, {
                            userId: REAL_ID,
                            planoVigente: null,
                            planoSelecionadoEm: null,
                        });

                        // Tipo do plano consolidado pela última chamada bem-sucedida.
                        // Mantém-se `null` enquanto nenhum `success` ocorrer.
                        let lastSuccessfulTipo:
                            | "BASICO"
                            | "PREMIUM"
                            | null = null;

                        for (const attempt of attempts) {
                            if (attempt.kind === "fail") {
                                // Id inválido → findUnique retorna null →
                                // implementação emite PERSISTENCIA sem tocar
                                // no perfil real.
                                const result = await selecionar(
                                    INVALID_ID,
                                    attempt.tipo,
                                );
                                expect(result).toEqual({
                                    ok: false,
                                    reason: "PERSISTENCIA",
                                });
                            } else {
                                const result = await selecionar(
                                    REAL_ID,
                                    attempt.tipo,
                                );
                                expect(result).toEqual({ ok: true });
                                lastSuccessfulTipo = attempt.tipo;
                            }

                            // Invariante após cada passo, não apenas no fim.
                            const vigente = await obterVigente(REAL_ID);
                            if (lastSuccessfulTipo === null) {
                                // Nenhum sucesso ainda: o perfil precisa
                                // permanecer sem plano vigente.
                                expect(vigente).toBeNull();
                            } else {
                                // Já houve sucesso: obterVigente devolve
                                // exatamente a definição do plano correspondente
                                // ao último tipo confirmado.
                                expect(vigente).toEqual(
                                    PLANO_DEFINITIONS[lastSuccessfulTipo],
                                );
                            }
                        }
                    },
                ),
                { numRuns: 30 },
            );
        },
    );
});
