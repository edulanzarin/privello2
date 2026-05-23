// Feature: privello-platform — Integration: cadastro Cliente end-to-end
/**
 * Integration test — cadastro de Cliente end-to-end.
 *
 * **Validates: Requirements 2.2, 2.10**
 *
 * Este teste exercita o fluxo completo do `Sistema_de_Cadastro_Cliente`
 * conectando o serviço {@link import("@/server/cadastro-cliente").registrar},
 * a assinatura HMAC do cookie de sessão
 * ({@link import("@/server/auth/sessions").signSessionCookie} +
 * {@link import("@/server/auth/sessions").verifySessionCookie}) e a
 * resolução de sessão
 * ({@link import("@/server/auth/sessions").resolveSession}) sem passar
 * pelo route handler nem pelo `cookies()` do Next. O objetivo é cobrir
 * a costura ponta-a-ponta exigida pela tarefa 13.1:
 *
 *   1. `registrar({ nome, email, identificador, senha })` cria
 *      atomicamente um `User` com `type === "CLIENTE"` e um
 *      `ClientProfile` correspondente (Requirement 2.2).
 *   2. O `sessionId` retornado é serializável em um cookie assinado por
 *      `signSessionCookie` e o cookie volta a ser decodificado por
 *      `verifySessionCookie` para o mesmo `sessionId` (Requirement 2.10).
 *   3. O `sessionId` recuperado do cookie resolve, via `resolveSession`,
 *      uma sessão **viva** com `userType === "CLIENTE"` (Requirement
 *      2.10 + 1.1).
 *
 * # Estratégia de mock
 *
 * Reusa a abordagem in-memory de
 * `tests/property/registrar-roundtrip.test.ts`: `@/lib/db` é
 * substituído por um mini-store que reproduz a superfície Prisma
 * efetivamente chamada por `registrar` + `createSession` +
 * `resolveSession`. A diferença é que aqui **também** modelamos
 * `ClientProfile` (a roundtrip property só verifica o `User`), porque
 * o passo 13.1 exige asserção explícita de que o `ClientProfile` foi
 * criado. `@/lib/env` é mockado com um `SESSION_SECRET` fixo para que a
 * assinatura HMAC seja determinística e o `getEnv()` não tente validar
 * `process.env` no ambiente de testes.
 *
 * Casos de exemplo (1–3 conforme a tarefa):
 *   - "Caso canônico": entrada já normalizada (lower-case, sem espaços).
 *   - "Normalização": email/identificador em CAIXA ALTA e nome com
 *     espaços nas extremidades — exercita os Requirements 2.5 e 2.6 e
 *     confirma que as colunas persistidas estão na forma canônica.
 *   - "Identificador com sublinhado": valida que caracteres permitidos
 *     `[A-Za-z0-9_]{3,30}` não são alterados pelo pipeline.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// In-memory mock of `@/lib/db`
// ---------------------------------------------------------------------------

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

interface ClientProfileRow {
    userId: string;
    createdAt: Date;
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
    const users = new Map<
        string,
        {
            id: string;
            email: string;
            identificador: string;
            nome: string;
            passwordHash: string;
            type: "CLIENTE" | "ACOMPANHANTE";
            createdAt: Date;
            updatedAt: Date;
        }
    >();
    const clientProfiles = new Map<
        string,
        { userId: string; createdAt: Date }
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
    let userCounter = 0;
    let sessionCounter = 0;
    return {
        users,
        clientProfiles,
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
            if (select[k]) {
                out[k] = (row as unknown as Record<string, unknown>)[k];
            }
        }
        return out as Partial<UserRow>;
    };

    const userClient = {
        async findMany(args: {
            where: {
                OR?: Array<{ email: string } | { identificador: string }>;
            };
            select?: Record<string, boolean>;
            take?: number;
        }) {
            const matches: Array<Partial<UserRow>> = [];
            const ors = args.where.OR ?? [];
            for (const row of stores.users.values()) {
                const hit = ors.some((cond) => {
                    if ("email" in cond) return row.email === cond.email;
                    if ("identificador" in cond) {
                        return row.identificador === cond.identificador;
                    }
                    return false;
                });
                if (hit) {
                    matches.push(pickUser(row, args.select));
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
                type: UserType;
                client?: { create: Record<string, unknown> };
            };
            select?: Record<string, boolean>;
        }) {
            // Emula o índice único Prisma: P2002 em colisão exata.
            for (const row of stores.users.values()) {
                if (row.email === args.data.email) {
                    const err = new Error(
                        "Unique constraint failed on the fields: (`email`)",
                    ) as Error & { code: string; meta: { target: string[] } };
                    err.name = "PrismaClientKnownRequestError";
                    err.code = "P2002";
                    err.meta = { target: ["email"] };
                    throw err;
                }
                if (row.identificador === args.data.identificador) {
                    const err = new Error(
                        "Unique constraint failed on the fields: (`identificador`)",
                    ) as Error & { code: string; meta: { target: string[] } };
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

            // O `registrar` cria o `ClientProfile` no mesmo `user.create`
            // via `client: { create: {} }`. Modelamos esse efeito aqui
            // (a roundtrip property test não fazia, mas o passo 13.1
            // exige asserção explícita sobre `ClientProfile`).
            if (args.data.client?.create) {
                stores.clientProfiles.set(row.id, {
                    userId: row.id,
                    createdAt: now,
                });
            }
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
        async findUnique(args: { where: { id: string } }) {
            const row = stores.sessions.get(args.where.id);
            if (!row) return null;
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
            async $transaction<T>(
                fn: (txClient: typeof tx) => Promise<T>,
            ): Promise<T> {
                return fn(tx);
            },
        },
    };
});

// `signSessionCookie`/`verifySessionCookie` chamam `getEnv()` para ler
// `SESSION_SECRET`. Travamos em um valor determinístico para que a
// assinatura HMAC do cookie seja estável e o teste não dependa de
// `process.env`.
vi.mock("@/lib/env", () => ({
    getEnv: () => ({ SESSION_SECRET: "test-secret-cadastro-cliente-e2e" }),
    validateEnv: () => ({
        SESSION_SECRET: "test-secret-cadastro-cliente-e2e",
    }),
    ENV_KEYS: [],
    ENV_SCHEMA: { safeParse: () => ({ success: true, data: {} }) },
    EnvValidationError: class extends Error { },
}));

// Os imports do código sob teste DEVEM vir após `vi.mock` para que a
// substituição de módulo entre em vigor antes do `db` ser capturado.
import { registrar } from "@/server/cadastro-cliente";
import {
    resolveSession,
    signSessionCookie,
    verifySessionCookie,
} from "@/server/auth/sessions";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

beforeEach(() => {
    stores.users.clear();
    stores.clientProfiles.clear();
    stores.sessions.clear();
});

/**
 * Casos de exemplo cobertos. Cada caso usa `email`/`identificador`
 * exclusivos para que o teste continue válido caso o `beforeEach` seja
 * removido por engano em uma futura refatoração.
 */
const examples = [
    {
        title: "caso canônico (entrada já normalizada)",
        input: {
            nome: "Ana Lima",
            email: "ana.lima@example.com",
            identificador: "analima",
            senha: "senha-segura-123",
        },
        expected: {
            email: "ana.lima@example.com",
            identificador: "analima",
            nome: "Ana Lima",
        },
    },
    {
        title:
            "normalização de email/identificador (CAIXA ALTA) e trim do nome",
        input: {
            nome: "   Bruno Souza   ",
            email: "BRUNO.SOUZA@EXAMPLE.COM",
            identificador: "BrunoSouza",
            senha: "outra-senha-456",
        },
        expected: {
            email: "bruno.souza@example.com",
            identificador: "brunosouza",
            nome: "Bruno Souza",
        },
    },
    {
        title: "identificador com sublinhado preservado",
        input: {
            nome: "Carla Dias",
            email: "carla_dias@example.com",
            identificador: "carla_dias_99",
            senha: "tres-senhas-789",
        },
        expected: {
            email: "carla_dias@example.com",
            identificador: "carla_dias_99",
            nome: "Carla Dias",
        },
    },
] as const;

// ---------------------------------------------------------------------------
// Integration test
// ---------------------------------------------------------------------------

describe("Feature: privello-platform — Integration: cadastro Cliente end-to-end", () => {
    it.each(examples)(
        "registrar → cookie HMAC → resolveSession ($title)",
        async ({ input, expected }) => {
            // (1) Submeter ao serviço `registrar`. Esse passo cobre
            //     validação Zod, normalização, hash argon2id, criação
            //     atômica de User + ClientProfile + Session.
            const result = await registrar(input);

            // O caminho feliz é o único exigido por 2.2 e 2.10; falhas
            // de validação/colisão são cobertas por outros testes.
            if (!result.ok) {
                throw new Error(
                    `expected ok=true, got ${JSON.stringify(result)}`,
                );
            }
            const { userId, sessionId } = result;

            // (2) Conta criada com `type === "CLIENTE"` (Requirement 2.2).
            const userRow = stores.users.get(userId);
            expect(userRow, "user must exist after registrar").toBeDefined();
            expect(userRow!.type).toBe("CLIENTE");
            expect(userRow!.email).toBe(expected.email);
            expect(userRow!.identificador).toBe(expected.identificador);
            expect(userRow!.nome).toBe(expected.nome);
            // A senha **nunca** é armazenada em claro (defesa em
            // profundidade do Requirement 1.4); o hash argon2id começa
            // com o prefixo canônico.
            expect(userRow!.passwordHash.startsWith("$argon2id$")).toBe(true);

            // (3) `ClientProfile` correspondente também foi criado
            //     (Requirement 2.2: persistir conta marcada como Cliente).
            const profileRow = stores.clientProfiles.get(userId);
            expect(
                profileRow,
                "ClientProfile must be created together with the User",
            ).toBeDefined();
            expect(profileRow!.userId).toBe(userId);

            // (4) O `sessionId` retornado é serializável em um cookie
            //     assinado e volta a ser recuperado pelo verificador
            //     (Requirement 2.10).
            const cookieValue = await signSessionCookie(sessionId);
            expect(cookieValue).toContain(".");
            const recovered = await verifySessionCookie(cookieValue);
            expect(recovered).toBe(sessionId);
            // Cookies forjados (sem assinatura ou com assinatura
            // inválida) não devem ser aceitos.
            expect(await verifySessionCookie(sessionId)).toBeNull();
            expect(
                await verifySessionCookie(`${sessionId}.deadbeef`),
            ).toBeNull();

            // (5) `resolveSession(sessionId)` retorna sessão viva com
            //     `userType === "CLIENTE"` (Requirement 2.10 + 1.1).
            //     Observamos a sessão estritamente entre `createdAt` e
            //     `expiresAt` para evitar flakiness.
            const sessionRow = stores.sessions.get(sessionId);
            expect(
                sessionRow,
                "session must exist after registrar",
            ).toBeDefined();
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

            // Limite de 30 dias do Requirement 1.1 (delegado pelo 2.10).
            const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
            const lifetimeMs =
                sessionRow!.expiresAt.getTime() -
                sessionRow!.createdAt.getTime();
            expect(lifetimeMs).toBeLessThanOrEqual(THIRTY_DAYS_MS);
            expect(lifetimeMs).toBeGreaterThan(0);
        },
    );
});
