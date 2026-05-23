// Feature: privello-platform, Property 2: Credenciais inválidas produzem resposta indistinguível
/**
 * Property 2 — Credenciais inválidas produzem resposta indistinguível.
 *
 * **Validates: Requirements 1.2, 1.3**
 *
 * Statement (transcrito literalmente do design.md):
 *
 *   For any tentativa de login com (a) email inexistente e qualquer senha, ou
 *   (b) email existente e senha incorreta, fora de bloqueio por rate limit, o
 *   resultado retornado é exatamente `{ ok: false, reason: "INVALID_CREDENTIALS" }`,
 *   idêntico em ambos os casos.
 *
 * Para cada iteração da propriedade, o teste exercita ambos os ramos contra o
 * MESMO usuário pré-cadastrado e verifica que:
 *
 *   1. Cada ramo retorna exatamente `{ ok: false, reason: "INVALID_CREDENTIALS" }`.
 *   2. Os dois resultados são estruturalmente idênticos (`toStrictEqual`), sem
 *      campos adicionais e com a mesma `reason`.
 *
 * Notas de implementação:
 *
 *   - O helper `tests/helpers/db.ts` (`withRollback`) ainda é um stub
 *     intencional (ver `TODO(task 1.2)` no header desse arquivo): a
 *     ligação a um Postgres real para rollback transacional é assunto de
 *     uma task futura. Enquanto isso, todos os testes de propriedade
 *     que tocam o banco (`session-lifecycle`, `draft-expiration`,
 *     `onboarding-state-preservation`) seguem o mesmo padrão: mockar
 *     `@/lib/db` com um store em memória que reproduz a API do Prisma
 *     usada pelo serviço sob teste. Esta propriedade segue o mesmo
 *     padrão: o pre-seed pedido pela task ("Pre-seed one user via
 *     `db.user.create`") acontece literalmente via `db.user.create` —
 *     mas servido pelo mock — e o "rollback por iteração" é obtido
 *     limpando `LoginAttempt` entre iterações para evitar que o rate
 *     limit do Requirement 1.8 contamine a observação da Property 2.
 *
 *   - O hash da senha pré-cadastrada é argon2id real produzido pelo
 *     `hashPassword` de domínio, então a verificação no ramo (b) exercita
 *     o caminho cripto verdadeiro de `verifyPassword` — a única forma de
 *     observar que o backend não vaza informação ("senha errada" vs.
 *     "email não existe") por timing/structural diff aparente no
 *     resultado público.
 *
 *   - 50 runs (mínimo da task) com 1 verify argon2id por iteração (~100–200ms
 *     em CI) leva ~5–10s — bem dentro do timeout configurado abaixo.
 */

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as fc from "fast-check";

// ---------------------------------------------------------------------------
// In-memory store + Prisma mock
//
// `vi.hoisted` é o ponto canônico para compartilhar estado entre a fábrica
// de `vi.mock` (hoisted ao topo do módulo) e o corpo do teste. O mock
// reproduz o subconjunto de `db` realmente consumido por `src/server/auth/login.ts`:
//
//   - `db.$transaction(fn)`            — fase 1 (rate-limit + lookup)
//   - `db.loginAttempt.count(args)`    — usado dentro do callback de transação
//   - `db.user.findUnique(args)`       — idem
//   - `db.loginAttempt.create(args)`   — fase 3a (registro de falha)
//   - `db.user.create(args)`           — pre-seed pedido pela task
//
// `db.session.create` propositadamente NÃO é implementado: a Property 2
// só observa caminhos de falha. Qualquer regressão que tente criar uma
// sessão em resposta a credenciais inválidas falha imediatamente com
// `TypeError: Cannot read properties of undefined`, o que é desejável.
// ---------------------------------------------------------------------------

type StoredUser = {
    id: string;
    email: string;
    identificador: string;
    nome: string;
    passwordHash: string;
    type: "CLIENTE" | "ACOMPANHANTE";
};

type StoredLoginAttempt = {
    id: string;
    email: string;
    success: boolean;
    userId: string | null;
    createdAt: Date;
};

const { userStore, loginAttemptStore } = vi.hoisted(() => {
    return {
        userStore: new Map<string, StoredUser>(),
        loginAttemptStore: [] as StoredLoginAttempt[],
    };
});

vi.mock("@/lib/db", () => {
    let attemptIdCounter = 0;
    let userIdCounter = 0;

    const txClient = {
        loginAttempt: {
            async count(args: {
                where: {
                    email: string;
                    success: boolean;
                    createdAt: { gt: Date; lte: Date };
                };
            }) {
                const { email, success, createdAt } = args.where;
                return loginAttemptStore.filter(
                    (a) =>
                        a.email === email &&
                        a.success === success &&
                        a.createdAt.getTime() > createdAt.gt.getTime() &&
                        a.createdAt.getTime() <= createdAt.lte.getTime(),
                ).length;
            },
            async create(args: {
                data: {
                    email: string;
                    success: boolean;
                    userId: string | null;
                    createdAt: Date;
                };
            }) {
                attemptIdCounter += 1;
                const row: StoredLoginAttempt = {
                    id: `attempt-${attemptIdCounter}`,
                    email: args.data.email,
                    success: args.data.success,
                    userId: args.data.userId ?? null,
                    createdAt: args.data.createdAt,
                };
                loginAttemptStore.push(row);
                return row;
            },
        },
        user: {
            async findUnique(args: {
                where: { email: string };
                select?: Partial<Record<keyof StoredUser, boolean>>;
            }) {
                const row = userStore.get(args.where.email);
                if (!row) return null;
                if (!args.select) return { ...row };
                const out: Partial<StoredUser> = {};
                for (const k of Object.keys(args.select) as (keyof StoredUser)[]) {
                    if (args.select[k]) {
                        (out as Record<string, unknown>)[k] = row[k];
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
                };
            }) {
                userIdCounter += 1;
                const row: StoredUser = {
                    id: `user-${userIdCounter}`,
                    ...args.data,
                };
                userStore.set(row.email, row);
                return row;
            },
        },
    };

    return {
        db: {
            ...txClient,
            async $transaction<T>(
                fn: (tx: typeof txClient) => Promise<T>,
            ): Promise<T> {
                return fn(txClient);
            },
        },
    };
});

// Imports devem vir DEPOIS de `vi.mock` para que o mock esteja em vigor
// quando `login.ts` capturar sua referência a `db` no carregamento.
import { hashPassword } from "@/domain/auth/password";
import { login, type LoginResult } from "@/server/auth/login";

// ---------------------------------------------------------------------------
// Pre-seed (Requirements 1.2, 1.3)
//
// Um único usuário é cadastrado uma vez, antes de qualquer iteração da
// propriedade. argon2id é caro: pagar o hash uma vez deixa cada iteração
// gastando apenas um `verifyPassword`.
// ---------------------------------------------------------------------------

const SEEDED_EMAIL = "alice@example.test";
const SEEDED_IDENTIFICADOR = "alice_property2";
const SEEDED_NOME = "Alice Property 2";
const CORRECT_PASSWORD = "Correct-Horse-Battery-Staple-7!";

beforeAll(async () => {
    // Importa `db` do módulo mockado e usa LITERALMENTE `db.user.create`
    // conforme pedido pela task. O efeito é registrar o usuário no store
    // em memória que o resto do mock consulta via `findUnique`.
    const { db } = await import("@/lib/db");
    const passwordHash = await hashPassword(CORRECT_PASSWORD);
    await db.user.create({
        data: {
            email: SEEDED_EMAIL,
            identificador: SEEDED_IDENTIFICADOR,
            nome: SEEDED_NOME,
            passwordHash,
            type: "CLIENTE",
        },
    });
}, 60_000);

beforeEach(() => {
    // "Rollback" da janela de tentativas entre iterações: a Property 2
    // declara explicitamente "fora de bloqueio por rate limit", então
    // garantimos que a contagem de falhas começa em 0 a cada iteração.
    loginAttemptStore.length = 0;
});

afterEach(() => {
    loginAttemptStore.length = 0;
});

// ---------------------------------------------------------------------------
// Geradores
// ---------------------------------------------------------------------------

/**
 * Email de um usuário inexistente: qualquer string cuja normalização
 * (`.trim().toLowerCase()`, idêntica à de `login.ts`) NÃO coincide com
 * o email pré-cadastrado. Usar `fc.string` aqui é desejável — o ramo
 * (a) da Property 2 fala em "qualquer email inexistente", incluindo
 * formatos sintaticamente inválidos. O contrato observável (`reason:
 * "INVALID_CREDENTIALS"`) precisa valer para todos.
 */
const nonexistentEmailArb: fc.Arbitrary<string> = fc
    .string({ maxLength: 100 })
    .filter((s) => s.trim().toLowerCase() !== SEEDED_EMAIL);

/** Senha arbitrária qualquer; o ramo (a) aceita "qualquer senha". */
const arbitraryPasswordArb: fc.Arbitrary<string> = fc.string({ maxLength: 200 });

/**
 * Senha incorreta para o usuário pré-cadastrado: qualquer string que
 * não seja exatamente `CORRECT_PASSWORD`.
 */
const wrongPasswordArb: fc.Arbitrary<string> = fc
    .string({ maxLength: 200 })
    .filter((p) => p !== CORRECT_PASSWORD);

// ---------------------------------------------------------------------------
// Propriedade
// ---------------------------------------------------------------------------

describe("Property 2: Credenciais inválidas produzem resposta indistinguível", () => {
    it(
        "(a) email inexistente e (b) senha incorreta produzem o mesmo { ok:false, reason:'INVALID_CREDENTIALS' }",
        { timeout: 60_000 },
        async () => {
            await fc.assert(
                fc.asyncProperty(
                    nonexistentEmailArb,
                    arbitraryPasswordArb,
                    wrongPasswordArb,
                    async (nonexistentEmail, anyPassword, wrongPassword) => {
                        // Cada iteração começa com a janela de rate limit
                        // limpa para isolar Property 2 de Property 5.
                        loginAttemptStore.length = 0;

                        // Ramo (a): email que não existe + qualquer senha.
                        const resultA: LoginResult = await login(
                            nonexistentEmail,
                            anyPassword,
                        );

                        // Limpamos novamente para que o ramo (b) também
                        // corra "fora de bloqueio por rate limit".
                        loginAttemptStore.length = 0;

                        // Ramo (b): email existente + senha incorreta.
                        const resultB: LoginResult = await login(
                            SEEDED_EMAIL,
                            wrongPassword,
                        );

                        // Cada resultado é EXATAMENTE o objeto público
                        // do contrato — nada a mais, nada a menos.
                        const expected = {
                            ok: false as const,
                            reason: "INVALID_CREDENTIALS" as const,
                        };
                        expect(resultA).toStrictEqual(expected);
                        expect(resultB).toStrictEqual(expected);

                        // E são estruturalmente idênticos entre si
                        // (mesmas chaves, mesmos valores), satisfazendo
                        // a metade "indistinguível" da Property 2.
                        expect(resultA).toStrictEqual(resultB);
                        expect(Object.keys(resultA).sort()).toEqual([
                            "ok",
                            "reason",
                        ]);
                        expect(Object.keys(resultB).sort()).toEqual([
                            "ok",
                            "reason",
                        ]);
                    },
                ),
                { numRuns: 50 },
            );
        },
    );
});
