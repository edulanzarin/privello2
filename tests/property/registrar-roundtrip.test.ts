// Feature: privello-platform, Property 7: Cadastro de Cliente válido é round-trip e cria sessão
/**
 * Property 7 — Cadastro de Cliente válido é round-trip e cria sessão.
 *
 * **Validates: Requirements 2.2, 2.10**
 *
 * Statement (transcrito literalmente do design.md):
 *
 *   For any `CadastroClienteInput` válido, após `registrar(input) =
 *   { ok: true, userId, sessionId }`, ler o usuário pelo `userId` retorna
 *   `{ email: input.email.toLowerCase(), identificador:
 *   input.identificador.toLowerCase(), nome: input.nome.trim(), type:
 *   "CLIENTE" }`, e `resolveSession(sessionId)` retorna uma sessão válida
 *   com `userType === "CLIENTE"`.
 *
 * O serviço sob teste é {@link import("@/server/cadastro-cliente/registrar").registrar},
 * que orquestra: validação Zod, hash argon2id, transação Prisma com
 * verificação de unicidade e criação simultânea de `User`, `ClientProfile`
 * e `Session`. Para verificar a round-trip sem depender de PostgreSQL,
 * `@/lib/db` é mockado com um pequeno store em memória que reproduz
 * exatamente a superfície chamada por `registrar` e `resolveSession`:
 *
 *   - `db.$transaction(fn)` invoca `fn(tx)` com o mesmo `tx` em-memória.
 *   - `tx.user.findMany({ where: { OR }, select, take })` para a checagem
 *     de colisão case-insensitive.
 *   - `tx.user.create({ data, select })` insere o `User` (e o
 *     `ClientProfile` aninhado, que ignoramos).
 *   - `tx.session.create({ data, select })` insere a `Session`.
 *   - `db.session.findUnique({ where, select })` (com join em `user.type`)
 *     para o `resolveSession` posterior.
 *   - `db.session.update({ where, data: { lastSeenAt } })` para o
 *     throttle de `lastSeenAt`.
 *
 * Cada iteração do property test usa a mesma store após reset, mas com
 * `email`/`identificador` exclusivos por meio de um sufixo `fc.uuid()` —
 * isso garante que nenhuma iteração possa, por construção, colidir com
 * outra antes da limpeza, mantendo o teste robusto a possíveis
 * regressões de isolamento.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import * as fc from "fast-check";

import {
    validNomeArb,
    validSenhaArb,
    type CadastroClienteInputGen,
} from "./generators";

// ---------------------------------------------------------------------------
// In-memory mock of `@/lib/db`
// ---------------------------------------------------------------------------
//
// `vi.hoisted` makes the stores accessible from both the mock factory
// (which is hoisted to the top of the module) and the test body. Only
// the Prisma surface actually used by `registrar` + `createSession` +
// `resolveSession` is implemented; any other call would crash with
// `TypeError: Cannot read properties of undefined`, surfacing accidental
// dependencies on unrelated database operations.

type UserType = "CLIENTE" | "ACOMPANHANTE";

interface UserRow {
    id: string;
    email: string;
    identificador: string;
    nome: string;
    passwordHash: string;
    type: UserType;
    createdAt: Date;
    updatedAt: Date;
}

interface SessionRow {
    id: string;
    userId: string;
    createdAt: Date;
    expiresAt: Date;
    revokedAt: Date | null;
    lastSeenAt: Date;
    /** Joined `user.type` so `findUnique` with `select.user` works. */
    userType: UserType;
}

const stores = vi.hoisted(() => {
    const users = new Map<string, {
        id: string;
        email: string;
        identificador: string;
        nome: string;
        passwordHash: string;
        type: "CLIENTE" | "ACOMPANHANTE";
        createdAt: Date;
        updatedAt: Date;
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
    let userCounter = 0;
    let sessionCounter = 0;
    return {
        users,
        sessions,
        nextUserId: () => `user-${++userCounter}`,
        nextSessionId: () => `sess-${++sessionCounter}`,
    };
});

vi.mock("@/lib/db", () => {
    const pickUser = (
        row: UserRow,
        select?: Record<string, boolean>,
    ): Partial<UserRow> => {
        if (!select) return row;
        const out: Record<string, unknown> = {};
        for (const k of Object.keys(select)) {
            if (select[k]) out[k] = (row as unknown as Record<string, unknown>)[k];
        }
        return out as Partial<UserRow>;
    };

    const userClient = {
        async findMany(args: {
            where: {
                OR?: Array<
                    | { email: string }
                    | { identificador: string }
                >;
            };
            select?: Record<string, boolean>;
            take?: number;
        }) {
            const matches: Array<Partial<UserRow>> = [];
            const ors = args.where.OR ?? [];
            for (const row of stores.users.values()) {
                const hit = ors.some((cond) => {
                    if ("email" in cond) return row.email === cond.email;
                    if ("identificador" in cond)
                        return row.identificador === cond.identificador;
                    return false;
                });
                if (hit) {
                    matches.push(pickUser(row, args.select));
                    if (args.take !== undefined && matches.length >= args.take) {
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
                type: UserType;
                client?: { create: Record<string, unknown> };
            };
            select?: Record<string, boolean>;
        }) {
            // Enforce the @unique invariant on email and identificador,
            // mirroring Prisma's P2002 behavior. `registrar` falls back
            // on this when the pre-check race condition fires.
            for (const row of stores.users.values()) {
                if (row.email === args.data.email) {
                    const err = new Error("Unique constraint failed on the fields: (`email`)") as Error & {
                        code: string;
                        meta: { target: string[] };
                    };
                    err.name = "PrismaClientKnownRequestError";
                    err.code = "P2002";
                    err.meta = { target: ["email"] };
                    throw err;
                }
                if (row.identificador === args.data.identificador) {
                    const err = new Error("Unique constraint failed on the fields: (`identificador`)") as Error & {
                        code: string;
                        meta: { target: string[] };
                    };
                    err.name = "PrismaClientKnownRequestError";
                    err.code = "P2002";
                    err.meta = { target: ["identificador"] };
                    throw err;
                }
            }

            const now = new Date();
            const row: UserRow = {
                id: stores.nextUserId(),
                email: args.data.email,
                identificador: args.data.identificador,
                nome: args.data.nome,
                passwordHash: args.data.passwordHash,
                type: args.data.type,
                createdAt: now,
                updatedAt: now,
            };
            stores.users.set(row.id, row);
            // The nested `client.create` would normally insert a row in
            // `ClientProfile`. We don't model it because the test never
            // reads it back — the property is about the User row.
            return pickUser(row, args.select);
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
            const row: SessionRow = {
                id: stores.nextSessionId(),
                userId: args.data.userId,
                createdAt: args.data.createdAt,
                expiresAt: args.data.expiresAt,
                revokedAt: null,
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
        async findUnique(args: {
            where: { id: string };
            select?: Record<string, boolean | { select: Record<string, boolean> }>;
        }) {
            const row = stores.sessions.get(args.where.id);
            if (!row) return null;
            // Mirror the projection requested by `resolveSession`,
            // including the `user.type` join.
            return {
                id: row.id,
                userId: row.userId,
                expiresAt: row.expiresAt,
                revokedAt: row.revokedAt,
                lastSeenAt: row.lastSeenAt,
                user: { type: row.userType },
            };
        },
        async update(args: {
            where: { id: string };
            data: { lastSeenAt?: Date; revokedAt?: Date | null };
        }) {
            const row = stores.sessions.get(args.where.id);
            if (!row) {
                throw new Error(
                    `[mock prisma] session.update: '${args.where.id}' not found`,
                );
            }
            if (args.data.lastSeenAt !== undefined) {
                row.lastSeenAt = args.data.lastSeenAt;
            }
            if (args.data.revokedAt !== undefined) {
                row.revokedAt = args.data.revokedAt;
            }
            return row;
        },
    };

    const tx = { user: userClient, session: sessionClient };

    return {
        db: {
            ...tx,
            async $transaction<T>(fn: (txClient: typeof tx) => Promise<T>): Promise<T> {
                return fn(tx);
            },
        },
    };
});

// Mock env so `@/lib/env.getEnv` (used by `signSessionCookie`) does not try to
// validate `process.env`. `resolveSession` itself does not touch env, but the
// session module imports it eagerly.
vi.mock("@/lib/env", () => ({
    getEnv: () => ({ SESSION_SECRET: "test-secret-for-roundtrip-property" }),
    validateEnv: () => ({ SESSION_SECRET: "test-secret-for-roundtrip-property" }),
    ENV_KEYS: [],
    ENV_SCHEMA: { safeParse: () => ({ success: true, data: {} }) },
    EnvValidationError: class extends Error { },
}));

// Imports MUST come after `vi.mock` so the mocks take effect when the
// modules under test capture their `db` / env references.
import { registrar } from "@/server/cadastro-cliente/registrar";
import { resolveSession } from "@/server/auth/sessions";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

beforeEach(() => {
    stores.users.clear();
    stores.sessions.clear();
});

/**
 * Builds a unique `CadastroClienteInput` for every iteration. The task
 * description requires varying `email` and `identificador` with a
 * `fc.uuid()` suffix to guarantee zero cross-iteration collisions, even
 * if a regression breaks the per-iteration store reset. `nome` and
 * `senha` are drawn from the canonical generators in
 * `tests/property/generators.ts` so all the validation rules of
 * Property 6 are still exercised.
 *
 * `email` is canonicalized to a stable lower-case form on the way out
 * since the property explicitly compares against `input.email.toLowerCase()`;
 * we still feed both lower- and mixed-case variants to the service so
 * the normalization step is exercised.
 */
function uniqueCadastroArb(): fc.Arbitrary<CadastroClienteInputGen> {
    return fc
        .tuple(
            validNomeArb,
            validSenhaArb,
            fc.uuid(),
            // Whether to send email/identificador in mixed case so the
            // service's normalization step (Requirement 2.2) is hit.
            fc.boolean(),
            fc.boolean(),
        )
        .map(([nome, senha, suffix, upperEmail, upperIdent]) => {
            // UUID v4 is `8-4-4-4-12` hex; remove hyphens to land in the
            // identifier alphabet `[A-Za-z0-9_]`. 32 hex chars total, so
            // `u<32 hex>` is 33 chars — slice to 30 to stay within the
            // 3..30 length window.
            const hex = suffix.replace(/-/g, "");
            const baseId = `u${hex}`.slice(0, 30);
            const baseEmail = `u${hex}@example.com`;
            return {
                nome,
                senha,
                email: upperEmail ? baseEmail.toUpperCase() : baseEmail,
                identificador: upperIdent
                    ? baseId.toUpperCase()
                    : baseId,
            };
        });
}

// ---------------------------------------------------------------------------
// Property test
// ---------------------------------------------------------------------------

describe("Property 7: Cadastro de Cliente válido é round-trip e cria sessão", () => {
    it(
        "registrar(input) → user persisted with normalized fields and a CLIENTE session",
        { timeout: 60_000 },
        async () => {
            await fc.assert(
                fc.asyncProperty(uniqueCadastroArb(), async (input) => {
                    // Each iteration runs against a clean store so that
                    // shrinking does not produce false counterexamples
                    // caused by collisions with previous attempts.
                    stores.users.clear();
                    stores.sessions.clear();

                    const result = await registrar(input);

                    // (1) `registrar` must succeed for valid input.
                    if (!result.ok) {
                        throw new Error(
                            `expected ok=true, got ${JSON.stringify(result)}`,
                        );
                    }
                    const { userId, sessionId } = result;

                    // (2) Reading the user by `userId` returns the
                    //     normalized projection required by Property 7.
                    const userRow = stores.users.get(userId);
                    expect(userRow, "user must exist after registrar").toBeDefined();
                    expect(userRow!.email).toBe(input.email.toLowerCase());
                    expect(userRow!.identificador).toBe(
                        input.identificador.toLowerCase(),
                    );
                    expect(userRow!.nome).toBe(input.nome.trim());
                    expect(userRow!.type).toBe("CLIENTE");

                    // (3) `resolveSession(sessionId)` returns a valid
                    //     session with `userType === "CLIENTE"`.
                    //     We pin `now` strictly between the session's
                    //     `createdAt` and `expiresAt` to keep the live
                    //     window deterministic.
                    const sessionRow = stores.sessions.get(sessionId);
                    expect(sessionRow, "session must exist after registrar").toBeDefined();
                    const observeAt = new Date(
                        sessionRow!.createdAt.getTime() + 1,
                    );
                    expect(observeAt.getTime()).toBeLessThan(
                        sessionRow!.expiresAt.getTime(),
                    );

                    const session = await resolveSession(sessionId, {
                        now: observeAt,
                    });
                    expect(session, "session must resolve as live").not.toBeNull();
                    expect(session!.id).toBe(sessionId);
                    expect(session!.userId).toBe(userId);
                    expect(session!.userType).toBe("CLIENTE");
                    expect(session!.revokedAt).toBeNull();
                    expect(session!.expiresAt.getTime()).toBeGreaterThan(
                        observeAt.getTime(),
                    );
                }),
                { numRuns: 30 },
            );
        },
    );
});
