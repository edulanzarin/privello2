/**
 * Feature: privello-platform, Property 3: Login bem-sucedido cria sessão dentro do limite de 30 dias
 *
 * For any registered user with email `e` and password `p`, and for any
 * clock instant `t`, calling `login(e, p, { now: t })` must produce a
 * `Session` such that, simultaneously:
 *
 *   1. `session.expiresAt > t`            — sessão válida no instante de criação.
 *   2. `session.expiresAt <= t + 30 days` — Requirement 1.1 (limite máximo).
 *   3. `session.revokedAt === null`       — sessão recém-criada não está revogada.
 *   4. `session.userType === stored userType` — Requirement 1.6: tipo do
 *       Usuario propagado para que o restante da plataforma diferencie permissões.
 *
 * Test design notes:
 *
 *   - Two users are pre-seeded once per test run (one `CLIENTE`, one
 *     `ACOMPANHANTE`) so the property exercises both branches of the
 *     `userType` clause without re-hashing senhas em cada iteração.
 *     Os hashes argon2id são gerados em `beforeAll` (operação cara) e
 *     reutilizados; cada `login(...)` ainda dispara um `verifyPassword`
 *     real, mantendo o teste honesto.
 *
 *   - The task spec instructs "pre-seed users via the DB helper at
 *     `tests/helpers/db.ts`". O helper atual ainda é um stub (ver TODO
 *     no próprio arquivo) à espera de um banco de teste real; seguindo
 *     a convenção dos demais testes property-based desta suíte
 *     (`session-lifecycle.test.ts`, `onboarding-state-preservation.test.ts`,
 *     `draft-expiration.test.ts`), o `@/lib/db` é mockado com um store
 *     em memória que reproduz o subconjunto de Prisma exercitado por
 *     `login(...)`. Quando o helper for implementado (task 1.2 follow-up)
 *     ele poderá substituir o store sem alterar a propriedade.
 *
 *   - The `sessionDurationMs` arbitrary deliberately covers values
 *     **acima** de 30 dias para verificar o clamp imposto pelo serviço
 *     (`Math.min(requested, 30d)`). Valores ≥ 1ms garantem
 *     `expiresAt > now` mesmo após o clamp por baixo (`Math.max(_, 0)`).
 *
 *   - `numRuns = 30` honra a orientação da task ("at least 30 iterations
 *     to keep the DB-backed test reasonably fast"); cada iteração executa
 *     um `verifyPassword` argon2id real e duas transações simuladas, o
 *     que mantém o tempo de execução em ordem de segundos.
 *
 * **Validates: Requirements 1.1**
 */

import { beforeAll, beforeEach, describe, it, expect, vi } from "vitest";
import * as fc from "fast-check";
import { randomUUID } from "node:crypto";

// ---------------------------------------------------------------------------
// In-memory Prisma stub for `@/lib/db`
// ---------------------------------------------------------------------------
//
// Reproduz exatamente os accessors usados por `src/server/auth/login.ts`:
//
//   - `db.$transaction(cb)`              → executa `cb(tx)` com `tx === db`.
//   - `tx.loginAttempt.count(args)`      → janela do rate limit.
//   - `tx.user.findUnique(args)`         → resolução do usuário pelo email.
//   - `tx.loginAttempt.create(args)`     → registro de tentativa (sucesso ou falha).
//   - `tx.session.create(args)`          → criação da sessão.
//
// O store é compartilhado entre `db` e o `tx` recebido nos callbacks de
// `$transaction` para que os reads/writes feitos dentro e fora de transação
// enxerguem o mesmo estado, como acontece em uma transação Postgres normal.

type StoredUser = {
    id: string;
    email: string;
    type: "CLIENTE" | "ACOMPANHANTE";
    passwordHash: string;
};

type StoredLoginAttempt = {
    id: string;
    email: string;
    success: boolean;
    userId: string | null;
    createdAt: Date;
};

type StoredSession = {
    id: string;
    userId: string;
    createdAt: Date;
    expiresAt: Date;
    revokedAt: Date | null;
    lastSeenAt: Date;
};

const stores = vi.hoisted(() => {
    return {
        users: new Map<string, StoredUser>(),
        loginAttempts: [] as StoredLoginAttempt[],
        sessions: new Map<string, StoredSession>(),
    };
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

    const dbMock: {
        user: unknown;
        loginAttempt: unknown;
        session: unknown;
        $transaction: <R>(cb: (tx: unknown) => Promise<R>) => Promise<R>;
    } = {
        user: {
            async findUnique(args: {
                where: { email: string };
                select?: Record<string, boolean>;
            }) {
                for (const u of stores.users.values()) {
                    if (u.email === args.where.email) {
                        return pick(u, args.select);
                    }
                }
                return null;
            },
        },
        loginAttempt: {
            async count(args: {
                where: {
                    email: string;
                    success: boolean;
                    createdAt?: { gt?: Date; lte?: Date };
                };
            }) {
                const { email, success, createdAt } = args.where;
                let n = 0;
                for (const a of stores.loginAttempts) {
                    if (a.email !== email) continue;
                    if (a.success !== success) continue;
                    if (createdAt?.gt && !(a.createdAt > createdAt.gt)) continue;
                    if (createdAt?.lte && !(a.createdAt <= createdAt.lte)) continue;
                    n += 1;
                }
                return n;
            },
            async create(args: {
                data: {
                    email: string;
                    success: boolean;
                    userId: string | null;
                    createdAt: Date;
                };
            }) {
                const row: StoredLoginAttempt = {
                    id: randomUUID(),
                    email: args.data.email,
                    success: args.data.success,
                    userId: args.data.userId,
                    createdAt: args.data.createdAt,
                };
                stores.loginAttempts.push(row);
                return row;
            },
        },
        session: {
            async create(args: {
                data: {
                    userId: string;
                    createdAt: Date;
                    expiresAt: Date;
                    lastSeenAt: Date;
                };
                select?: Record<string, boolean>;
            }) {
                const row: StoredSession = {
                    id: randomUUID(),
                    userId: args.data.userId,
                    createdAt: args.data.createdAt,
                    expiresAt: args.data.expiresAt,
                    revokedAt: null,
                    lastSeenAt: args.data.lastSeenAt,
                };
                stores.sessions.set(row.id, row);
                return pick(row, args.select);
            },
        },
        async $transaction<R>(cb: (tx: unknown) => Promise<R>): Promise<R> {
            // O serviço passa o mesmo `tx` para vários accessors; reusamos
            // o próprio `dbMock` como tx para refletir o snapshot único
            // que uma transação Postgres ofereceria.
            return cb(dbMock);
        },
    };

    return { db: dbMock };
});

// Imports do SUT precisam vir DEPOIS de `vi.mock` para que o stub esteja
// no lugar quando `login.ts` capturar sua referência a `db` no top-level.
import { login } from "@/server/auth/login";
import { hashPassword } from "@/domain/auth/password";

// ---------------------------------------------------------------------------
// Pre-seed: one CLIENTE and one ACOMPANHANTE per test run
// ---------------------------------------------------------------------------
//
// Hashing argon2id é caro (~100-200ms por hash). Fazemos o hash uma única
// vez no `beforeAll` e reusamos em todas as iterações da propriedade.

const SEEDED = {
    cliente: {
        id: "11111111-1111-1111-1111-111111111111",
        email: "cliente.seed@example.com",
        senha: "senha-cliente-seed-123",
        type: "CLIENTE" as const,
    },
    acompanhante: {
        id: "22222222-2222-2222-2222-222222222222",
        email: "acompanhante.seed@example.com",
        senha: "senha-acompanhante-seed-456",
        type: "ACOMPANHANTE" as const,
    },
};

beforeAll(async () => {
    const [hashCliente, hashAcompanhante] = await Promise.all([
        hashPassword(SEEDED.cliente.senha),
        hashPassword(SEEDED.acompanhante.senha),
    ]);

    stores.users.set(SEEDED.cliente.id, {
        id: SEEDED.cliente.id,
        email: SEEDED.cliente.email,
        type: SEEDED.cliente.type,
        passwordHash: hashCliente,
    });
    stores.users.set(SEEDED.acompanhante.id, {
        id: SEEDED.acompanhante.id,
        email: SEEDED.acompanhante.email,
        type: SEEDED.acompanhante.type,
        passwordHash: hashAcompanhante,
    });
}, 60_000);

// Mantém os usuários estáveis entre iterações mas zera o histórico de
// tentativas e sessões — a propriedade fala apenas sobre o login dado um
// usuário válido, então cada cenário começa "limpo".
beforeEach(() => {
    stores.loginAttempts.length = 0;
    stores.sessions.clear();
});

// ---------------------------------------------------------------------------
// Constants and arbitraries
// ---------------------------------------------------------------------------

/** Duração máxima de sessão (Requirement 1.1): 30 dias em ms. */
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/** Âncora arbitrária para o relógio: 2025-01-01T00:00:00.000Z. */
const BASE_TIME_MS = Date.UTC(2025, 0, 1, 0, 0, 0);

/**
 * Gera um instante `t` em uma janela ampla (até ~3 anos antes ou depois
 * da âncora) para que o teste não fique preso a uma data específica.
 */
const clockArb: fc.Arbitrary<Date> = fc
    .integer({ min: -3 * 365 * 24 * 60 * 60 * 1000, max: 3 * 365 * 24 * 60 * 60 * 1000 })
    .map((offsetMs) => new Date(BASE_TIME_MS + offsetMs));

/**
 * `sessionDurationMs` cobre três regimes:
 *
 *   - `undefined`           — usa o default do serviço (30 dias exatos),
 *                              caso de borda em `expiresAt = now + 30d`.
 *   - `[1, 30 days]`        — valores dentro do limite, sem clamping.
 *   - `(30 days, 60 days]`  — valores acima do limite; o serviço deve
 *                              clamp em 30 dias (ainda satisfaz a propriedade).
 *
 * O mínimo de 1ms garante `expiresAt > now`, alinhado ao enunciado da
 * Property 3 (cláusula `expiresAt > t`).
 */
const sessionDurationArb: fc.Arbitrary<number | undefined> = fc.oneof(
    fc.constant(undefined),
    fc.integer({ min: 1, max: THIRTY_DAYS_MS }),
    fc.integer({ min: THIRTY_DAYS_MS + 1, max: 2 * THIRTY_DAYS_MS }),
);

/** Seleciona um dos dois usuários pré-seedados. */
const seededUserArb: fc.Arbitrary<"cliente" | "acompanhante"> = fc.constantFrom(
    "cliente",
    "acompanhante",
);

// ---------------------------------------------------------------------------
// Property
// ---------------------------------------------------------------------------

describe("Property 3: Login bem-sucedido cria sessão dentro do limite de 30 dias", () => {
    it(
        "for any registered user (e, p) and any clock t, login(e, p, { now: t }) returns a Session within (t, t + 30 days] with revokedAt=null and userType matching the stored type",
        { timeout: 120_000 },
        async () => {
            await fc.assert(
                fc.asyncProperty(
                    seededUserArb,
                    clockArb,
                    sessionDurationArb,
                    async (which, now, sessionDurationMs) => {
                        // Cada iteração começa com histórico limpo para que
                        // o rate limit do email seedado nunca dispare.
                        stores.loginAttempts.length = 0;
                        stores.sessions.clear();

                        const seed = SEEDED[which];
                        const result = await login(
                            seed.email,
                            seed.senha,
                            { now, sessionDurationMs },
                        );

                        // Pré-condição da propriedade: o login é
                        // bem-sucedido. Falhas aqui significam regressão
                        // no fluxo positivo (rate limit espúrio, mismatch
                        // de hash, etc.) e devem ser sinalizadas.
                        if (!result.ok) {
                            throw new Error(
                                `login(${seed.email}) deveria ter sucesso e falhou com reason=${result.reason}`,
                            );
                        }

                        const { session } = result;

                        // (1) expiresAt > t (sessão válida no instante de criação).
                        expect(
                            session.expiresAt.getTime(),
                            "expiresAt deve ser estritamente maior que o relógio de criação",
                        ).toBeGreaterThan(now.getTime());

                        // (2) expiresAt <= t + 30 days (clamp do Requirement 1.1).
                        const upperBound = now.getTime() + THIRTY_DAYS_MS;
                        expect(
                            session.expiresAt.getTime(),
                            "expiresAt deve respeitar o teto de 30 dias",
                        ).toBeLessThanOrEqual(upperBound);

                        // (3) revokedAt === null (sessão recém-criada).
                        expect(session.revokedAt).toBeNull();

                        // (4) userType reflete o tipo persistido do usuário.
                        expect(session.userType).toBe(seed.type);

                        // Sanity adicional: a sessão é a do usuário esperado
                        // — protege contra um regressivo silencioso onde o
                        // serviço passasse a retornar a sessão de outro user.
                        expect(session.userId).toBe(seed.id);

                        // Verificação direta do clamping na fronteira:
                        // quando `requested > 30d`, o expiresAt deve ser
                        // exatamente `now + 30d` (igualdade, não apenas ≤).
                        if (
                            sessionDurationMs !== undefined &&
                            sessionDurationMs > THIRTY_DAYS_MS
                        ) {
                            expect(session.expiresAt.getTime()).toBe(
                                upperBound,
                            );
                        }
                    },
                ),
                { numRuns: 30 },
            );
        },
    );
});
