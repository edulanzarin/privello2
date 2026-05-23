// Feature: privello-platform, Property 17: Listagem de estados sempre retorna 27 UFs
/**
 * Property 17 — Listagem de estados sempre retorna 27 UFs.
 *
 * For any call to `listarEstados()` in any cache state (AUSENTE, VALIDO,
 * EXPIRADO) with the API_IBGE responding correctly per its contract, the
 * result must contain exactly 27 unidades federativas, each with a `sigla`
 * of two uppercase letters and pairwise distinct from the others.
 *
 * ### Test strategy
 *
 * The property is tested at the seam of the `LocalidadesService` itself,
 * using `createLocalidadesService` with INJECTED stubs (no real DB, no real
 * HTTP). Each fast-check iteration picks one of the three cache states and
 * builds the corresponding pair of stubs:
 *
 *   - **AUSENTE**: `getCache` returns `null` → service must call IBGE,
 *     which returns the canonical 27-UF list, and upsert it into the cache.
 *   - **VALIDO**: `getCache` returns the canonical list with
 *     `isExpired: false` → service must NOT call IBGE and return the cache
 *     payload as-is.
 *   - **EXPIRADO**: `getCache` returns the canonical list with
 *     `isExpired: true` → service must call IBGE (which here succeeds with
 *     the same canonical list) and refresh the cache.
 *
 * Both the cache payload (when present) and the IBGE stub return the same
 * canonical 27-UF list, which models "API_IBGE respondendo conforme
 * contrato". The property is then a single shape assertion regardless of
 * which branch was taken: 27 entries, all `sigla` distinct, all matching
 * `^[A-Z]{2}$`.
 *
 * **Validates: Requirements 4.1**
 */

import { describe, expect, it } from "vitest";
import * as fc from "fast-check";

import { createLocalidadesService } from "@/server/localidades/service";
import type { Estado } from "@/lib/ibge";
import type { IbgeCacheLookup } from "@/server/localidades/ibgeCache";

import { cacheStateArb, type CacheState } from "./generators";

// ---------------------------------------------------------------------------
// Canonical IBGE response (27 UFs)
// ---------------------------------------------------------------------------
//
// Mirror of what the real IBGE returns for `/v1/localidades/estados`,
// trimmed to the fields the service consumes (`sigla`, `nome`). The list is
// frozen so iterations cannot accidentally mutate it across runs.
const CANONICAL_27_UFS: ReadonlyArray<Estado> = Object.freeze([
    { sigla: "AC", nome: "Acre" },
    { sigla: "AL", nome: "Alagoas" },
    { sigla: "AM", nome: "Amazonas" },
    { sigla: "AP", nome: "Amapá" },
    { sigla: "BA", nome: "Bahia" },
    { sigla: "CE", nome: "Ceará" },
    { sigla: "DF", nome: "Distrito Federal" },
    { sigla: "ES", nome: "Espírito Santo" },
    { sigla: "GO", nome: "Goiás" },
    { sigla: "MA", nome: "Maranhão" },
    { sigla: "MG", nome: "Minas Gerais" },
    { sigla: "MS", nome: "Mato Grosso do Sul" },
    { sigla: "MT", nome: "Mato Grosso" },
    { sigla: "PA", nome: "Pará" },
    { sigla: "PB", nome: "Paraíba" },
    { sigla: "PE", nome: "Pernambuco" },
    { sigla: "PI", nome: "Piauí" },
    { sigla: "PR", nome: "Paraná" },
    { sigla: "RJ", nome: "Rio de Janeiro" },
    { sigla: "RN", nome: "Rio Grande do Norte" },
    { sigla: "RO", nome: "Rondônia" },
    { sigla: "RR", nome: "Roraima" },
    { sigla: "RS", nome: "Rio Grande do Sul" },
    { sigla: "SC", nome: "Santa Catarina" },
    { sigla: "SE", nome: "Sergipe" },
    { sigla: "SP", nome: "São Paulo" },
    { sigla: "TO", nome: "Tocantins" },
]);

const SIGLA_PATTERN = /^[A-Z]{2}$/;

// ---------------------------------------------------------------------------
// Stub builders
// ---------------------------------------------------------------------------

/**
 * Builds a `getCache` stub that simulates the chosen cache state for the
 * `"estados"` key. Only the lookup invariant matters here (presence + the
 * `isExpired` flag); other keys are irrelevant for this property.
 */
function buildGetCache(state: CacheState) {
    return async <T = unknown>(
        key: string,
    ): Promise<IbgeCacheLookup<T> | null> => {
        if (key !== "estados") {
            return null;
        }
        if (state === "AUSENTE") {
            return null;
        }
        const now = Date.now();
        // VALIDO: not expired (expiresAt in the future).
        // EXPIRADO: stale (expiresAt in the past), still has payload available.
        const isExpired = state === "EXPIRADO";
        return {
            payload: CANONICAL_27_UFS as unknown as T,
            fetchedAt: new Date(now - 60_000),
            expiresAt: new Date(isExpired ? now - 1_000 : now + 60_000),
            isExpired,
        };
    };
}

/**
 * Builds a service instance with injected stubs that model the chosen cache
 * state and a healthy IBGE returning the canonical 27 UFs. The returned
 * `calls` counters let assertions verify the cache×fetch decision table when
 * needed (the property itself only inspects the result shape).
 */
function buildService(state: CacheState) {
    const calls = { fetchEstados: 0, upsertCache: 0 };
    const service = createLocalidadesService({
        fetchEstados: async () => {
            calls.fetchEstados += 1;
            // Return a fresh shallow copy so the service cannot accidentally
            // mutate the canonical reference between iterations.
            return CANONICAL_27_UFS.map((e) => ({ ...e }));
        },
        fetchCidades: async () => {
            // Not exercised by Property 17; kept as a defensive stub.
            return [];
        },
        getCache: buildGetCache(state),
        upsertCache: async () => {
            calls.upsertCache += 1;
        },
        resolveTtlMs: () => 24 * 60 * 60 * 1000,
    });
    return { service, calls };
}

// ---------------------------------------------------------------------------
// Property
// ---------------------------------------------------------------------------

describe("Property 17: listagem de estados sempre retorna 27 UFs", () => {
    it("retorna exatamente 27 UFs distintas com sigla `^[A-Z]{2}$` em qualquer estado de cache", async () => {
        await fc.assert(
            fc.asyncProperty(cacheStateArb, async (state) => {
                const { service } = buildService(state);

                const result = await service.listarEstados();

                // The IBGE stub never fails, so under all three cache states
                // the service must produce a successful response.
                expect(result.ok).toBe(true);
                if (!result.ok) return; // narrowing for TS

                // Cardinality: exactly 27 entries, no more, no less.
                expect(result.estados).toHaveLength(27);

                // Each `sigla` is two uppercase ASCII letters.
                for (const estado of result.estados) {
                    expect(estado.sigla).toMatch(SIGLA_PATTERN);
                }

                // Distinctness: all 27 siglas are pairwise unique.
                const siglas = result.estados.map((e) => e.sigla);
                const distinct = new Set(siglas);
                expect(distinct.size).toBe(27);
            }),
            { numRuns: 100 },
        );
    });
});
