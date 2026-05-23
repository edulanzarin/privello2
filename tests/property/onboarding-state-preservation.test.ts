/**
 * Feature: privello-platform, Property 13: Estado parcial do onboarding é preservado entre etapas
 *
 * For any sequence of `atualizarEtapa(onboardingId, etapaᵢ, patchᵢ)` calls
 * performed within the 60 minute inactivity window without an intervening
 * `descartar`, the state read subsequently is the shallow merge of all
 * `patchᵢ` in the order applied (last value per top-level key wins), and
 * no patch is lost when the user navigates back to an earlier step.
 *
 * Rationale and test design:
 *
 *   - The contract under test is `atualizarEtapa` from
 *     `src/server/onboarding/drafts.ts`. Its API does not take an explicit
 *     `etapa` argument: a "navigation back" simply manifests as another
 *     call that re-touches keys already present in earlier patches. The
 *     property is therefore expressed over an arbitrary chronological list
 *     of patches.
 *
 *   - The reference function `mergeInOrder` reproduces the expected
 *     semantics literally (`Object.assign({}, ...patches)`) WITHOUT
 *     reusing the production code, so the property validates observable
 *     behaviour rather than tautological self-consistency.
 *
 *   - Three invariants are asserted, jointly covering the property:
 *       (a) After each step, the data returned by `atualizarEtapa`
 *           equals `mergeInOrder(patches[0..=i])` (no key is dropped or
 *           reordered prematurely).
 *       (b) The final read of the draft via `obter` matches the same
 *           merge result (state survives across reads).
 *       (c) Keys set in earlier patches that were NOT overwritten by any
 *           later patch are still present at the end (the explicit
 *           "navigating back never loses data" half of the property).
 *
 *   - Patches draw values from a small key pool with intentional overlap
 *     so that last-write-wins is actually exercised. Values stay
 *     JSON-serialisable (Prisma stores `payload` as `Json`).
 *
 *   - All clock advances stay strictly within the 60 minute TTL so the
 *     "without discard" precondition of the property holds for every
 *     generated example.
 *
 *   - `numRuns` is set to 100 (per the task spec), each run executing at
 *     most a handful of patches against the in-memory Prisma stub, which
 *     keeps the suite well below Vitest's default timeout.
 *
 * **Validates: Requirements 3.2**
 */

import * as fc from "fast-check";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// In-memory Prisma stub for @/lib/db
//
// Mirrors the subset of `prisma.onboardingDraft` used by `iniciar`,
// `atualizarEtapa` and `obter`. The store is keyed by draft id and is
// reset between runs of the property so each run starts from a clean
// state.
// ---------------------------------------------------------------------------

type DraftRow = {
    id: string;
    payload: Record<string, unknown>;
    stagedKey: string | null;
    createdAt: Date;
    updatedAt: Date;
    expiresAt: Date;
};

const draftStore = new Map<string, DraftRow>();
let nextDraftId = 1;

function pickFields(
    row: DraftRow,
    select?: Partial<Record<keyof DraftRow, boolean>>,
): Partial<DraftRow> {
    if (!select) return { ...row };
    const out: Partial<DraftRow> = {};
    for (const key of Object.keys(select) as (keyof DraftRow)[]) {
        if (select[key]) {
            (out as Record<string, unknown>)[key] = row[key];
        }
    }
    return out;
}

vi.mock("@/lib/db", () => {
    return {
        db: {
            onboardingDraft: {
                async create({
                    data,
                    select,
                }: {
                    data: { payload: Record<string, unknown>; expiresAt: Date };
                    select?: Partial<Record<keyof DraftRow, boolean>>;
                }) {
                    const id = `draft-${nextDraftId++}`;
                    const now = new Date();
                    const row: DraftRow = {
                        id,
                        payload: data.payload ?? {},
                        stagedKey: null,
                        createdAt: now,
                        updatedAt: now,
                        expiresAt: data.expiresAt,
                    };
                    draftStore.set(id, row);
                    return pickFields(row, select);
                },
                async findUnique({
                    where,
                    select,
                }: {
                    where: { id: string };
                    select?: Partial<Record<keyof DraftRow, boolean>>;
                }) {
                    const row = draftStore.get(where.id);
                    if (!row) return null;
                    return pickFields(row, select);
                },
                async update({
                    where,
                    data,
                    select,
                }: {
                    where: { id: string };
                    data: Partial<DraftRow>;
                    select?: Partial<Record<keyof DraftRow, boolean>>;
                }) {
                    const row = draftStore.get(where.id);
                    if (!row) {
                        throw new Error(`draft '${where.id}' not found`);
                    }
                    const next: DraftRow = {
                        ...row,
                        ...data,
                        updatedAt: new Date(),
                    };
                    draftStore.set(next.id, next);
                    return pickFields(next, select);
                },
                async delete({ where }: { where: { id: string } }) {
                    draftStore.delete(where.id);
                    return {};
                },
            },
        },
    };
});

// Imports of the SUT must come AFTER `vi.mock` so the mock is in effect.
import {
    DRAFT_TTL_MS,
    atualizarEtapa,
    iniciar,
    obter,
    type DraftPayload,
} from "@/server/onboarding/drafts";

// ---------------------------------------------------------------------------
// Reference semantics (transcription of Property 13)
// ---------------------------------------------------------------------------

/**
 * Shallow merge of an ordered list of patches with last-write-wins per
 * top-level key. Written without reusing production code so that the
 * property check is independent of the implementation under test.
 */
function mergeInOrder(patches: ReadonlyArray<DraftPayload>): DraftPayload {
    const out: DraftPayload = {};
    for (const patch of patches) {
        for (const k of Object.keys(patch)) {
            out[k] = patch[k];
        }
    }
    return out;
}

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

/**
 * Small key pool drawn from `OnboardingData` (design.md). A small pool
 * forces overlap between patches so the property actually exercises the
 * last-write-wins rule rather than degenerating into disjoint merges.
 */
const onboardingKeyArb: fc.Arbitrary<string> = fc.constantFrom(
    "nome",
    "email",
    "identificador",
    "telefone",
    "estadoSigla",
    "cidadeNome",
    "descricao",
    "stepCursor",
);

/**
 * JSON-serialisable values for patch entries. Avoids `undefined` (Prisma
 * Json columns reject it and JS spread would copy the property as
 * `undefined`, which is not what the production code aims to express).
 */
const onboardingValueArb: fc.Arbitrary<unknown> = fc.oneof(
    fc.string({ maxLength: 30 }),
    fc.integer({ min: -1000, max: 1000 }),
    fc.boolean(),
    fc.constant(null),
);

/**
 * A single patch: a small object whose keys are drawn from the shared
 * pool. Empty patches are allowed (they exercise the no-op merge case).
 */
const patchArb: fc.Arbitrary<DraftPayload> = fc
    .array(fc.tuple(onboardingKeyArb, onboardingValueArb), {
        minLength: 0,
        maxLength: 5,
    })
    .map((entries) => Object.fromEntries(entries) as DraftPayload);

/**
 * Sequence of 1..8 patches. With the shared key pool, sequences of this
 * length give plenty of overlap and at least one revisit on average.
 */
const patchSequenceArb: fc.Arbitrary<DraftPayload[]> = fc.array(patchArb, {
    minLength: 1,
    maxLength: 8,
});

// ---------------------------------------------------------------------------
// Property
// ---------------------------------------------------------------------------

describe("Property 13: Estado parcial do onboarding é preservado entre etapas", () => {
    beforeEach(() => {
        draftStore.clear();
        nextDraftId = 1;
    });

    afterEach(() => {
        draftStore.clear();
    });

    it("merges patches in order with last-write-wins, never losing earlier keys not overwritten", async () => {
        await fc.assert(
            fc.asyncProperty(patchSequenceArb, async (patches) => {
                draftStore.clear();
                nextDraftId = 1;

                // Anchor every iteration at a fixed instant. Each patch
                // advances the clock by 1 minute, well within the 60
                // minute TTL, so the "without discard" precondition of
                // Property 13 holds throughout the sequence.
                const t0 = new Date("2025-01-01T00:00:00.000Z").getTime();
                const tickMs = 60 * 1000;

                const { onboardingId } = await iniciar({ now: new Date(t0) });

                // (a) After each step, the data returned by
                //     `atualizarEtapa` equals the cumulative merge of
                //     all patches applied so far.
                let cumulative: DraftPayload = {};
                for (let i = 0; i < patches.length; i++) {
                    const now = new Date(t0 + (i + 1) * tickMs);
                    const { data, expiresAt } = await atualizarEtapa(
                        onboardingId,
                        patches[i],
                        { now },
                    );

                    cumulative = mergeInOrder(patches.slice(0, i + 1));
                    if (!deepEqualPlainObject(data, cumulative)) {
                        throw new Error(
                            `step ${i}: expected ${JSON.stringify(
                                cumulative,
                            )} got ${JSON.stringify(data)}`,
                        );
                    }

                    // Sanity check: TTL is always renewed to now + 60min,
                    // so the next iteration is still within the window.
                    const expectedExpiry = now.getTime() + DRAFT_TTL_MS;
                    if (expiresAt.getTime() !== expectedExpiry) {
                        throw new Error(
                            `step ${i}: expected expiresAt=${expectedExpiry} got ${expiresAt.getTime()}`,
                        );
                    }
                }

                // (b) Reading the draft after the whole sequence yields
                //     exactly the same merge, confirming the state was
                //     persisted (not just returned by the last write).
                const lastTickNow = new Date(
                    t0 + (patches.length + 1) * tickMs,
                );
                const read = await obter(onboardingId, { now: lastTickNow });
                if (!read) {
                    throw new Error("expected obter() to return the draft");
                }
                const finalExpected = mergeInOrder(patches);
                if (!deepEqualPlainObject(read.data, finalExpected)) {
                    throw new Error(
                        `final read: expected ${JSON.stringify(
                            finalExpected,
                        )} got ${JSON.stringify(read.data)}`,
                    );
                }

                // (c) Explicit "navigating back never loses data" check:
                //     every key written by any patch and never
                //     overwritten by a later patch must still hold its
                //     original value at the end.
                for (let i = 0; i < patches.length; i++) {
                    for (const k of Object.keys(patches[i])) {
                        const overwrittenLater = patches
                            .slice(i + 1)
                            .some((later) =>
                                Object.prototype.hasOwnProperty.call(later, k),
                            );
                        if (overwrittenLater) continue;
                        if (
                            !Object.prototype.hasOwnProperty.call(read.data, k)
                        ) {
                            throw new Error(
                                `key '${k}' from patch ${i} disappeared from final state`,
                            );
                        }
                        const expectedValue = patches[i][k];
                        const actualValue = read.data[k];
                        if (!sameJsonValue(actualValue, expectedValue)) {
                            throw new Error(
                                `key '${k}' from patch ${i}: expected ${JSON.stringify(
                                    expectedValue,
                                )} got ${JSON.stringify(actualValue)}`,
                            );
                        }
                    }
                }
            }),
            { numRuns: 100 },
        );
    });
});

// ---------------------------------------------------------------------------
// Plain-object equality helpers
//
// We keep equality logic explicit (rather than reaching for `expect`
// inside the property body) so that fast-check shrinking shows the
// counterexample directly. Values produced by the generators are always
// JSON-serialisable scalars, so a simple recursive-free comparison is
// sufficient.
// ---------------------------------------------------------------------------

function deepEqualPlainObject(
    a: Record<string, unknown>,
    b: Record<string, unknown>,
): boolean {
    const ak = Object.keys(a).sort();
    const bk = Object.keys(b).sort();
    if (ak.length !== bk.length) return false;
    for (let i = 0; i < ak.length; i++) {
        if (ak[i] !== bk[i]) return false;
        if (!sameJsonValue(a[ak[i]], b[bk[i]])) return false;
    }
    return true;
}

function sameJsonValue(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (a === null || b === null) return a === b;
    if (typeof a !== typeof b) return false;
    return false;
}
