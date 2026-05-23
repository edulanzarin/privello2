// Feature: privello-platform, Property 21: TTL do cache IBGE está sempre no intervalo permitido
/**
 * Property 21 — TTL do cache IBGE está sempre no intervalo permitido.
 *
 * **Validates: Requirements 4.5**
 *
 * Statement (transcrito do design.md):
 *
 *   For any newly-written `IbgeCacheEntry`, `expiresAt - fetchedAt` está em
 *   `[24h, 7 dias]`.
 *
 * Em outras palavras: o TTL aplicado a cada entrada de `ibge_cache` é sempre
 * clampado em `[24h, 168h]` (= 7 dias), independentemente do valor declarado
 * em `IBGE_CACHE_TTL_HOURS`. Esse intervalo é o piso/teto exigido pelo
 * Requirement 4.5.
 *
 * Test design:
 *
 *   - O ponto de entrada do TTL no caminho de produção é
 *     `resolveTtlMsFromEnv()`, que lê `process.env.IBGE_CACHE_TTL_HOURS` e
 *     devolve o TTL já em milissegundos. Variamos esse env over `[0, 1000]`
 *     (cobrindo amplamente entradas abaixo do piso, dentro da janela e acima
 *     do teto) e verificamos:
 *
 *       (a) o resolvedor retorna sempre um valor em `[24h, 168h]` — Property
 *           21 no nível do resolver;
 *       (b) ele preserva valores dentro da janela e clampa fora dela —
 *           encerra explicitamente o teto/piso definidos pelo Requirement.
 *
 *   - O resultado de `resolveTtlMsFromEnv()` é então passado a `upsertCache`,
 *     que persiste a entrada com `fetchedAt = now` e `expiresAt = now +
 *     clampedTtl`. Lemos a linha de volta (via Prisma stub em memória, que
 *     espelha a interface usada pela camada de produção) e asseguramos que
 *     `expiresAt - fetchedAt ∈ [24h, 168h]`. Esta é a forma direta da
 *     Property 21 exigida pelo design (a invariante vale "para qualquer
 *     `IbgeCacheEntry` recém-escrita").
 *
 *   - Como o stub atual em `tests/helpers/db.ts` ainda lança erro
 *     deliberadamente (TODO da task 1.2), seguimos o padrão estabelecido
 *     pelos demais testes de propriedade (`draft-expiration.test.ts`,
 *     `plano-foto-perfil-nao-conta.test.ts`, `session-lifecycle.test.ts`):
 *     mocamos `@/lib/db` com um `Map<key, row>` em memória que reproduz
 *     apenas o subconjunto de `prisma.ibgeCacheEntry` chamado por
 *     `upsertCache` (`upsert`, `findUnique`). A leitura do par
 *     `(fetchedAt, expiresAt)` se dá portanto contra o mesmo store onde a
 *     produção acaba de gravar — exatamente a noção de "ler de volta a
 *     linha inserida" pedida pela tarefa.
 *
 *   - O resolver é sensível ao ambiente do processo. Restauramos o valor
 *     anterior de `IBGE_CACHE_TTL_HOURS` em cada iteração para que a
 *     amostragem fast-check seja idempotente e não vaze estado entre testes.
 *
 *   - 50 iterações para o caminho principal (env numérico em `[0, 1000]`),
 *     mais 50 iterações cobrindo formas "inválidas" da env var (undefined,
 *     vazia, não-numérica) — essas entradas devem cair no default de 72h e
 *     ainda satisfazer o intervalo `[24h, 168h]`.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as fc from "fast-check";

// ---------------------------------------------------------------------------
// In-memory mock of `@/lib/db`.
//
// Apenas a superfície de Prisma de fato exercitada por `upsertCache`/`getCache`
// é implementada: `ibgeCacheEntry.upsert` (gravação) e `ibgeCacheEntry.findUnique`
// (leitura de volta para o assert de Property 21). Qualquer outra chamada
// estoura ruidosamente, denunciando regressões.
// ---------------------------------------------------------------------------

type IbgeCacheRow = {
    key: string;
    payload: unknown;
    fetchedAt: Date;
    expiresAt: Date;
};

const mocks = vi.hoisted(() => {
    const ibgeStore = new Map<string, IbgeCacheRow>();
    return { ibgeStore };
});

vi.mock("@/lib/db", () => {
    return {
        db: {
            ibgeCacheEntry: {
                async findUnique(args: { where: { key: string } }) {
                    return mocks.ibgeStore.get(args.where.key) ?? null;
                },
                async upsert(args: {
                    where: { key: string };
                    create: IbgeCacheRow;
                    update: Partial<IbgeCacheRow>;
                }) {
                    const existing = mocks.ibgeStore.get(args.where.key);
                    if (existing === undefined) {
                        const row: IbgeCacheRow = {
                            key: args.create.key,
                            payload: args.create.payload,
                            fetchedAt: args.create.fetchedAt,
                            expiresAt: args.create.expiresAt,
                        };
                        mocks.ibgeStore.set(row.key, row);
                        return row;
                    }
                    const next: IbgeCacheRow = {
                        key: existing.key,
                        payload:
                            args.update.payload !== undefined
                                ? (args.update.payload as unknown)
                                : existing.payload,
                        fetchedAt:
                            args.update.fetchedAt !== undefined
                                ? (args.update.fetchedAt as Date)
                                : existing.fetchedAt,
                        expiresAt:
                            args.update.expiresAt !== undefined
                                ? (args.update.expiresAt as Date)
                                : existing.expiresAt,
                    };
                    mocks.ibgeStore.set(next.key, next);
                    return next;
                },
            },
        },
    };
});

// Imports of the SUT must come AFTER `vi.mock` so the mock is in effect when
// the production module captures its `db` reference at import time.
import {
    IBGE_CACHE_TTL_MAX_MS,
    IBGE_CACHE_TTL_MIN_MS,
    resetInMemoryCache,
    resolveTtlMsFromEnv,
    upsertCache,
} from "@/server/localidades/ibgeCache";

// Convenience constants (kept local so the test reads as a self-contained
// statement of the property — no implicit reliance on production constants
// for the bounds being asserted).
const ONE_HOUR_MS = 60 * 60 * 1000;
const TWENTY_FOUR_HOURS_MS = 24 * ONE_HOUR_MS;
const SEVEN_DAYS_MS = 168 * ONE_HOUR_MS;

// Sanity: the production constants must agree with the literal bounds named
// by Requirement 4.5 ("entre 24 horas e 7 dias"). If anybody redefines them
// out of band, the property below would still hold against the constants but
// no longer match the requirement — so we anchor it here.
describe("Property 21: TTL do cache IBGE está sempre no intervalo permitido", () => {
    it("production constants reflect the [24h, 7d] window literally", () => {
        expect(IBGE_CACHE_TTL_MIN_MS).toBe(TWENTY_FOUR_HOURS_MS);
        expect(IBGE_CACHE_TTL_MAX_MS).toBe(SEVEN_DAYS_MS);
    });

    // ------------------------------------------------------------------
    // Env management helpers.
    //
    // Each iteration mutates `process.env.IBGE_CACHE_TTL_HOURS`. We snapshot
    // the original value once and restore it after the suite, plus restore
    // it after each iteration so amostras de fast-check sejam idempotentes.
    // ------------------------------------------------------------------

    let originalEnvValue: string | undefined;

    beforeEach(() => {
        originalEnvValue = process.env.IBGE_CACHE_TTL_HOURS;
        mocks.ibgeStore.clear();
        resetInMemoryCache();
    });

    afterEach(() => {
        if (originalEnvValue === undefined) {
            delete process.env.IBGE_CACHE_TTL_HOURS;
        } else {
            process.env.IBGE_CACHE_TTL_HOURS = originalEnvValue;
        }
        mocks.ibgeStore.clear();
        resetInMemoryCache();
    });

    /**
     * Sets `IBGE_CACHE_TTL_HOURS` to the given raw value (or removes it when
     * `null`). Encapsulated so the property body stays focused on the
     * invariant rather than env plumbing.
     */
    function setEnvHours(raw: string | null): void {
        if (raw === null) {
            delete process.env.IBGE_CACHE_TTL_HOURS;
        } else {
            process.env.IBGE_CACHE_TTL_HOURS = raw;
        }
    }

    // ------------------------------------------------------------------
    // (a) numeric env values in [0, 1000]: covers the explicit task spec
    // ------------------------------------------------------------------

    it(
        "for any IBGE_CACHE_TTL_HOURS in [0, 1000], resolveTtlMsFromEnv clamps into [24h, 168h] and upsertCache writes a row whose (expiresAt - fetchedAt) is in that same window",
        async () => {
            // A single counter feeds unique cache keys per iteration so we
            // never confuse a fresh write with a leftover row.
            let iter = 0;

            await fc.assert(
                fc.asyncProperty(
                    fc.integer({ min: 0, max: 1000 }),
                    async (hours) => {
                        iter += 1;

                        setEnvHours(String(hours));

                        // (a.1) Resolver-level invariant: result is always in
                        //       [24h, 168h] regardless of the env value.
                        const ttlMs = resolveTtlMsFromEnv();

                        if (ttlMs < TWENTY_FOUR_HOURS_MS) {
                            throw new Error(
                                `resolveTtlMsFromEnv(${hours}) = ${ttlMs}ms < 24h (${TWENTY_FOUR_HOURS_MS}ms)`,
                            );
                        }
                        if (ttlMs > SEVEN_DAYS_MS) {
                            throw new Error(
                                `resolveTtlMsFromEnv(${hours}) = ${ttlMs}ms > 7d (${SEVEN_DAYS_MS}ms)`,
                            );
                        }

                        // (a.2) Clamping semantics: values inside the band
                        //       pass through unchanged; below-floor are
                        //       lifted to the floor; above-ceiling are
                        //       capped at the ceiling. This pins the exact
                        //       behaviour mandated by Requirement 4.5.
                        const expectedHours =
                            hours < 24 ? 24 : hours > 168 ? 168 : hours;
                        const expectedMs = expectedHours * ONE_HOUR_MS;
                        if (ttlMs !== expectedMs) {
                            throw new Error(
                                `resolveTtlMsFromEnv(${hours}) = ${ttlMs}ms; expected ${expectedMs}ms (clamped to ${expectedHours}h)`,
                            );
                        }

                        // (a.3) Direct shape of Property 21: any newly-written
                        //       IbgeCacheEntry has expiresAt - fetchedAt in
                        //       [24h, 168h]. We feed the resolver's output
                        //       through the production write path and read
                        //       the stored row back from the in-memory store.
                        const key = `prop21:numeric:${iter}:${hours}`;
                        await upsertCache(key, { iter, hours }, ttlMs);

                        const row = mocks.ibgeStore.get(key);
                        if (row === undefined) {
                            throw new Error(
                                `upsertCache did not persist a row for key '${key}'`,
                            );
                        }
                        const diff =
                            row.expiresAt.getTime() - row.fetchedAt.getTime();
                        if (
                            diff < TWENTY_FOUR_HOURS_MS ||
                            diff > SEVEN_DAYS_MS
                        ) {
                            throw new Error(
                                `IbgeCacheEntry(${key}): expiresAt - fetchedAt = ${diff}ms is outside [24h, 168h]`,
                            );
                        }

                        // (a.4) Cross-check: the persisted diff equals the
                        //       resolved TTL exactly (no silent drift).
                        if (diff !== ttlMs) {
                            throw new Error(
                                `IbgeCacheEntry(${key}): persisted diff ${diff}ms ≠ resolved ttlMs ${ttlMs}ms`,
                            );
                        }
                    },
                ),
                { numRuns: 50 },
            );
        },
    );

    // ------------------------------------------------------------------
    // (b) malformed env values: undefined / empty / non-numeric. The
    //     resolver must fall back to its default (72h) and the property
    //     must still hold for the row written by upsertCache.
    // ------------------------------------------------------------------

    it(
        "malformed IBGE_CACHE_TTL_HOURS values still resolve into [24h, 168h] and upsertCache respects the same window",
        async () => {
            // Rejected input shapes that resolveTtlMsFromEnv() must coerce to
            // the 72h default: explicit `null` (= unset), empty string,
            // whitespace-only, decimals, leading-plus, hex, garbage. All of
            // these are valid string forms a misconfigured deployment may
            // send.
            const malformedArb: fc.Arbitrary<string | null> = fc.oneof(
                fc.constant<string | null>(null),
                fc.constant(""),
                fc.constant("   "),
                fc.constant("abc"),
                fc.constant("12abc"),
                fc.constant("3.14"),
                fc.constant("+72"),
                fc.constant("-72"),
                fc.constant("0x10"),
                fc.string({ minLength: 1, maxLength: 20 }).filter((s) => {
                    // Keep only strings that are NOT a clean integer literal,
                    // so the malformed bucket stays distinct from case (a).
                    return !/^\s*-?\d+\s*$/.test(s);
                }),
            );

            let iter = 0;

            await fc.assert(
                fc.asyncProperty(malformedArb, async (raw) => {
                    iter += 1;

                    setEnvHours(raw);

                    const ttlMs = resolveTtlMsFromEnv();

                    if (
                        ttlMs < TWENTY_FOUR_HOURS_MS ||
                        ttlMs > SEVEN_DAYS_MS
                    ) {
                        throw new Error(
                            `resolveTtlMsFromEnv(raw=${JSON.stringify(raw)}) = ${ttlMs}ms is outside [24h, 168h]`,
                        );
                    }

                    const key = `prop21:malformed:${iter}`;
                    await upsertCache(key, { iter, raw }, ttlMs);

                    const row = mocks.ibgeStore.get(key);
                    if (row === undefined) {
                        throw new Error(
                            `upsertCache did not persist a row for key '${key}'`,
                        );
                    }
                    const diff =
                        row.expiresAt.getTime() - row.fetchedAt.getTime();
                    if (
                        diff < TWENTY_FOUR_HOURS_MS ||
                        diff > SEVEN_DAYS_MS
                    ) {
                        throw new Error(
                            `IbgeCacheEntry(${key}, raw=${JSON.stringify(raw)}): expiresAt - fetchedAt = ${diff}ms is outside [24h, 168h]`,
                        );
                    }
                    if (diff !== ttlMs) {
                        throw new Error(
                            `IbgeCacheEntry(${key}): persisted diff ${diff}ms ≠ resolved ttlMs ${ttlMs}ms`,
                        );
                    }
                }),
                { numRuns: 50 },
            );
        },
    );
});
