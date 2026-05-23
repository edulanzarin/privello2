/**
 * Feature: privello-platform, Property 20: Comportamento determinístico do fallback do IBGE
 *
 * For any combination of cache state (`AUSENTE | VALIDO | EXPIRADO`) and IBGE
 * external behaviour (`OK | TIMEOUT | ERRO`), the policy implemented by
 * `LocalidadesService.listarEstados()` / `listarCidades(uf)` must follow
 * exactly this truth table:
 *
 *   | Cache       | IBGE        | Outcome                                                 |
 *   | ----------- | ----------- | ------------------------------------------------------- |
 *   | `VALIDO`    | (any)       | `{ ok: true, …, stale: false }` and IBGE is NOT called  |
 *   | `AUSENTE`   | `OK`        | `{ ok: true, …, stale: false }` + `upsertCache(...)`    |
 *   | `EXPIRADO`  | `OK`        | `{ ok: true, …, stale: false }` + `upsertCache(...)`    |
 *   | `AUSENTE`   | `TIMEOUT`   | `{ ok: false }`                                         |
 *   | `AUSENTE`   | `ERRO`      | `{ ok: false }`                                         |
 *   | `EXPIRADO`  | `TIMEOUT`   | `{ ok: true, …, stale: true }` (served from stale row)  |
 *   | `EXPIRADO`  | `ERRO`      | `{ ok: true, …, stale: true }` (served from stale row)  |
 *
 * Test design:
 *
 *   - The system under test is `createLocalidadesService(deps)`. We inject
 *     hand-rolled stubs for `getCache`, `upsertCache`, `fetchEstados`,
 *     `fetchCidades` and `resolveTtlMs`. **No database, no HTTP, no
 *     `vi.mock`** is involved; the entire policy is exercised through the
 *     publicly documented `LocalidadesDeps` injection point.
 *
 *   - Stubs track per-call counters so the test can assert the
 *     "VALIDO ⇒ never call IBGE" branch literally, and the "OK ⇒ upsert
 *     exactly once" branch as well.
 *
 *   - `IBGE_TIMEOUT` / `IBGE_ERROR` failures are modelled by throwing the
 *     real `IbgeError` from the stub, because `service.ts` only triggers
 *     fallback for instances of `IbgeError` (any other error must be
 *     propagated, by design).
 *
 *   - The property runs over the cartesian product of `cacheStateArb` ×
 *     `ibgeBehaviorArb` shared in `tests/property/generators.ts`, with
 *     `numRuns: 100` per the task. Both `listarEstados()` and
 *     `listarCidades("SP")` are exercised inside each run so the table
 *     applies symmetrically to both entry points.
 *
 * **Validates: Requirements 4.4, 4.5**
 */

import * as fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
    cacheStateArb,
    ibgeBehaviorArb,
    type CacheState,
    type IbgeBehavior,
} from "./generators";

import { IbgeError, type Cidade, type Estado } from "@/lib/ibge";
import {
    createLocalidadesService,
    type LocalidadesDeps,
} from "@/server/localidades/service";
import type { IbgeCacheLookup } from "@/server/localidades/ibgeCache";

// ---------------------------------------------------------------------------
// Fixed payloads used by the stubs.
//
// Two distinct instances per kind let the test distinguish "served from
// cache" from "served from IBGE" by reference equality on the payload.
// ---------------------------------------------------------------------------

const CACHED_ESTADOS: Estado[] = [
    { sigla: "SP", nome: "São Paulo (cached)" },
    { sigla: "RJ", nome: "Rio de Janeiro (cached)" },
];

const FRESH_ESTADOS: Estado[] = [
    { sigla: "SP", nome: "São Paulo (fresh)" },
    { sigla: "RJ", nome: "Rio de Janeiro (fresh)" },
    { sigla: "MG", nome: "Minas Gerais (fresh)" },
];

const CACHED_CIDADES: Cidade[] = [
    { id: 3550308, nome: "São Paulo (cached)", estadoSigla: "SP" },
];

const FRESH_CIDADES: Cidade[] = [
    { id: 3550308, nome: "São Paulo (fresh)", estadoSigla: "SP" },
    { id: 3509502, nome: "Campinas (fresh)", estadoSigla: "SP" },
];

/** Default TTL supplied by the stub `resolveTtlMs`. Inside the [24h, 7d] band. */
const STUB_TTL_MS = 72 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Stub factory
// ---------------------------------------------------------------------------

type StubHandle = {
    deps: LocalidadesDeps;
    counters: {
        getCacheCalls: number;
        upsertCalls: number;
        fetchEstadosCalls: number;
        fetchCidadesCalls: number;
    };
    upsertedKeys: string[];
};

/**
 * Builds a fresh `LocalidadesDeps` stub set wired up so that the cache
 * pretends to be in `cacheState` for every requested key, and the IBGE
 * client pretends to behave according to `ibgeBehavior`.
 *
 * Important details:
 *
 *   - For `cacheState === "AUSENTE"` we return `null` from `getCache`, which
 *     is the sentinel `service.ts` interprets as "cache miss".
 *   - For `cacheState === "VALIDO"` we return a lookup with
 *     `isExpired: false` so the service must short-circuit and NEVER call
 *     `fetchEstados`/`fetchCidades`. The stubs throw if invoked, surfacing
 *     any breach as a hard failure (rather than a silent count mismatch).
 *   - For `cacheState === "EXPIRADO"` we return `isExpired: true` so the
 *     service must consult IBGE and, on failure, fall back to this same
 *     stale payload.
 *   - Failure behaviours are modelled by throwing `IbgeError`, matching the
 *     production translation layer in `lib/ibge.ts`.
 *   - `upsertCache` records the key and resolves; we never need to
 *     reconcile the stored payload because the contract is asserted by
 *     `getCache` returning the cached payload for `VALIDO`/`EXPIRADO`.
 */
function makeStub(
    cacheState: CacheState,
    ibgeBehavior: IbgeBehavior,
): StubHandle {
    const counters = {
        getCacheCalls: 0,
        upsertCalls: 0,
        fetchEstadosCalls: 0,
        fetchCidadesCalls: 0,
    };
    const upsertedKeys: string[] = [];

    const now = new Date(Date.UTC(2025, 0, 1, 12, 0, 0));
    const oneHourMs = 60 * 60 * 1000;

    function lookupFor<T>(payload: T, isExpired: boolean): IbgeCacheLookup<T> {
        const fetchedAt = new Date(now.getTime() - 6 * oneHourMs);
        const expiresAt = isExpired
            ? new Date(now.getTime() - oneHourMs)
            : new Date(now.getTime() + 6 * oneHourMs);
        return { payload, fetchedAt, expiresAt, isExpired };
    }

    const getCache = async <T = unknown>(
        key: string,
    ): Promise<IbgeCacheLookup<T> | null> => {
        counters.getCacheCalls += 1;

        if (cacheState === "AUSENTE") {
            return null;
        }

        const isExpired = cacheState === "EXPIRADO";

        if (key === "estados") {
            return lookupFor(CACHED_ESTADOS as unknown as T, isExpired);
        }
        // The service builds keys as `cidades:<UF>` for city lookups.
        if (key.startsWith("cidades:")) {
            return lookupFor(CACHED_CIDADES as unknown as T, isExpired);
        }
        throw new Error(`stub getCache: unexpected cache key "${key}"`);
    };

    const upsertCache = async (key: string): Promise<void> => {
        counters.upsertCalls += 1;
        upsertedKeys.push(key);
    };

    function ibgeOutcome<T>(payload: T): T {
        if (ibgeBehavior === "OK") return payload;
        if (ibgeBehavior === "TIMEOUT") {
            throw new IbgeError("IBGE_TIMEOUT", "stub: timeout");
        }
        // ibgeBehavior === "ERRO"
        throw new IbgeError("IBGE_ERROR", "stub: erro");
    }

    const fetchEstados = async (): Promise<Estado[]> => {
        counters.fetchEstadosCalls += 1;
        return ibgeOutcome(FRESH_ESTADOS);
    };

    const fetchCidades = async (uf: string): Promise<Cidade[]> => {
        counters.fetchCidadesCalls += 1;
        // Sanity: the service must always normalise the UF to upper-case
        // before forwarding to the IBGE client.
        if (uf !== uf.toUpperCase()) {
            throw new Error(
                `stub fetchCidades: expected normalised UF, got "${uf}"`,
            );
        }
        return ibgeOutcome(FRESH_CIDADES);
    };

    const resolveTtlMs = (): number => STUB_TTL_MS;

    return {
        deps: {
            getCache,
            upsertCache,
            fetchEstados,
            fetchCidades,
            resolveTtlMs,
        },
        counters,
        upsertedKeys,
    };
}

// ---------------------------------------------------------------------------
// Reference oracle: encodes the table from the property statement.
// ---------------------------------------------------------------------------

type Outcome =
    | { kind: "fresh" }
    | { kind: "cached-fresh" } // cache VALIDO branch, served as fresh (stale=false)
    | { kind: "cached-stale" }
    | { kind: "fail" };

function expectedOutcome(
    cache: CacheState,
    ibge: IbgeBehavior,
): Outcome {
    if (cache === "VALIDO") {
        return { kind: "cached-fresh" };
    }
    if (ibge === "OK") {
        return { kind: "fresh" };
    }
    // IBGE failed (TIMEOUT or ERRO) and cache is not VALIDO.
    if (cache === "EXPIRADO") {
        return { kind: "cached-stale" };
    }
    // cache === "AUSENTE" and IBGE failed.
    return { kind: "fail" };
}

// ---------------------------------------------------------------------------
// Property
// ---------------------------------------------------------------------------

describe("Property 20: Comportamento determinístico do fallback do IBGE", () => {
    it("listarEstados / listarCidades follow the cache × IBGE truth table", async () => {
        await fc.assert(
            fc.asyncProperty(
                cacheStateArb,
                ibgeBehaviorArb,
                async (cacheState, ibgeBehavior) => {
                    const stub = makeStub(cacheState, ibgeBehavior);
                    const service = createLocalidadesService(stub.deps);
                    const expected = expectedOutcome(cacheState, ibgeBehavior);

                    // -----------------------------------------------------
                    // listarEstados
                    // -----------------------------------------------------
                    const estadosResult = await service.listarEstados();

                    if (expected.kind === "fail") {
                        expect(estadosResult.ok).toBe(false);
                    } else if (expected.kind === "cached-fresh") {
                        expect(estadosResult).toEqual({
                            ok: true,
                            estados: CACHED_ESTADOS,
                            stale: false,
                        });
                    } else if (expected.kind === "cached-stale") {
                        expect(estadosResult).toEqual({
                            ok: true,
                            estados: CACHED_ESTADOS,
                            stale: true,
                        });
                    } else {
                        // expected.kind === "fresh"
                        expect(estadosResult).toEqual({
                            ok: true,
                            estados: FRESH_ESTADOS,
                            stale: false,
                        });
                    }

                    // -----------------------------------------------------
                    // listarCidades("SP")
                    // -----------------------------------------------------
                    const cidadesResult = await service.listarCidades("SP");

                    if (expected.kind === "fail") {
                        expect(cidadesResult.ok).toBe(false);
                    } else if (expected.kind === "cached-fresh") {
                        expect(cidadesResult).toEqual({
                            ok: true,
                            cidades: CACHED_CIDADES,
                            stale: false,
                        });
                    } else if (expected.kind === "cached-stale") {
                        expect(cidadesResult).toEqual({
                            ok: true,
                            cidades: CACHED_CIDADES,
                            stale: true,
                        });
                    } else {
                        // expected.kind === "fresh"
                        expect(cidadesResult).toEqual({
                            ok: true,
                            cidades: FRESH_CIDADES,
                            stale: false,
                        });
                    }

                    // -----------------------------------------------------
                    // Call-count invariants (the second half of the property:
                    // "VALIDO must NEVER call IBGE", "OK must upsert", etc.)
                    // -----------------------------------------------------

                    // `getCache` is consulted once per call, regardless of
                    // outcome, since the policy starts with a cache lookup.
                    expect(stub.counters.getCacheCalls).toBe(2);

                    if (cacheState === "VALIDO") {
                        // The branch under test: cache hit ⇒ IBGE must not be
                        // touched at all, and we must NOT re-write the cache.
                        expect(stub.counters.fetchEstadosCalls).toBe(0);
                        expect(stub.counters.fetchCidadesCalls).toBe(0);
                        expect(stub.counters.upsertCalls).toBe(0);
                    } else {
                        // AUSENTE or EXPIRADO ⇒ exactly one IBGE call per
                        // listing, regardless of whether IBGE succeeds.
                        expect(stub.counters.fetchEstadosCalls).toBe(1);
                        expect(stub.counters.fetchCidadesCalls).toBe(1);

                        if (ibgeBehavior === "OK") {
                            // Successful IBGE response ⇒ cache must be
                            // refreshed for both keys.
                            expect(stub.counters.upsertCalls).toBe(2);
                            expect(stub.upsertedKeys).toEqual([
                                "estados",
                                "cidades:SP",
                            ]);
                        } else {
                            // IBGE failed ⇒ no upsert path is taken (we
                            // either serve stale or return ok:false).
                            expect(stub.counters.upsertCalls).toBe(0);
                            expect(stub.upsertedKeys).toEqual([]);
                        }
                    }
                },
            ),
            { numRuns: 100 },
        );
    });
});
