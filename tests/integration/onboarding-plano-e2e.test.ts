/**
 * Integration test 13.2 — Onboarding_Acompanhante completo + Selecao_de_Plano.
 *
 * **Validates: Requirements 3.5, 3.11, 5.1, 5.4, 5.10**
 *
 * Walks the full Acompanhante journey end-to-end:
 *
 *   1. `iniciar()` opens an `OnboardingDraft` (Requirement 3.2).
 *   2. Multiple `atualizarEtapa(onboardingId, patch)` calls populate
 *      the payload step-by-step (identidade, telefone, localidade,
 *      descrição, foto-metadata).
 *   3. `uploadFoto(onboardingId, file)` writes the bytes to the
 *      `staged/<uuid>` R2 prefix and records the resulting key on the
 *      draft row (Requirement 3.10).
 *   4. `finalizar(onboardingId)` commits `User`, `AcompanhanteProfile`,
 *      `Media` and `Session` in a single transaction, copies the
 *      staged object to `committed/<userId>/profile.<ext>` and returns
 *      `{ ok: true, userId, sessionId }` (Requirements 3.5 + 3.11).
 *   5. `selecionar(userId, "BASICO")` records the chosen plan
 *      (Requirements 5.1 + 5.4).
 *   6. `obterVigente(userId)` returns the canonical
 *      `PLANO_DEFINITIONS.BASICO` so the rest of the platform can apply
 *      limits and routing (Requirement 5.10).
 *
 * The Prisma client (`@/lib/db`) is replaced by an in-memory store that
 * implements only the surface actually touched by the production
 * services under test — any unrelated database call would crash with a
 * `TypeError`, surfacing accidental dependencies. The Cloudflare R2
 * client is the shared `tests/helpers/r2-stub` injected via
 * `__setR2ClientForTests` on BOTH `drafts` and `finalizar` so each
 * module observes the same store. `defaultLocalidadesService.validar`
 * is mocked to accept the chosen `(estadoSigla, cidadeNome)` pair so
 * the cartesian-product check in `finalizar` does not require a live
 * IBGE adapter (Requirement 4.3 is covered by Property 19).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createR2Stub } from "../helpers/r2-stub";

// ---------------------------------------------------------------------------
// In-memory Prisma stores (hoisted so vi.mock can reach them)
// ---------------------------------------------------------------------------

type UserType = "CLIENTE" | "ACOMPANHANTE";
type MediaStatus = "STAGED" | "COMMITTED" | "PENDING_REPAIR";
type PlanoTipo = "BASICO" | "PREMIUM";

const stores = vi.hoisted(() => {
    interface DraftRow {
        id: string;
        payload: Record<string, unknown>;
        stagedKey: string | null;
        createdAt: Date;
        updatedAt: Date;
        expiresAt: Date;
    }
    interface UserRow {
        id: string;
        email: string;
        identificador: string;
        nome: string;
        passwordHash: string;
        type: "CLIENTE" | "ACOMPANHANTE";
        createdAt: Date;
        updatedAt: Date;
    }
    interface AcompanhanteProfileRow {
        userId: string;
        telefone: string;
        estadoSigla: string;
        cidadeNome: string;
        descricao: string;
        fotoPerfilId: string | null;
        planoVigente: "BASICO" | "PREMIUM" | null;
        planoSelecionadoEm: Date | null;
    }
    interface MediaRow {
        id: string;
        ownerId: string;
        storageKey: string;
        mimeType: string;
        sizeBytes: number;
        status: "STAGED" | "COMMITTED" | "PENDING_REPAIR";
        isProfilePhoto: boolean;
    }
    interface SessionRow {
        id: string;
        userId: string;
        createdAt: Date;
        expiresAt: Date;
        revokedAt: Date | null;
        lastSeenAt: Date;
        userType: "CLIENTE" | "ACOMPANHANTE";
    }

    const drafts = new Map<string, DraftRow>();
    const users = new Map<string, UserRow>();
    const profiles = new Map<string, AcompanhanteProfileRow>(); // keyed by userId
    const medias = new Map<string, MediaRow>();
    const sessions = new Map<string, SessionRow>();

    let counter = 0;
    return {
        drafts,
        users,
        profiles,
        medias,
        sessions,
        nextId(prefix: string) {
            counter += 1;
            return `${prefix}-${counter}`;
        },
        reset() {
            drafts.clear();
            users.clear();
            profiles.clear();
            medias.clear();
            sessions.clear();
            counter = 0;
        },
    };
});

// ---------------------------------------------------------------------------
// `@/lib/db` mock
// ---------------------------------------------------------------------------

vi.mock("@/lib/db", () => {
    type Select<T> = Partial<Record<keyof T, boolean>>;

    function project<T extends Record<string, unknown>>(
        row: T,
        select?: Select<T>,
    ): Partial<T> {
        if (!select) {
            return { ...row };
        }
        const out: Partial<T> = {};
        for (const key of Object.keys(select) as (keyof T)[]) {
            if (select[key]) {
                (out as Record<string, unknown>)[key as string] = row[key];
            }
        }
        return out;
    }

    // -------- onboardingDraft --------

    const onboardingDraft = {
        async create({
            data,
            select,
        }: {
            data: { payload: Record<string, unknown>; expiresAt: Date };
            select?: Record<string, boolean>;
        }) {
            const now = new Date();
            const row = {
                id: stores.nextId("draft"),
                payload: data.payload ?? {},
                stagedKey: null as string | null,
                createdAt: now,
                updatedAt: now,
                expiresAt: data.expiresAt,
            };
            stores.drafts.set(row.id, row);
            return project(row, select as Select<typeof row>);
        },
        async findUnique({
            where,
            select,
        }: {
            where: { id: string };
            select?: Record<string, boolean>;
        }) {
            const row = stores.drafts.get(where.id);
            if (!row) return null;
            return project(row, select as Select<typeof row>);
        },
        async update({
            where,
            data,
            select,
        }: {
            where: { id: string };
            data: Partial<{
                payload: Record<string, unknown>;
                stagedKey: string | null;
                expiresAt: Date;
            }>;
            select?: Record<string, boolean>;
        }) {
            const row = stores.drafts.get(where.id);
            if (!row) {
                throw new Error(`mock prisma: draft '${where.id}' not found`);
            }
            const next = {
                ...row,
                ...data,
                updatedAt: new Date(),
            };
            stores.drafts.set(where.id, next);
            return project(next, select as Select<typeof next>);
        },
        async delete({ where }: { where: { id: string } }) {
            const row = stores.drafts.get(where.id);
            if (!row) {
                throw new Error(`mock prisma: draft '${where.id}' not found`);
            }
            stores.drafts.delete(where.id);
            return project(row);
        },
    };

    // -------- user --------

    const user = {
        async findMany(args: {
            where: {
                OR?: Array<{ email?: string; identificador?: string }>;
            };
            select?: Record<string, boolean>;
            take?: number;
        }) {
            const ors = args.where.OR ?? [];
            const out: Array<Partial<(typeof stores.users) extends Map<unknown, infer V> ? V : never>> = [];
            for (const row of stores.users.values()) {
                const hit = ors.some((cond) => {
                    if ("email" in cond && cond.email !== undefined) {
                        return row.email === cond.email;
                    }
                    if ("identificador" in cond && cond.identificador !== undefined) {
                        return row.identificador === cond.identificador;
                    }
                    return false;
                });
                if (hit) {
                    out.push(
                        project(
                            row,
                            args.select as Select<typeof row>,
                        ),
                    );
                    if (args.take !== undefined && out.length >= args.take) break;
                }
            }
            return out;
        },
        async create(args: {
            data: {
                email: string;
                identificador: string;
                nome: string;
                passwordHash: string;
                type: "CLIENTE" | "ACOMPANHANTE";
                acompanhante?: {
                    create: {
                        telefone: string;
                        estadoSigla: string;
                        cidadeNome: string;
                        descricao: string;
                    };
                };
                client?: { create: Record<string, unknown> };
            };
            select?: Record<string, boolean>;
        }) {
            const now = new Date();
            const row = {
                id: stores.nextId("user"),
                email: args.data.email,
                identificador: args.data.identificador,
                nome: args.data.nome,
                passwordHash: args.data.passwordHash,
                type: args.data.type,
                createdAt: now,
                updatedAt: now,
            };
            stores.users.set(row.id, row);

            // Nested writes: create the AcompanhanteProfile alongside the User
            // when the production code uses the relational `acompanhante.create`
            // syntax (this is what `finalizar` does).
            if (args.data.acompanhante?.create) {
                const profile = {
                    userId: row.id,
                    telefone: args.data.acompanhante.create.telefone,
                    estadoSigla: args.data.acompanhante.create.estadoSigla,
                    cidadeNome: args.data.acompanhante.create.cidadeNome,
                    descricao: args.data.acompanhante.create.descricao,
                    fotoPerfilId: null as string | null,
                    planoVigente: null as "BASICO" | "PREMIUM" | null,
                    planoSelecionadoEm: null as Date | null,
                };
                stores.profiles.set(profile.userId, profile);
            }

            return project(row, args.select as Select<typeof row>);
        },
    };

    // -------- acompanhanteProfile --------

    const acompanhanteProfile = {
        async findUnique({
            where,
            select,
        }: {
            where: { userId: string };
            select?: Record<string, boolean>;
        }) {
            const row = stores.profiles.get(where.userId);
            if (!row) return null;
            return project(row, select as Select<typeof row>);
        },
        async update({
            where,
            data,
            select,
        }: {
            where: { userId: string };
            data: Partial<{
                fotoPerfilId: string | null;
                planoVigente: "BASICO" | "PREMIUM" | null;
                planoSelecionadoEm: Date | null;
            }>;
            select?: Record<string, boolean>;
        }) {
            const row = stores.profiles.get(where.userId);
            if (!row) {
                throw new Error(
                    `mock prisma: profile for user '${where.userId}' not found`,
                );
            }
            const next = { ...row, ...data };
            stores.profiles.set(where.userId, next);
            return project(next, select as Select<typeof next>);
        },
    };

    // -------- media --------

    const media = {
        async create(args: {
            data: {
                ownerId: string;
                storageKey: string;
                mimeType: string;
                sizeBytes: number;
                status: MediaStatus;
                isProfilePhoto: boolean;
            };
            select?: Record<string, boolean>;
        }) {
            const row = {
                id: stores.nextId("media"),
                ...args.data,
            };
            stores.medias.set(row.id, row);
            return project(row, args.select as Select<typeof row>);
        },
        async update({
            where,
            data,
            select,
        }: {
            where: { id: string };
            data: Partial<{ status: MediaStatus }>;
            select?: Record<string, boolean>;
        }) {
            const row = stores.medias.get(where.id);
            if (!row) {
                throw new Error(`mock prisma: media '${where.id}' not found`);
            }
            const next = { ...row, ...data };
            stores.medias.set(where.id, next);
            return project(next, select as Select<typeof next>);
        },
    };

    // -------- session --------

    const session = {
        async create(args: {
            data: {
                userId: string;
                createdAt: Date;
                expiresAt: Date;
                lastSeenAt: Date;
            };
            select?: Record<string, boolean>;
        }) {
            const owner = stores.users.get(args.data.userId);
            if (!owner) {
                throw new Error(
                    `mock prisma: session.create owner '${args.data.userId}' not found`,
                );
            }
            const row = {
                id: stores.nextId("sess"),
                userId: args.data.userId,
                createdAt: args.data.createdAt,
                expiresAt: args.data.expiresAt,
                revokedAt: null as Date | null,
                lastSeenAt: args.data.lastSeenAt,
                userType: owner.type,
            };
            stores.sessions.set(row.id, row);
            return {
                id: row.id,
                userId: row.userId,
                expiresAt: row.expiresAt,
                revokedAt: row.revokedAt,
            };
        },
    };

    const tx = {
        onboardingDraft,
        user,
        acompanhanteProfile,
        media,
        session,
    };

    return {
        db: {
            ...tx,
            async $transaction<T>(
                fn: (txClient: typeof tx) => Promise<T>,
            ): Promise<T> {
                // The in-memory mock has no real isolation; the production
                // code only relies on the contract that all writes inside
                // the callback observe the same client. Errors thrown by
                // `fn` propagate as rejections, mirroring Prisma's
                // behaviour (and finalizar's `try/catch` reads them).
                return fn(tx);
            },
        },
    };
});

// ---------------------------------------------------------------------------
// `@/lib/env` mock — keeps SESSION_SECRET available without validating
// `process.env`. `signSessionCookie` is not exercised here, but the
// session module imports `getEnv` eagerly, so we must satisfy it.
// ---------------------------------------------------------------------------

vi.mock("@/lib/env", () => ({
    getEnv: () => ({
        SESSION_SECRET: "test-secret-onboarding-plano-e2e-1234567890",
    }),
    validateEnv: () => ({
        SESSION_SECRET: "test-secret-onboarding-plano-e2e-1234567890",
    }),
    ENV_KEYS: [],
    ENV_SCHEMA: { safeParse: () => ({ success: true, data: {} }) },
    EnvValidationError: class extends Error { },
}));

// ---------------------------------------------------------------------------
// Localidades mock — `defaultLocalidadesService.validar` is the only
// surface called by `finalizar`. We force it to `true` so the cartesian
// product check passes for any input the test feeds in (the IBGE
// fallback policy is covered by Properties 17–21).
// ---------------------------------------------------------------------------

const localidadesValidarMock = vi.fn(async () => true);

vi.mock("@/server/localidades", () => ({
    defaultLocalidadesService: {
        validar: (uf: string, cidade: string) =>
            localidadesValidarMock(uf, cidade),
        listarEstados: () => Promise.resolve({ ok: false }),
        listarCidades: () => Promise.resolve({ ok: false }),
    },
}));

// ---------------------------------------------------------------------------
// Imports of the systems under test MUST come after every `vi.mock` so
// the modules under test capture the mocked references.
// ---------------------------------------------------------------------------

import { PLANO_DEFINITIONS } from "@/domain/plano/definitions";
import {
    atualizarEtapa,
    iniciar,
    uploadFoto,
    __setR2ClientForTests as __setDraftsR2,
} from "@/server/onboarding/drafts";
import {
    finalizar,
    __setR2ClientForTests as __setFinalizarR2,
} from "@/server/onboarding/finalizar";
import { obterVigente, selecionar } from "@/server/planos";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

/**
 * Canonical valid input for the Onboarding_Acompanhante. Each test case
 * may override pieces of it (mostly to vary the email/identificador) so
 * uniqueness collisions never propagate across cases.
 */
type OnboardingFixture = {
    nome: string;
    email: string;
    identificador: string;
    senha: string;
    telefone: string;
    estadoSigla: string;
    cidadeNome: string;
    descricao: string;
    fotoMime: "image/jpeg" | "image/png" | "image/webp";
    fotoBytes: Uint8Array;
};

function buildFixture(overrides: Partial<OnboardingFixture> = {}): OnboardingFixture {
    return {
        nome: "Maria Silva",
        email: "maria@privello.test",
        identificador: "maria_silva",
        senha: "senhaForte123",
        telefone: "(11) 91234-5678",
        estadoSigla: "SP",
        cidadeNome: "São Paulo",
        descricao: "Sou uma pessoa carinhosa e atenciosa.",
        fotoMime: "image/jpeg",
        // 4 bytes is enough to exercise the upload path; the real size
        // comes from `Uint8Array.byteLength`, well under the 10 MB cap.
        fotoBytes: new Uint8Array([0xff, 0xd8, 0xff, 0xe0]),
        ...overrides,
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Integration 13.2: Onboarding_Acompanhante completo + Selecao_de_Plano", () => {
    let r2: ReturnType<typeof createR2Stub>;

    beforeEach(() => {
        stores.reset();
        localidadesValidarMock.mockClear();
        localidadesValidarMock.mockImplementation(async () => true);
        r2 = createR2Stub();
        // The drafts and finalizar modules each own a private R2
        // singleton (so a refactor in one cannot accidentally short the
        // other). Both must be set to the same stub for the integration.
        __setDraftsR2(r2);
        __setFinalizarR2(r2);
    });

    afterEach(() => {
        __setDraftsR2(null);
        __setFinalizarR2(null);
    });

    /**
     * Walks the production code path the way the UI would: small
     * incremental patches, an upload step, then the atomic finalize.
     */
    async function runOnboarding(
        fixture: OnboardingFixture,
    ): Promise<{ userId: string; sessionId: string; onboardingId: string }> {
        const { onboardingId } = await iniciar();

        // Step 1 — identidade
        await atualizarEtapa(onboardingId, {
            nome: fixture.nome,
            email: fixture.email,
            identificador: fixture.identificador,
            senha: fixture.senha,
        });

        // Step 2 — telefone
        await atualizarEtapa(onboardingId, {
            telefone: fixture.telefone,
        });

        // Step 3 — localidade
        await atualizarEtapa(onboardingId, {
            estadoSigla: fixture.estadoSigla,
            cidadeNome: fixture.cidadeNome,
        });

        // Step 4 — descrição
        await atualizarEtapa(onboardingId, {
            descricao: fixture.descricao,
        });

        // Step 5 — foto metadata + upload
        // `finalizar` reads `mimeType`/`sizeBytes` from the payload and
        // merges `stagedKey` from the dedicated column, so both halves
        // need to be set.
        await atualizarEtapa(onboardingId, {
            fotoPerfil: {
                mimeType: fixture.fotoMime,
                sizeBytes: fixture.fotoBytes.byteLength,
            },
        });

        await uploadFoto(onboardingId, {
            mimeType: fixture.fotoMime,
            bytes: fixture.fotoBytes,
        });

        const result = await finalizar(onboardingId);
        if (!result.ok) {
            throw new Error(
                `expected finalizar to succeed, got ${JSON.stringify(result)}`,
            );
        }
        return {
            userId: result.userId,
            sessionId: result.sessionId,
            onboardingId,
        };
    }

    it("finalizes the onboarding atomically and selects Plano_Basico end-to-end", async () => {
        const fixture = buildFixture();
        const { userId, sessionId, onboardingId } = await runOnboarding(
            fixture,
        );

        // 1) finalizar produced both userId and sessionId (Requirement 3.11)
        expect(userId).toMatch(/^user-/);
        expect(sessionId).toMatch(/^sess-/);

        // 2) The User row was persisted with the normalized fields.
        const userRow = stores.users.get(userId);
        expect(userRow).toBeDefined();
        expect(userRow!.email).toBe(fixture.email.toLowerCase());
        expect(userRow!.identificador).toBe(
            fixture.identificador.toLowerCase(),
        );
        expect(userRow!.nome).toBe(fixture.nome.trim());
        expect(userRow!.type).toBe("ACOMPANHANTE");

        // 3) The AcompanhanteProfile was created via the nested write,
        //    with telefone normalised to digits-only.
        const profile = stores.profiles.get(userId);
        expect(profile).toBeDefined();
        expect(profile!.telefone).toBe("11912345678");
        expect(profile!.estadoSigla).toBe(fixture.estadoSigla);
        expect(profile!.cidadeNome).toBe(fixture.cidadeNome);
        expect(profile!.descricao).toBe(fixture.descricao);

        // 4) The Media row was committed with the right storage key.
        const mediaRow = [...stores.medias.values()].find(
            (m) => m.ownerId === userId,
        );
        expect(mediaRow).toBeDefined();
        expect(mediaRow!.status).toBe<MediaStatus>("COMMITTED");
        expect(mediaRow!.isProfilePhoto).toBe(true);
        expect(mediaRow!.storageKey).toBe(
            `committed/${userId}/profile.jpg`,
        );
        expect(profile!.fotoPerfilId).toBe(mediaRow!.id);

        // 5) The Session was created with `userType=ACOMPANHANTE` and an
        //    expiry within the 30-day cap.
        const sessionRow = stores.sessions.get(sessionId);
        expect(sessionRow).toBeDefined();
        expect(sessionRow!.userId).toBe(userId);
        expect(sessionRow!.userType).toBe<UserType>("ACOMPANHANTE");
        const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
        expect(
            sessionRow!.expiresAt.getTime() - sessionRow!.createdAt.getTime(),
        ).toBeLessThanOrEqual(thirtyDaysMs);

        // 6) The OnboardingDraft was deleted inside the transaction.
        expect(stores.drafts.has(onboardingId)).toBe(false);

        // 7) R2 holds only the committed key — staged was deleted in the
        //    post-commit step (Property 15: nada de `staged/` sobra).
        const r2Keys = r2.snapshot().map((o) => o.key);
        expect(r2Keys).toEqual([`committed/${userId}/profile.jpg`]);

        // 8) The validar mock was actually consulted with the chosen pair
        //    (Requirement 4.3 hook from finalizar).
        expect(localidadesValidarMock).toHaveBeenCalledWith(
            fixture.estadoSigla,
            fixture.cidadeNome,
        );

        // ---- Selecao_de_Plano ----

        // 9) selecionar(userId, "BASICO") records the plan and is
        //    visible through obterVigente (Requirements 5.1, 5.4, 5.10).
        const selResult = await selecionar(userId, "BASICO");
        expect(selResult).toEqual({ ok: true });

        const vigente = await obterVigente(userId);
        expect(vigente).toBe(PLANO_DEFINITIONS.BASICO);
        expect(vigente).toEqual({
            tipo: "BASICO",
            limiteMidias: 10,
            permiteStories: false,
            prioridadeBusca: false,
            permiteAudio: false,
        });
        expect(stores.profiles.get(userId)!.planoVigente).toBe<PlanoTipo>(
            "BASICO",
        );
        expect(
            stores.profiles.get(userId)!.planoSelecionadoEm,
        ).toBeInstanceOf(Date);
    });

    it("supports the PNG MIME type and produces a committed/profile.png key", async () => {
        const fixture = buildFixture({
            email: "ana@privello.test",
            identificador: "ana_costa",
            fotoMime: "image/png",
            // PNG signature bytes — content is irrelevant to validation
            // (only `mimeType` + `sizeBytes` matter), but using the real
            // signature documents the intent.
            fotoBytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
        });

        const { userId } = await runOnboarding(fixture);

        const mediaRow = [...stores.medias.values()].find(
            (m) => m.ownerId === userId,
        );
        expect(mediaRow!.storageKey).toBe(
            `committed/${userId}/profile.png`,
        );
        expect(mediaRow!.mimeType).toBe("image/png");

        const sel = await selecionar(userId, "BASICO");
        expect(sel).toEqual({ ok: true });
        expect(await obterVigente(userId)).toBe(PLANO_DEFINITIONS.BASICO);
    });

    it("makes selecionar idempotent: calling it twice still resolves to BASICO", async () => {
        const fixture = buildFixture({
            email: "lia@privello.test",
            identificador: "lia_meneses",
        });

        const { userId } = await runOnboarding(fixture);

        const first = await selecionar(userId, "BASICO");
        const firstSelectedAt = stores.profiles.get(userId)!.planoSelecionadoEm;
        expect(first).toEqual({ ok: true });
        expect(firstSelectedAt).toBeInstanceOf(Date);

        // Second call must short-circuit (Property 25): no rewrite of
        // `planoSelecionadoEm`, response still `{ ok: true }`.
        const second = await selecionar(userId, "BASICO");
        expect(second).toEqual({ ok: true });
        expect(stores.profiles.get(userId)!.planoSelecionadoEm).toBe(
            firstSelectedAt,
        );

        const vigente = await obterVigente(userId);
        expect(vigente).toBe(PLANO_DEFINITIONS.BASICO);
    });
});
