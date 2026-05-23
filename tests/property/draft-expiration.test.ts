// Feature: privello-platform, Property 14: Drafts de onboarding expiram após 60 minutos de inatividade
/**
 * Property 14 — Drafts de onboarding expiram após 60 minutos de inatividade.
 *
 * **Validates: Requirements 3.3, 3.4**
 *
 * Statement (transcrito literalmente do design.md):
 *
 *   For any draft com `updatedAt = u`, e qualquer instante `t > u + 60
 *   minutos`, qualquer operação de leitura/atualização do draft falha como
 *   expirada e o sistema descarta o draft, removendo o objeto staged em R2
 *   quando existir, sem criar conta nem reservar identificador.
 *
 * O serviço sob teste é {@link import("@/server/onboarding/drafts")}. As
 * operações de leitura/atualização cobertas são, exatamente, as três que
 * tocam um draft existente: `obter`, `atualizarEtapa` e `uploadFoto`. Para
 * cada `t > u + 60min`:
 *
 *   - `atualizarEtapa(id, patch, { now: t })` deve rejeitar com
 *     `DraftExpiredError` (operação de atualização "falha como expirada").
 *   - `uploadFoto(id, fileValido, { now: t })` deve rejeitar com
 *     `DraftExpiredError` (operação de atualização "falha como expirada").
 *   - `obter(id, { now: t })` deve resolver `null` (operação de leitura
 *     "falha como expirada") e, ao mesmo tempo, "o sistema descarta o
 *     draft": a linha em `OnboardingDraft` é removida e, quando existia
 *     um `stagedKey`, o objeto correspondente em R2 também desaparece.
 *
 * O fragmento "sem criar conta nem reservar identificador" é coberto
 * estruturalmente: o mock de Prisma usado pelo teste expõe somente o
 * accessor `onboardingDraft`. Qualquer tentativa do serviço em criar
 * `User`, `AcompanhanteProfile` ou outra entidade quebraria com
 * `TypeError: Cannot read properties of undefined`. O teste portanto
 * confia nessa "ausência por construção" para validar a invariante.
 *
 * Notas de implementação:
 *   - Drafts são modelados em memória num `Map<string, DraftRow>`. O mock
 *     reproduz o subconjunto de `db.onboardingDraft` que o serviço chama
 *     (`findUnique`, `update`, `delete`); operações desconhecidas falham.
 *   - O R2 é injetado via `__setR2ClientForTests` com o stub
 *     `tests/helpers/r2-stub.ts`. Drafts com `stagedKey` recebem um
 *     objeto pré-populado em `staged/<uuid>` para que possamos observar
 *     a deleção.
 *   - As operações são exercitadas em sequência (atualizar → upload →
 *     obter). Após `obter` a propriedade exige que a linha + o staged
 *     tenham sumido; rodar as três antes de checar dá ao implementação
 *     espaço para descartar lazyly em qualquer ponto.
 */

import { describe, it, beforeEach, vi, expect } from "vitest";
import * as fc from "fast-check";
import { randomUUID } from "node:crypto";

// ---------------------------------------------------------------------------
// In-memory mock of `@/lib/db`.
//
// `vi.hoisted` makes the store accessible from both the mock factory and
// the test body. Only the prisma surface actually used by the drafts
// service is implemented; everything else is intentionally absent so a
// regression that calls e.g. `db.user.create` blows up loudly.
// ---------------------------------------------------------------------------

interface DraftRow {
    id: string;
    payload: unknown;
    stagedKey: string | null;
    createdAt: Date;
    updatedAt: Date;
    expiresAt: Date;
}

const mocks = vi.hoisted(() => {
    const draftStore = new Map<string, DraftRow>();
    return { draftStore };
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
            onboardingDraft: {
                findUnique: async (args: {
                    where: { id: string };
                    select?: Record<string, boolean>;
                }) => {
                    const row = mocks.draftStore.get(args.where.id);
                    if (!row) return null;
                    return pick(row, args.select);
                },
                update: async (args: {
                    where: { id: string };
                    data: Partial<DraftRow>;
                    select?: Record<string, boolean>;
                }) => {
                    const row = mocks.draftStore.get(args.where.id);
                    if (!row) {
                        throw new Error(
                            `[mock prisma] update: draft '${args.where.id}' not found`,
                        );
                    }
                    const next: DraftRow = { ...row };
                    if (args.data.payload !== undefined) {
                        next.payload = args.data.payload;
                    }
                    if (args.data.stagedKey !== undefined) {
                        next.stagedKey = args.data.stagedKey ?? null;
                    }
                    if (args.data.expiresAt !== undefined) {
                        next.expiresAt = args.data.expiresAt as Date;
                    }
                    next.updatedAt = new Date();
                    mocks.draftStore.set(args.where.id, next);
                    return pick(next, args.select);
                },
                delete: async (args: { where: { id: string } }) => {
                    const row = mocks.draftStore.get(args.where.id);
                    if (!row) {
                        throw new Error(
                            `[mock prisma] delete: draft '${args.where.id}' not found`,
                        );
                    }
                    mocks.draftStore.delete(args.where.id);
                    return row;
                },
            },
        },
    };
});

// Imports must come AFTER `vi.mock` so the mock is in place when the
// service module captures its `db` reference at import time.
import {
    DRAFT_TTL_MS,
    DraftExpiredError,
    __setR2ClientForTests,
    atualizarEtapa,
    obter,
    uploadFoto,
} from "@/server/onboarding/drafts";
import { createR2Stub } from "../helpers/r2-stub";

// ---------------------------------------------------------------------------
// Test
// ---------------------------------------------------------------------------

describe("Property 14: Drafts de onboarding expiram após 60 minutos de inatividade", () => {
    let r2Stub: ReturnType<typeof createR2Stub>;

    beforeEach(() => {
        mocks.draftStore.clear();
        r2Stub = createR2Stub();
        __setR2ClientForTests(r2Stub);
    });

    it(
        "for any draft with updatedAt=u and any t > u + 60 min, read/update operations fail and the system discards the draft",
        { timeout: 60_000 },
        async () => {
            await fc.assert(
                fc.asyncProperty(
                    fc.record({
                        // Anchor `u` (updatedAt). Range stays well within JS
                        // Date safe space (≈ year 2096) so `u + 60min + extra`
                        // never overflows Number.
                        uMillis: fc.integer({ min: 0, max: 4_000_000_000_000 }),
                        // Strictly positive offset beyond the 60-minute TTL so
                        // we always sit in the expired half-line `t > u + 60min`.
                        extraMs: fc.integer({
                            min: 1,
                            max: 365 * 24 * 60 * 60 * 1000, // up to one year
                        }),
                        // Drafts without a stagedKey vs. with one — both must be
                        // cleaned up (no staged → nothing to delete in R2; with
                        // staged → the object disappears).
                        hasStaged: fc.boolean(),
                        // Arbitrary patch payload to exercise atualizarEtapa.
                        patchKey: fc.string({ minLength: 1, maxLength: 12 }),
                        patchValue: fc.string({ maxLength: 32 }),
                    }),
                    async ({
                        uMillis,
                        extraMs,
                        hasStaged,
                        patchKey,
                        patchValue,
                    }) => {
                        // Each iteration starts from a clean slate so that
                        // residue from the previous run cannot mask a bug.
                        mocks.draftStore.clear();
                        r2Stub.reset();

                        const u = new Date(uMillis);
                        const expiresAt = new Date(uMillis + DRAFT_TTL_MS);
                        const id = randomUUID();

                        let stagedKey: string | null = null;
                        if (hasStaged) {
                            stagedKey = `staged/${randomUUID()}`;
                            await r2Stub.putStaged(
                                stagedKey,
                                new Uint8Array([1, 2, 3]),
                                "image/png",
                            );
                        }

                        mocks.draftStore.set(id, {
                            id,
                            payload: {},
                            stagedKey,
                            createdAt: u,
                            updatedAt: u,
                            expiresAt,
                        });

                        // t > u + 60 minutes.
                        const t = new Date(uMillis + DRAFT_TTL_MS + extraMs);

                        // (a) Update operation fails as expired.
                        await expect(
                            atualizarEtapa(
                                id,
                                { [patchKey]: patchValue },
                                { now: t },
                            ),
                        ).rejects.toBeInstanceOf(DraftExpiredError);

                        // (b) Photo upload (an "update"-class operation that
                        // touches both DB and R2) fails as expired. We send
                        // a structurally valid foto so the failure is driven
                        // by expiration, not by validarFotoPerfil.
                        await expect(
                            uploadFoto(
                                id,
                                {
                                    mimeType: "image/png",
                                    bytes: new Uint8Array([0, 1, 2, 3]),
                                },
                                { now: t },
                            ),
                        ).rejects.toBeInstanceOf(DraftExpiredError);

                        // (c) Read operation reports expiration via `null` and
                        // triggers the lazy cleanup that the property requires.
                        const lido = await obter(id, { now: t });
                        if (lido !== null) {
                            throw new Error(
                                `obter() de draft expirado deveria retornar null e retornou ${JSON.stringify(lido)}`,
                            );
                        }

                        // System discards the draft: row is gone.
                        if (mocks.draftStore.has(id)) {
                            throw new Error(
                                `Draft '${id}' continua no store após expiração; deveria ter sido descartado.`,
                            );
                        }

                        // System removes the staged R2 object when one existed.
                        if (stagedKey !== null && r2Stub.has(stagedKey)) {
                            throw new Error(
                                `Objeto staged '${stagedKey}' continua em R2 após expiração; deveria ter sido removido.`,
                            );
                        }

                        // "Sem criar conta nem reservar identificador" é
                        // coberto estruturalmente: o mock de prisma só expõe
                        // `onboardingDraft`, então qualquer chamada acidental
                        // a `db.user.*` ou `db.acompanhanteProfile.*` durante
                        // o ciclo acima teria lançado TypeError antes de
                        // chegarmos aqui.
                    },
                ),
                { numRuns: 100 },
            );
        },
    );
});
