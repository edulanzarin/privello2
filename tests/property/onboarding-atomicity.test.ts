// Feature: privello-platform, Property 15: Atomicidade do onboarding (tudo ou nada)
/**
 * Property 15 — Atomicidade do onboarding (tudo ou nada).
 *
 * **Validates: Requirements 3.5, 3.6**
 *
 * Statement (transcrito literalmente do design.md):
 *
 *   For any execução de `finalizar(onboardingId)`, o estado final do
 *   sistema (banco de dados + storage de mídia) é equivalente a um dos
 *   dois cenários:
 *     - Sucesso: existem `users` (type=ACOMPANHANTE),
 *       `acompanhante_profiles`, `medias.isProfilePhoto=true`
 *       referenciando um objeto em `committed/<userId>/...`, o draft
 *       foi removido, e nenhum objeto em `staged/` permanece para esse
 *       onboarding.
 *     - Falha: não existe `users`/`acompanhante_profiles`/`medias`
 *       criados por esta execução, nenhum objeto em `staged/` ou
 *       `committed/` permanece para este onboarding, o draft permanece
 *       consultável (até expirar), e uma nova chamada a `finalizar` é
 *       permitida.
 *
 * # Estratégia
 *
 * O serviço sob teste é
 * {@link import("@/server/onboarding/finalizar").finalizar}. Para
 * exercitar os dois cenários do enunciado, fast-check sorteia, em cada
 * iteração, um `OnboardingData` válido (via `onboardingDataArb`) e um
 * "ponto de injeção de falha" entre os pontos onde a literatura de
 * design admite ruptura:
 *
 *   - "none"            → caminho feliz (sucesso).
 *   - "user.create"     → `tx.user.create` lança; rollback total.
 *   - "media.create"    → `tx.media.create` lança; rollback total.
 *   - "draft.delete"    → `tx.onboardingDraft.delete` lança; rollback total.
 *   - "r2.commit"       → `r2.commit` pós-commit lança em ambas as
 *                         retentativas; o `prisma.$transaction` já tinha
 *                         sucesso e a operação retorna `{ ok: true }`,
 *                         mas a `Media` é marcada como `PENDING_REPAIR`.
 *                         Esse é o único cenário que NÃO é estritamente
 *                         atômico no nível do storage — design.md
 *                         (seção "Atomicidade do Onboarding (detalhe)")
 *                         documenta esse trade-off explicitamente.
 *
 * # Isolamento de dependências
 *
 *   - `@/lib/db` é mockado com a superfície prisma exata consumida pelo
 *     fluxo de `finalizar`: `$transaction`, `user.findMany/create`,
 *     `acompanhanteProfile.update`, `media.create/update`,
 *     `onboardingDraft.findUnique/delete`, `session.create`. O mock
 *     **modela rollback transacional** salvando um snapshot das
 *     `Map`s in-memory com `structuredClone` antes de invocar o
 *     callback de `$transaction` e restaurando-as quando o callback
 *     lança. Sem isso, a observabilidade externa do estado durante uma
 *     falha intermediária seria indistinguível do mock e o teste
 *     mediria a si mesmo, não a propriedade.
 *   - O cliente R2 é o stub in-memory de `tests/helpers/r2-stub.ts`,
 *     injetado nos dois módulos que carregam um singleton próprio
 *     (`finalizar.ts` e `drafts.ts`) via `__setR2ClientForTests` — o
 *     `obter` chamado por `finalizar` mora em `drafts.ts`, então as
 *     duas seams precisam apontar para o mesmo stub.
 *   - `defaultLocalidadesService.validar` é stubbado para `true`
 *     (Property 19 cobre o produto cartesiano).
 *   - `@/lib/env` é mockado para evitar leituras de `process.env`
 *     pelos helpers de cookie de sessão importados transitivamente.
 *
 * # Notas de teste
 *
 *   - 30 iterações, conforme a task 11.6.
 *   - Cada iteração reseta os stores e o stub R2; cada draft recebe um
 *     `staged/<uuid>` real para que o cleanup pós-falha (Property 15
 *     "Falha": "nenhum objeto em `staged/` permanece") seja observável.
 *   - O fault está em um contêiner `vi.hoisted` para que o mock de
 *     `@/lib/db` possa lê-lo sem capturar o lexical scope do teste.
 */

import * as fc from "fast-check";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";

import { onboardingDataArb, type OnboardingDataGen } from "./generators";

// ---------------------------------------------------------------------------
// Fault injection container
//
// `vi.hoisted` ensures both the `@/lib/db` mock factory and the test body
// see the same mutable cell. The supported faults match the bullets in
// the file header.
// ---------------------------------------------------------------------------

type Fault =
    | "none"
    | "user.create"
    | "media.create"
    | "draft.delete"
    | "r2.commit";

const fault = vi.hoisted(() => ({ active: "none" as Fault }));

// ---------------------------------------------------------------------------
// In-memory Prisma stores + transactional rollback
// ---------------------------------------------------------------------------

interface DraftRow {
    id: string;
    payload: Record<string, unknown>;
    stagedKey: string | null;
    expiresAt: Date;
}

interface UserRow {
    id: string;
    email: string;
    identificador: string;
    nome: string;
    passwordHash: string;
    type: "CLIENTE" | "ACOMPANHANTE";
}

interface AcompanhanteProfileRow {
    userId: string;
    telefone: string;
    estadoSigla: string;
    cidadeNome: string;
    descricao: string;
    fotoPerfilId: string | null;
}

interface MediaRow {
    id: string;
    ownerId: string;
    storageKey: string;
    mimeType: string;
    sizeBytes: number;
    status: "COMMITTED" | "PENDING_REPAIR" | "DELETED";
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

const stores = vi.hoisted(() => {
    const drafts = new Map<
        string,
        {
            id: string;
            payload: Record<string, unknown>;
            stagedKey: string | null;
            expiresAt: Date;
        }
    >();
    const users = new Map<
        string,
        {
            id: string;
            email: string;
            identificador: string;
            nome: string;
            passwordHash: string;
            type: "CLIENTE" | "ACOMPANHANTE";
        }
    >();
    const profiles = new Map<
        string,
        {
            userId: string;
            telefone: string;
            estadoSigla: string;
            cidadeNome: string;
            descricao: string;
            fotoPerfilId: string | null;
        }
    >();
    const medias = new Map<
        string,
        {
            id: string;
            ownerId: string;
            storageKey: string;
            mimeType: string;
            sizeBytes: number;
            status: "COMMITTED" | "PENDING_REPAIR" | "DELETED";
            isProfilePhoto: boolean;
        }
    >();
    const sessions = new Map<
        string,
        {
            id: string;
            userId: string;
            createdAt: Date;
            expiresAt: Date;
            revokedAt: Date | null;
            lastSeenAt: Date;
            userType: "CLIENTE" | "ACOMPANHANTE";
        }
    >();

    let counter = 0;
    return {
        drafts,
        users,
        profiles,
        medias,
        sessions,
        nextId: (prefix: string) => `${prefix}-${++counter}`,
        clearAll() {
            drafts.clear();
            users.clear();
            profiles.clear();
            medias.clear();
            sessions.clear();
        },
    };
});


// ---------------------------------------------------------------------------
// `@/lib/db` mock with transactional rollback semantics.
//
// `$transaction` snapshots every store, runs the callback, and restores
// the snapshot if the callback throws. Without this the in-memory stores
// would observe partial writes whenever a fault is injected mid-tx and
// the property's "Falha → no User/Profile/Media created" branch could
// not be checked against external observability.
// ---------------------------------------------------------------------------

vi.mock("@/lib/db", () => {
    const project = <T extends Record<string, unknown>>(
        row: T,
        select?: Record<string, boolean>,
    ): Partial<T> => {
        if (!select) return { ...row };
        const out: Record<string, unknown> = {};
        for (const k of Object.keys(select)) {
            if (select[k]) out[k] = (row as Record<string, unknown>)[k];
        }
        return out as Partial<T>;
    };

    function snapshotMap<K, V>(m: Map<K, V>): Array<[K, V]> {
        // `structuredClone` deep-copies values so later mutations to a
        // row's properties (e.g. `Object.assign(row, data)` in
        // `acompanhanteProfile.update`) do not leak into the snapshot.
        const entries: Array<[K, V]> = [];
        for (const [k, v] of m.entries()) {
            entries.push([k, structuredClone(v) as V]);
        }
        return entries;
    }

    function restoreMap<K, V>(m: Map<K, V>, entries: Array<[K, V]>): void {
        m.clear();
        for (const [k, v] of entries) m.set(k, v);
    }

    const userClient = {
        async findMany(args: {
            where: { OR?: Array<{ email?: string; identificador?: string }> };
            select?: Record<string, boolean>;
            take?: number;
        }) {
            const ors = args.where.OR ?? [];
            const out: Array<Partial<UserRow>> = [];
            for (const row of stores.users.values()) {
                const hit = ors.some((cond) => {
                    if ("email" in cond && cond.email !== undefined) {
                        return row.email === cond.email;
                    }
                    if (
                        "identificador" in cond &&
                        cond.identificador !== undefined
                    ) {
                        return row.identificador === cond.identificador;
                    }
                    return false;
                });
                if (hit) {
                    out.push(project(row, args.select));
                    if (
                        args.take !== undefined &&
                        out.length >= args.take
                    )
                        break;
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
            };
            select?: Record<string, boolean>;
        }) {
            if (fault.active === "user.create") {
                throw new Error("[fault] user.create");
            }
            const id = stores.nextId("user");
            const row: UserRow = {
                id,
                email: args.data.email,
                identificador: args.data.identificador,
                nome: args.data.nome,
                passwordHash: args.data.passwordHash,
                type: args.data.type,
            };
            stores.users.set(id, row);

            const nested = args.data.acompanhante?.create;
            if (nested) {
                stores.profiles.set(id, {
                    userId: id,
                    telefone: nested.telefone,
                    estadoSigla: nested.estadoSigla,
                    cidadeNome: nested.cidadeNome,
                    descricao: nested.descricao,
                    fotoPerfilId: null,
                });
            }
            return project(row, args.select);
        },
    };

    const acompanhanteProfileClient = {
        async update(args: {
            where: { userId: string };
            data: Partial<AcompanhanteProfileRow>;
        }) {
            const row = stores.profiles.get(args.where.userId);
            if (!row) {
                throw new Error(
                    `[mock prisma] acompanhanteProfile.update: '${args.where.userId}' not found`,
                );
            }
            Object.assign(row, args.data);
            return row;
        },
    };

    const mediaClient = {
        async create(args: {
            data: {
                ownerId: string;
                storageKey: string;
                mimeType: string;
                sizeBytes: number;
                status: "COMMITTED" | "PENDING_REPAIR" | "DELETED";
                isProfilePhoto: boolean;
            };
            select?: Record<string, boolean>;
        }) {
            if (fault.active === "media.create") {
                throw new Error("[fault] media.create");
            }
            const id = stores.nextId("media");
            const row: MediaRow = { id, ...args.data };
            stores.medias.set(id, row);
            return project(row, args.select);
        },
        async update(args: {
            where: { id: string };
            data: Partial<MediaRow>;
        }) {
            const row = stores.medias.get(args.where.id);
            if (!row) {
                throw new Error(
                    `[mock prisma] media.update: '${args.where.id}' not found`,
                );
            }
            Object.assign(row, args.data);
            return row;
        },
    };

    const onboardingDraftClient = {
        async findUnique(args: {
            where: { id: string };
            select?: Record<string, boolean>;
        }) {
            const row = stores.drafts.get(args.where.id);
            if (!row) return null;
            return project(row, args.select);
        },
        async delete(args: { where: { id: string } }) {
            if (fault.active === "draft.delete") {
                throw new Error("[fault] draft.delete");
            }
            const row = stores.drafts.get(args.where.id);
            if (!row) {
                throw new Error(
                    `[mock prisma] onboardingDraft.delete: '${args.where.id}' not found`,
                );
            }
            stores.drafts.delete(args.where.id);
            return row;
        },
    };

    const sessionClient = {
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
                    `[mock prisma] session.create: user '${args.data.userId}' not found`,
                );
            }
            const id = stores.nextId("sess");
            const row: SessionRow = {
                id,
                userId: args.data.userId,
                createdAt: args.data.createdAt,
                expiresAt: args.data.expiresAt,
                revokedAt: null,
                lastSeenAt: args.data.lastSeenAt,
                userType: owner.type,
            };
            stores.sessions.set(id, row);
            return project(row, args.select);
        },
    };

    const tx = {
        user: userClient,
        media: mediaClient,
        acompanhanteProfile: acompanhanteProfileClient,
        onboardingDraft: onboardingDraftClient,
        session: sessionClient,
    };

    return {
        db: {
            ...tx,
            async $transaction<T>(
                fn: (txClient: typeof tx) => Promise<T>,
            ): Promise<T> {
                // Snapshot every store before running the callback so a
                // mid-tx throw rolls back to a coherent state. Note that
                // `structuredClone` cannot copy Date instances inside
                // arbitrary objects faithfully across all environments;
                // the rows here only carry plain data (strings, numbers,
                // nulls) and Dates, both supported by structuredClone.
                const snap = {
                    drafts: snapshotMap(stores.drafts),
                    users: snapshotMap(stores.users),
                    profiles: snapshotMap(stores.profiles),
                    medias: snapshotMap(stores.medias),
                    sessions: snapshotMap(stores.sessions),
                };
                try {
                    return await fn(tx);
                } catch (err) {
                    restoreMap(stores.drafts, snap.drafts);
                    restoreMap(stores.users, snap.users);
                    restoreMap(stores.profiles, snap.profiles);
                    restoreMap(stores.medias, snap.medias);
                    restoreMap(stores.sessions, snap.sessions);
                    throw err;
                }
            },
        },
    };
});

// `@/lib/env` is consumed transitively by the session-cookie helpers
// re-exported through `@/server/auth/sessions`. Mocking it short-circuits
// any process.env reads so the test stays hermetic.
vi.mock("@/lib/env", () => ({
    getEnv: () => ({
        SESSION_SECRET: "test-secret-onboarding-atomicity-property-15",
    }),
    validateEnv: () => ({
        SESSION_SECRET: "test-secret-onboarding-atomicity-property-15",
    }),
    ENV_KEYS: [],
    ENV_SCHEMA: { safeParse: () => ({ success: true, data: {} }) },
    EnvValidationError: class extends Error { },
}));

// `defaultLocalidadesService.validar` is forced to `true`. Property 19
// covers the (uf, cidade) cartesian product check.
vi.mock("@/server/localidades", () => ({
    defaultLocalidadesService: {
        async validar() {
            return true;
        },
        async listarEstados() {
            return { ok: true, estados: [], stale: false };
        },
        async listarCidades() {
            return { ok: true, cidades: [], stale: false };
        },
    },
}));

// SUT imports MUST come AFTER `vi.mock` so the modules under test capture
// the mocked references when their top-level imports execute.
import {
    __setR2ClientForTests as __setFinalizarR2,
    finalizar,
} from "@/server/onboarding/finalizar";
import { __setR2ClientForTests as __setDraftsR2 } from "@/server/onboarding/drafts";
import { createR2Stub } from "../helpers/r2-stub";

// ---------------------------------------------------------------------------
// Test fixtures + helpers
// ---------------------------------------------------------------------------

let r2Stub: ReturnType<typeof createR2Stub>;

beforeEach(() => {
    stores.clearAll();
    fault.active = "none";
    r2Stub = createR2Stub({
        // `r2.commit` is exercised post-commit by `finalizar`; injecting
        // a per-iteration matcher lets the "r2.commit" fault degrade the
        // operation to PENDING_REPAIR without interfering with the
        // transaction itself. The matcher is rebuilt inside each
        // iteration via `r2Stub` re-creation; default is a no-op here.
        failOnCommit: () => fault.active === "r2.commit",
    });
    __setFinalizarR2(r2Stub);
    __setDraftsR2(r2Stub);
});

afterEach(() => {
    __setFinalizarR2(null);
    __setDraftsR2(null);
});

/**
 * Inserts an `OnboardingDraft` row whose `payload` mirrors the shape
 * produced by the multi-step UI (`fotoPerfil = { mimeType, sizeBytes }`,
 * with `stagedKey` living on the dedicated column), and pre-uploads a
 * staged blob to R2 so the post-commit `r2.commit` has a real source.
 */
async function seedDraft(
    data: OnboardingDataGen,
): Promise<{ draftId: string; stagedKey: string }> {
    const stagedKey = `staged/${randomUUID()}`;
    await r2Stub.putStaged(
        stagedKey,
        new Uint8Array([1, 2, 3, 4]),
        data.fotoPerfil.mimeType,
    );

    const draftId = randomUUID();
    stores.drafts.set(draftId, {
        id: draftId,
        payload: {
            nome: data.nome,
            email: data.email,
            identificador: data.identificador,
            senha: data.senha,
            telefone: data.telefone,
            estadoSigla: data.estadoSigla,
            cidadeNome: data.cidadeNome,
            descricao: data.descricao,
            fotoPerfil: {
                mimeType: data.fotoPerfil.mimeType,
                sizeBytes: data.fotoPerfil.sizeBytes,
            },
        },
        stagedKey,
        // 24h ahead of "now" so the draft is comfortably non-expired.
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
    return { draftId, stagedKey };
}

/** Helpers that read snapshot information from the in-memory state. */
function r2Keys(): string[] {
    return r2Stub.snapshot().map((o) => o.key).sort();
}

function userByEmail(email: string): UserRow | undefined {
    for (const u of stores.users.values()) {
        if (u.email === email) return u;
    }
    return undefined;
}

// ---------------------------------------------------------------------------
// Property
// ---------------------------------------------------------------------------

const faultArb: fc.Arbitrary<Fault> = fc.constantFrom(
    "none",
    "user.create",
    "media.create",
    "draft.delete",
    "r2.commit",
);

describe("Property 15: Atomicidade do onboarding (tudo ou nada)", () => {
    it(
        "for any execution of finalizar, the (DB + R2) state matches one of the two scenarios in the spec",
        { timeout: 60_000 },
        async () => {
            await fc.assert(
                fc.asyncProperty(
                    onboardingDataArb,
                    faultArb,
                    async (data, injectedFault) => {
                        // Per-iteration reset. `clearAll` empties the
                        // stores and `r2Stub.reset` clears its in-memory
                        // map so leftover keys from a previous run do
                        // not contaminate observability.
                        stores.clearAll();
                        r2Stub.reset();
                        fault.active = injectedFault;

                        const { draftId, stagedKey } = await seedDraft(data);

                        const result = await finalizar(draftId);

                        // Reset the fault flag immediately so any
                        // post-test cleanup performed by Vitest cannot
                        // re-trigger it.
                        fault.active = "none";

                        if (injectedFault === "none") {
                            // ---- Sucesso path ----
                            if (!result.ok) {
                                throw new Error(
                                    `Expected success on the no-fault branch, got ${JSON.stringify(
                                        result,
                                    )}`,
                                );
                            }

                            // 1) User(type=ACOMPANHANTE) was created.
                            const user = stores.users.get(result.userId);
                            expect(user).toBeDefined();
                            expect(user!.type).toBe("ACOMPANHANTE");
                            expect(user!.email).toBe(data.email.toLowerCase());

                            // 2) AcompanhanteProfile is linked to the
                            //    Foto_de_Perfil Media.
                            const profile = stores.profiles.get(result.userId);
                            expect(profile).toBeDefined();
                            expect(profile!.fotoPerfilId).not.toBeNull();

                            // 3) Media(isProfilePhoto=true) references
                            //    the committed/<userId>/... key.
                            const media = stores.medias.get(
                                profile!.fotoPerfilId as string,
                            );
                            expect(media).toBeDefined();
                            expect(media!.isProfilePhoto).toBe(true);
                            expect(media!.ownerId).toBe(result.userId);
                            expect(media!.storageKey.startsWith(
                                `committed/${result.userId}/`,
                            )).toBe(true);
                            // status must be COMMITTED in the no-fault
                            // path (PENDING_REPAIR is exclusive to the
                            // r2.commit fault).
                            expect(media!.status).toBe("COMMITTED");

                            // 4) Draft was deleted inside the tx.
                            expect(stores.drafts.has(draftId)).toBe(false);

                            // 5) No staged/ object remains; the
                            //    committed/ key is the only survivor.
                            const keys = r2Keys();
                            expect(keys).toEqual([media!.storageKey]);
                            expect(
                                keys.every((k) => !k.startsWith("staged/")),
                            ).toBe(true);
                        } else if (injectedFault === "r2.commit") {
                            // ---- Designed-tradeoff path ----
                            //
                            // The transaction succeeded so the operation
                            // returns ok=true, but R2 commit kept failing
                            // and the Media must be marked PENDING_REPAIR.
                            // This is the one branch that is NOT strictly
                            // atomic at the storage level — explicitly
                            // documented by design.md.
                            if (!result.ok) {
                                throw new Error(
                                    `Expected ok=true with PENDING_REPAIR on r2.commit fault, got ${JSON.stringify(
                                        result,
                                    )}`,
                                );
                            }
                            const profile = stores.profiles.get(result.userId);
                            expect(profile).toBeDefined();
                            expect(profile!.fotoPerfilId).not.toBeNull();
                            const media = stores.medias.get(
                                profile!.fotoPerfilId as string,
                            );
                            expect(media).toBeDefined();
                            expect(media!.status).toBe("PENDING_REPAIR");
                            // The user, profile and session were committed
                            // and the draft was removed inside the tx.
                            expect(stores.users.has(result.userId)).toBe(true);
                            expect(stores.drafts.has(draftId)).toBe(false);
                            // The committed/ key was never written
                            // (commit failed) and the staged/ key is
                            // still around because the post-commit DELETE
                            // is conditional on commit success — the
                            // periodic reaper handles it later. The
                            // property statement does not constrain
                            // storage residue on this branch.
                        } else {
                            // ---- Falha path (user.create / media.create
                            //      / draft.delete) ----
                            if (result.ok) {
                                throw new Error(
                                    `Expected failure on fault '${injectedFault}', got ok=true`,
                                );
                            }

                            // 1) No user/profile/media/session was
                            //    created by this execution. The
                            //    transactional rollback in the mock
                            //    restores the snapshot taken before
                            //    `fn(tx)` ran.
                            expect(userByEmail(data.email.toLowerCase())).toBeUndefined();
                            expect(stores.users.size).toBe(0);
                            expect(stores.profiles.size).toBe(0);
                            expect(stores.medias.size).toBe(0);
                            expect(stores.sessions.size).toBe(0);

                            // 2) Draft remains consultable (until expiry).
                            const draftStill = stores.drafts.get(draftId);
                            expect(draftStill).toBeDefined();
                            expect(draftStill!.id).toBe(draftId);

                            // 3) No staged/ or committed/ object remains
                            //    for this onboarding. The `finally`
                            //    block on `finalizar` deletes the staged
                            //    key in best-effort; no committed/ key
                            //    can exist because the post-commit
                            //    branch only runs after a successful
                            //    transaction.
                            const keys = r2Keys();
                            expect(keys).toEqual([]);
                            expect(
                                keys.every(
                                    (k) =>
                                        !k.startsWith("staged/") &&
                                        !k.startsWith("committed/"),
                                ),
                            ).toBe(true);

                            // 4) A fresh finalizar call is allowed: with
                            //    the fault cleared, the same draft must
                            //    succeed. We re-stage a blob at the
                            //    same key the draft references because
                            //    the `finally` cleanup deleted it.
                            await r2Stub.putStaged(
                                stagedKey,
                                new Uint8Array([5, 6, 7, 8]),
                                data.fotoPerfil.mimeType,
                            );
                            const retry = await finalizar(draftId);
                            if (!retry.ok) {
                                throw new Error(
                                    `Retry after rollback should succeed, got ${JSON.stringify(
                                        retry,
                                    )}`,
                                );
                            }
                            expect(stores.drafts.has(draftId)).toBe(false);
                        }
                    },
                ),
                { numRuns: 30 },
            );
        },
    );
});
