// Feature: privello-platform, Property 16: Onboarding reusa as regras de validação do cadastro
/**
 * Property 16 — Onboarding reusa as regras de validação do cadastro.
 *
 * **Validates: Requirements 3.1, 3.7, 3.12**
 *
 * Statement (transcrito literalmente do design.md):
 *
 *   For any tentativa de `finalizar(onboardingId)`, ela falha com
 *   `{ ok: false, reason: "VALIDACAO" }` se e somente se algum dos campos
 *   do draft viola as regras unificadas de email/identificador/senha/
 *   nome/telefone/descrição/foto definidas pelas Properties 6, 10, 11 e
 *   12, ou um campo obrigatório está ausente.
 *
 * # Estratégia
 *
 * O serviço sob teste é
 * {@link import("@/server/onboarding/finalizar").finalizar}. A propriedade
 * é um "iff", então o teste cobre as duas direções com dois `it`:
 *
 *   1. **(<=)** Para qualquer `OnboardingData` válido (gerado por
 *      `onboardingDataArb`, que combina os mesmos `valid*Arb` usados pelas
 *      Properties 6/10/11/12), `finalizar` NÃO retorna VALIDACAO.
 *   2. **(=>)** Para qualquer `OnboardingData` cuja ÚNICA mutação é
 *      substituir um campo por valor sorteado de `invalid*Arb`, `finalizar`
 *      retorna obrigatoriamente `{ ok: false, reason: "VALIDACAO" }`.
 *
 * # Isolamento de dependências
 *
 * `finalizar` toca quatro dependências externas: Postgres (via
 * `@/lib/db`), Cloudflare R2 (via `@/lib/storage/r2`), o serviço de
 * localidades (via `@/server/localidades`) e a env (`@/lib/env`, lida
 * indiretamente por `signSessionCookie`). Todas são interceptadas neste
 * teste para que a propriedade observe somente o **comportamento de
 * validação de campo**:
 *
 *   - `@/lib/db` é mockado com a superfície prisma exata consumida pelo
 *     fluxo bem-sucedido de `finalizar` (vide Property 15: `obter` →
 *     `$transaction` com `user.findMany`/`user.create`/`media.create`/
 *     `acompanhanteProfile.update`/`onboardingDraft.delete`/`session.create`,
 *     plus `db.media.update` para o ramo de PENDING_REPAIR pós-commit).
 *     Stores são `Map`s in-memory limpos por iteração.
 *   - `defaultLocalidadesService.validar` é stubbado para sempre retornar
 *     `true`, isolando a validação de campo da validação cruzada
 *     (estado, cidade) que pertence ao Sistema_de_Localidades
 *     (Requirement 4.3 / Property 19).
 *   - O cliente R2 é substituído pelo stub in-memory de
 *     `tests/helpers/r2-stub.ts`. Cada iteração faz um `putStaged` da
 *     foto **antes** de chamar `finalizar`, de modo que o `r2.commit`
 *     pós-commit do caminho de sucesso (válido) tenha um objeto staged
 *     real para mover.
 *   - `@/lib/env` é mockado para evitar leituras de `process.env`
 *     durante o boot indireto via `signSessionCookie`/`createSession`.
 *
 * # Notas de teste
 *
 *   - 30 iterações por direção, conforme task 11.7. Cada iteração reseta
 *     todos os stores e o stub R2 para que falhas de isolamento entre
 *     iterações não contaminem a propriedade.
 *   - Para o caso (=>), o "campo a mutar" é sorteado de uma lista
 *     fechada igual à do enunciado da Property 16: nome, email,
 *     identificador, senha, telefone, descricao e fotoPerfil. Os campos
 *     `estadoSigla` e `cidadeNome` ficam fora porque são governados pela
 *     Property 19, não pela 16.
 *   - O `OnboardingDraft.payload` armazenado pelo Sistema_de_Onboarding
 *     contém `fotoPerfil = { mimeType, sizeBytes }`, e o `stagedKey`
 *     mora na coluna `OnboardingDraft.stagedKey`. `finalizar` faz o
 *     merge dos dois antes de chamar o schema (vide cabeçalho de
 *     `finalizar.ts`), portanto a montagem do draft no teste reproduz
 *     fielmente esse layout.
 */

import { afterEach, beforeEach, describe, it, vi } from "vitest";
import * as fc from "fast-check";
import { randomUUID } from "node:crypto";

import {
    invalidDescricaoArb,
    invalidEmailArb,
    invalidFotoPerfilArb,
    invalidIdentificadorArb,
    invalidNomeArb,
    invalidSenhaArb,
    invalidTelefoneArb,
    onboardingDataArb,
    type OnboardingDataGen,
} from "./generators";

// ---------------------------------------------------------------------------
// In-memory mock of `@/lib/db`
//
// Reproduces the exact prisma surface invoked by `finalizar` (and by the
// `obter` it calls internally). `vi.hoisted` keeps the stores reachable
// from both the mock factory and the test body. Anything not implemented
// will throw `TypeError: Cannot read properties of undefined`, surfacing
// accidental dependencies on unrelated tables.
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
    const drafts = new Map<string, {
        id: string;
        payload: Record<string, unknown>;
        stagedKey: string | null;
        expiresAt: Date;
    }>();
    const users = new Map<string, {
        id: string;
        email: string;
        identificador: string;
        nome: string;
        passwordHash: string;
        type: "CLIENTE" | "ACOMPANHANTE";
    }>();
    const acompanhanteProfiles = new Map<string, {
        userId: string;
        telefone: string;
        estadoSigla: string;
        cidadeNome: string;
        descricao: string;
        fotoPerfilId: string | null;
    }>();
    const medias = new Map<string, {
        id: string;
        ownerId: string;
        storageKey: string;
        mimeType: string;
        sizeBytes: number;
        status: "COMMITTED" | "PENDING_REPAIR" | "DELETED";
        isProfilePhoto: boolean;
    }>();
    const sessions = new Map<string, {
        id: string;
        userId: string;
        createdAt: Date;
        expiresAt: Date;
        revokedAt: Date | null;
        lastSeenAt: Date;
        userType: "CLIENTE" | "ACOMPANHANTE";
    }>();
    let counter = 0;
    return {
        drafts,
        users,
        acompanhanteProfiles,
        medias,
        sessions,
        nextId: (prefix: string) => `${prefix}-${++counter}`,
        clearAll() {
            drafts.clear();
            users.clear();
            acompanhanteProfiles.clear();
            medias.clear();
            sessions.clear();
        },
    };
});

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

    const userClient = {
        async findMany(args: {
            where: { OR?: Array<{ email?: string; identificador?: string }> };
            select?: Record<string, boolean>;
            take?: number;
        }) {
            const matches: Array<Partial<UserRow>> = [];
            const ors = args.where.OR ?? [];
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
                    matches.push(project(row, args.select));
                    if (
                        args.take !== undefined &&
                        matches.length >= args.take
                    ) {
                        break;
                    }
                }
            }
            return matches;
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

            const nestedProfile = args.data.acompanhante?.create;
            if (nestedProfile) {
                stores.acompanhanteProfiles.set(id, {
                    userId: id,
                    telefone: nestedProfile.telefone,
                    estadoSigla: nestedProfile.estadoSigla,
                    cidadeNome: nestedProfile.cidadeNome,
                    descricao: nestedProfile.descricao,
                    fotoPerfilId: null,
                });
            }
            return project(row, args.select);
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

    const acompanhanteProfileClient = {
        async update(args: {
            where: { userId: string };
            data: Partial<AcompanhanteProfileRow>;
        }) {
            const row = stores.acompanhanteProfiles.get(args.where.userId);
            if (!row) {
                throw new Error(
                    `[mock prisma] acompanhanteProfile.update: '${args.where.userId}' not found`,
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
            stores.drafts.delete(args.where.id);
            return {};
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
                return fn(tx);
            },
        },
    };
});

// `@/lib/env.getEnv` is consumed transitively by the session-cookie helpers
// re-exported through `@/server/auth/sessions`. None of those helpers run
// at import time, but mocking the module guards against future regressions
// that would touch `process.env` during boot.
vi.mock("@/lib/env", () => ({
    getEnv: () => ({
        SESSION_SECRET: "test-secret-onboarding-validation-reuse",
    }),
    validateEnv: () => ({
        SESSION_SECRET: "test-secret-onboarding-validation-reuse",
    }),
    ENV_KEYS: [],
    ENV_SCHEMA: { safeParse: () => ({ success: true, data: {} }) },
    EnvValidationError: class extends Error { },
}));

// Stub the Sistema_de_Localidades so the cross-field check `(estadoSigla,
// cidadeNome)` (Requirement 4.3) is short-circuited. Property 16 is
// strictly about per-field validation; Property 19 owns the localidade
// product check.
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

// SUT imports MUST come AFTER `vi.mock` so the mocks are in effect when
// the modules under test capture their `db` / localidade references.
import { __setR2ClientForTests, finalizar } from "@/server/onboarding/finalizar";
import { createR2Stub } from "../helpers/r2-stub";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

let r2Stub: ReturnType<typeof createR2Stub>;

beforeEach(() => {
    stores.clearAll();
    r2Stub = createR2Stub();
    __setR2ClientForTests(r2Stub);
});

afterEach(() => {
    __setR2ClientForTests(null);
});

/**
 * Inserts an `OnboardingDraft` row whose `payload` mirrors the shape
 * produced by the multi-step UI (`fotoPerfil = { mimeType, sizeBytes }`,
 * with `stagedKey` living on the dedicated column). Returns the draft id
 * so the caller can pass it to `finalizar`.
 */
async function seedDraft(
    payload: Record<string, unknown>,
    fotoMime: string,
): Promise<string> {
    const stagedKey = `staged/${randomUUID()}`;
    await r2Stub.putStaged(stagedKey, new Uint8Array([1, 2, 3]), fotoMime);

    const draftId = randomUUID();
    stores.drafts.set(draftId, {
        id: draftId,
        payload,
        stagedKey,
        // 24 h ahead of "now" so the draft is comfortably non-expired.
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
    return draftId;
}

/**
 * Splits an `OnboardingDataGen` value into the shape stored in the draft
 * payload (i.e. `fotoPerfil` without `stagedKey`).
 */
function payloadFrom(data: OnboardingDataGen): Record<string, unknown> {
    return {
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
    };
}

// ---------------------------------------------------------------------------
// Mutation arbitrary
//
// Pairs each Property 16-governed field with the matching `invalid*Arb`
// generator. `fc.oneof` distributes uniformly across the entries so all
// seven fields get exercised.
// ---------------------------------------------------------------------------

type Mutation =
    | { field: "nome"; value: string }
    | { field: "email"; value: string }
    | { field: "identificador"; value: string }
    | { field: "senha"; value: string }
    | { field: "telefone"; value: string }
    | { field: "descricao"; value: string }
    | {
        field: "fotoPerfil";
        value: { mimeType: string; sizeBytes: number };
    };

const mutationArb: fc.Arbitrary<Mutation> = fc.oneof(
    fc.record({ field: fc.constant("nome" as const), value: invalidNomeArb }),
    fc.record({
        field: fc.constant("email" as const),
        value: invalidEmailArb,
    }),
    fc.record({
        field: fc.constant("identificador" as const),
        value: invalidIdentificadorArb,
    }),
    fc.record({
        field: fc.constant("senha" as const),
        value: invalidSenhaArb,
    }),
    fc.record({
        field: fc.constant("telefone" as const),
        value: invalidTelefoneArb,
    }),
    fc.record({
        field: fc.constant("descricao" as const),
        value: invalidDescricaoArb,
    }),
    fc.record({
        field: fc.constant("fotoPerfil" as const),
        value: invalidFotoPerfilArb,
    }),
);

// ---------------------------------------------------------------------------
// Property
// ---------------------------------------------------------------------------

describe("Property 16: Onboarding reusa as regras de validação do cadastro", () => {
    it(
        "(<=) for any valid OnboardingData, finalizar does NOT return VALIDACAO",
        { timeout: 60_000 },
        async () => {
            await fc.assert(
                fc.asyncProperty(onboardingDataArb, async (data) => {
                    // Each iteration starts from a clean slate so leftover
                    // rows from a previous run cannot mask a regression.
                    stores.clearAll();
                    r2Stub.reset();

                    const draftId = await seedDraft(
                        payloadFrom(data),
                        data.fotoPerfil.mimeType,
                    );

                    const result = await finalizar(draftId);

                    if (
                        result.ok === false &&
                        result.reason === "VALIDACAO"
                    ) {
                        throw new Error(
                            `Valid OnboardingData was incorrectly rejected as VALIDACAO: ${JSON.stringify(
                                result,
                            )}`,
                        );
                    }
                }),
                { numRuns: 30 },
            );
        },
    );

    it(
        "(=>) for any OnboardingData with one field replaced by invalid*Arb, finalizar MUST return VALIDACAO",
        { timeout: 60_000 },
        async () => {
            await fc.assert(
                fc.asyncProperty(
                    onboardingDataArb,
                    mutationArb,
                    async (data, mutation) => {
                        stores.clearAll();
                        r2Stub.reset();

                        // Apply the single-field mutation to the otherwise
                        // valid payload. `payloadFrom` writes
                        // `fotoPerfil = { mimeType, sizeBytes }`; the
                        // `fotoPerfil` mutation overrides with a value
                        // that is invalid for at least one of those keys
                        // (per `invalidFotoPerfilArb`).
                        const payload = payloadFrom(data) as Record<
                            string,
                            unknown
                        >;
                        payload[mutation.field] = mutation.value;

                        const draftId = await seedDraft(
                            payload,
                            // Always upload the staged blob with a real
                            // image MIME so `putStaged` succeeds; the test
                            // never reaches the post-commit R2 step on
                            // the invalid path anyway.
                            "image/png",
                        );

                        const result = await finalizar(draftId);

                        if (
                            result.ok !== false ||
                            result.reason !== "VALIDACAO"
                        ) {
                            throw new Error(
                                `Mutated OnboardingData (field='${mutation.field}', value=${JSON.stringify(
                                    mutation.value,
                                )}) should yield VALIDACAO; got ${JSON.stringify(result)}`,
                            );
                        }
                    },
                ),
                { numRuns: 30 },
            );
        },
    );
});
