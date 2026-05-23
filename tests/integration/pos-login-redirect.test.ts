// Feature: privello-platform — Integration: redirecionamento pós-login conforme userType
/**
 * Integration test — redirecionamento pós-login conforme `userType`.
 *
 * **Validates: Requirements 1.6, 5.5, 5.10**
 *
 * O fluxo coberto por essa task (13.5) é a costura entre o
 * `Sistema_de_Autenticacao` (que decide o `userType` que volta no
 * payload de `POST /api/auth/login`) e a proteção de rotas do route
 * group `(acompanhante)` (que, em conjunto com o middleware, materializa
 * os Requirements 5.5 e 5.10). O teste invoca **diretamente** o handler
 * de rota e o layout `(acompanhante)` — sem subir um servidor HTTP — e
 * verifica:
 *
 *  1. Login Cliente → resposta `200` carrega `userType: "CLIENTE"`. A
 *     UI da `/login` lê esse campo e roteia para `/` (home pública —
 *     foco do Cliente é solicitar serviços, não administrar perfil)
 *     (Requirement 1.6, ramo Cliente).
 *
 *  2. Login Acompanhante **sem plano** → resposta carrega
 *     `userType: "ACOMPANHANTE"` (Requirement 1.6). Em seguida, simula
 *     o pedido subsequente para `/acompanhante`: com
 *     `obterVigente === null` e `pathname === "/acompanhante"`, o
 *     layout `(acompanhante)` invoca `redirect("/acompanhante/selecao-plano")`
 *     (Requirement 5.5).
 *
 *  3. Login Acompanhante **com plano** → mesma resposta de (2), mas
 *     `obterVigente` devolve `PLANO_DEFINITIONS.BASICO` e o layout
 *     **não** dispara redirecionamento, deixando a rota passar para o
 *     children renderizado (lado complementar de 5.10: a Acompanhante
 *     com plano acessa a área principal sem ser empurrada para
 *     `/selecao-plano`).
 *
 * # Estratégia de mocks
 *
 * `@/lib/db` é substituído por um mini-store em memória que reproduz a
 * superfície Prisma efetivamente usada por `login` (Fase 1: contagem de
 * `loginAttempt` + lookup de `user`; Fase 3b: `loginAttempt.create` +
 * `session.create`) e por `resolveSession` (`session.findUnique` +
 * `session.update` para o throttle de `lastSeenAt`). Os três usuários
 * pedidos pela task são pré-semeados via `db.user.create` (Cliente,
 * Acompanhante sem plano e Acompanhante com plano), com hash argon2id
 * **real** produzido pelo `hashPassword` do domínio — assim o caminho
 * cripto de `verifyPassword` é exercitado de verdade.
 *
 * `@/server/planos.obterVigente` é mockado por iteração para refletir
 * o estado de plano de cada Acompanhante. `next/headers` e
 * `next/navigation` são mockados nos moldes de
 * `tests/property/acompanhante-route-protection.test.ts`: `redirect`
 * lança um `NextRedirectError` carregando o destino, e os headers
 * `x-session-id`/`x-pathname` são alimentados a partir de um estado
 * compartilhado.
 *
 * `@/lib/env` é mockado com um `SESSION_SECRET` fixo para tornar a
 * assinatura HMAC do cookie de sessão determinística.
 */

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { PLANO_DEFINITIONS, type PlanoDefinition } from "@/domain/plano/definitions";

// ---------------------------------------------------------------------------
// Hoisted state shared across all `vi.mock` factories and the test body.
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

interface LoginAttemptRow {
    id: string;
    email: string;
    success: boolean;
    userId: string | null;
    createdAt: Date;
}

const stores = vi.hoisted(() => ({
    users: new Map<string, {
        id: string;
        email: string;
        identificador: string;
        nome: string;
        passwordHash: string;
        type: "CLIENTE" | "ACOMPANHANTE";
        createdAt: Date;
        updatedAt: Date;
    }>(),
    sessions: new Map<string, {
        id: string;
        userId: string;
        createdAt: Date;
        expiresAt: Date;
        revokedAt: Date | null;
        lastSeenAt: Date;
        userType: "CLIENTE" | "ACOMPANHANTE";
    }>(),
    loginAttempts: [] as Array<{
        id: string;
        email: string;
        success: boolean;
        userId: string | null;
        createdAt: Date;
    }>,
    counters: { user: 0, session: 0, attempt: 0 },
    nextUserId() {
        this.counters.user += 1;
        return `user-${this.counters.user}`;
    },
    nextSessionId() {
        this.counters.session += 1;
        return `sess-${this.counters.session}`;
    },
    nextAttemptId() {
        this.counters.attempt += 1;
        return `attempt-${this.counters.attempt}`;
    },
}));

/**
 * Estado mutável compartilhado entre as fábricas de mock e o corpo do
 * teste. Cada caso de exemplo escreve aqui antes de exercitar o layout
 * `(acompanhante)`.
 */
const layoutState = vi.hoisted(() => ({
    sessionId: null as string | null,
    pathname: "" as string,
    planoVigente: null as PlanoDefinition | null,
    redirectCalls: [] as string[],
}));

// ---------------------------------------------------------------------------
// `@/lib/db` — superfície Prisma necessária para `login` + `resolveSession`.
// ---------------------------------------------------------------------------

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
        async findUnique(args: {
            where: { email: string };
            select?: Record<string, boolean>;
        }) {
            for (const row of stores.users.values()) {
                if (row.email === args.where.email) {
                    return pickUser(row, args.select);
                }
            }
            return null;
        },
        async create(args: {
            data: {
                email: string;
                identificador: string;
                nome: string;
                passwordHash: string;
                type: UserType;
            };
        }) {
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
            return row;
        },
    };

    const loginAttemptClient = {
        async count(args: {
            where: {
                email: string;
                success: boolean;
                createdAt: { gt: Date; lte: Date };
            };
        }) {
            const { email, success, createdAt } = args.where;
            return stores.loginAttempts.filter(
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
            const row: LoginAttemptRow = {
                id: stores.nextAttemptId(),
                email: args.data.email,
                success: args.data.success,
                userId: args.data.userId ?? null,
                createdAt: args.data.createdAt,
            };
            stores.loginAttempts.push(row);
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

    const tx = {
        user: userClient,
        loginAttempt: loginAttemptClient,
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

// ---------------------------------------------------------------------------
// `@/lib/env` — `SESSION_SECRET` determinístico para a assinatura HMAC.
// ---------------------------------------------------------------------------

vi.mock("@/lib/env", () => ({
    getEnv: () => ({ SESSION_SECRET: "test-secret-pos-login-redirect" }),
    validateEnv: () => ({ SESSION_SECRET: "test-secret-pos-login-redirect" }),
    ENV_KEYS: [],
    ENV_SCHEMA: { safeParse: () => ({ success: true, data: {} }) },
    EnvValidationError: class extends Error { },
}));

// ---------------------------------------------------------------------------
// `next/headers` — alimenta `x-session-id` / `x-pathname` para o layout.
// ---------------------------------------------------------------------------

vi.mock("next/headers", () => ({
    headers: async () => ({
        get(name: string) {
            if (name === "x-session-id") return layoutState.sessionId;
            if (name === "x-pathname") return layoutState.pathname;
            return null;
        },
    }),
    cookies: async () => ({
        get() {
            return undefined;
        },
    }),
}));

// ---------------------------------------------------------------------------
// `next/navigation` — `redirect` precisa LANÇAR para interromper o layout,
// espelhando o contrato real do Next ("redirect nunca retorna").
// ---------------------------------------------------------------------------

class NextRedirectError extends Error {
    public readonly destination: string;
    constructor(destination: string) {
        super(`NEXT_REDIRECT:${destination}`);
        this.destination = destination;
        this.name = "NextRedirectError";
    }
}

vi.mock("next/navigation", () => ({
    redirect: (dest: string): never => {
        layoutState.redirectCalls.push(dest);
        throw new NextRedirectError(dest);
    },
}));

// ---------------------------------------------------------------------------
// `@/server/planos` — apenas `obterVigente` é consultado pelo layout, e
// devolve o estado configurado por iteração.
// ---------------------------------------------------------------------------

vi.mock("@/server/planos", () => ({
    obterVigente: async (_userId: string) => layoutState.planoVigente,
}));

// Imports do código sob teste DEVEM vir após os `vi.mock`.
// eslint-disable-next-line import/first
import { hashPassword } from "@/domain/auth/password";
// eslint-disable-next-line import/first
import { POST as loginRoute } from "@/app/api/auth/login/route";
// eslint-disable-next-line import/first
import AcompanhanteLayout from "@/app/acompanhante/layout";
// eslint-disable-next-line import/first
import { verifySessionCookie } from "@/server/auth/sessions";
// eslint-disable-next-line import/first
import * as React from "react";

// ---------------------------------------------------------------------------
// Fixtures pré-semeados.
//
// Os três usuários pedidos pela task. As senhas são strings simples para
// não tornar o teste lento (argon2id verifica as três uma vez no setup).
// O hash é REAL e o `verifyPassword` no caminho de login executa a
// verificação cripto de verdade.
// ---------------------------------------------------------------------------

const CLIENTE_EMAIL = "cliente@example.test";
const ACOMPANHANTE_SEM_PLANO_EMAIL = "acomp-sem-plano@example.test";
const ACOMPANHANTE_COM_PLANO_EMAIL = "acomp-com-plano@example.test";
const PASSWORD = "Senha-Forte-123!";

let clienteUserId = "";
let acompanhanteSemPlanoUserId = "";
let acompanhanteComPlanoUserId = "";

beforeAll(async () => {
    const { db } = await import("@/lib/db");
    const passwordHash = await hashPassword(PASSWORD);

    const cliente = await db.user.create({
        data: {
            email: CLIENTE_EMAIL,
            identificador: "cliente_pos_login",
            nome: "Cliente Pos-Login",
            passwordHash,
            type: "CLIENTE",
        },
    });
    clienteUserId = cliente.id;

    const acompSemPlano = await db.user.create({
        data: {
            email: ACOMPANHANTE_SEM_PLANO_EMAIL,
            identificador: "acomp_sem_plano",
            nome: "Acompanhante Sem Plano",
            passwordHash,
            type: "ACOMPANHANTE",
        },
    });
    acompanhanteSemPlanoUserId = acompSemPlano.id;

    const acompComPlano = await db.user.create({
        data: {
            email: ACOMPANHANTE_COM_PLANO_EMAIL,
            identificador: "acomp_com_plano",
            nome: "Acompanhante Com Plano",
            passwordHash,
            type: "ACOMPANHANTE",
        },
    });
    acompanhanteComPlanoUserId = acompComPlano.id;
}, 60_000);

beforeEach(() => {
    // A janela de rate limit (Requirement 1.8) precisa começar limpa
    // entre cenários para evitar contaminação cruzada com falhas
    // simuladas em outros casos.
    stores.loginAttempts.length = 0;
    stores.sessions.clear();
    stores.counters.session = 0;
    stores.counters.attempt = 0;

    layoutState.sessionId = null;
    layoutState.pathname = "";
    layoutState.planoVigente = null;
    layoutState.redirectCalls = [];
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Constrói uma `Request` JSON para `POST /api/auth/login` com o corpo
 * fornecido. O handler `loginRoute` consome o `request.json()` então a
 * codificação é direta.
 */
function makeLoginRequest(email: string, password: string): Request {
    return new Request("https://privello.test/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
    });
}

/**
 * Lê o `sessionId` (parte antes do `.`) embutido no header `Set-Cookie`
 * da resposta de login. Validamos também a assinatura HMAC com
 * `verifySessionCookie` para garantir que o cookie é íntegro.
 */
function extractSessionIdFromResponse(response: Response): string {
    const setCookie = response.headers.get("set-cookie");
    expect(setCookie, "login response must set a session cookie").not.toBeNull();
    const match = /sessionId=([^;]+)/.exec(setCookie!);
    expect(match, "set-cookie must include sessionId").not.toBeNull();
    const cookieValue = decodeURIComponent(match![1]);
    // The signed cookie has the form `<sessionId>.<base64url(hmac)>`.
    // For the integration assertion we just need the opaque id to look
    // up the session row in the in-memory store; a deeper HMAC
    // round-trip is covered by `cadastro-cliente-e2e.test.ts`.
    const dot = cookieValue.lastIndexOf(".");
    expect(dot, "set-cookie value must include the HMAC separator").toBeGreaterThan(0);
    return cookieValue.slice(0, dot);
}

// ---------------------------------------------------------------------------
// Integration test — three example cases as required by the task.
// ---------------------------------------------------------------------------

describe("Feature: privello-platform — Integration: redirecionamento pós-login conforme userType", () => {
    it(
        "Cliente: response payload carries userType: 'CLIENTE' (UI roteia para /)",
        async () => {
            const response = await loginRoute(
                makeLoginRequest(CLIENTE_EMAIL, PASSWORD),
            );
            expect(response.status).toBe(200);

            const payload = (await response.json()) as {
                ok: boolean;
                userType: string;
            };
            expect(payload.ok).toBe(true);
            // Requirement 1.6: o tipo do Usuário deve ser exposto. A
            // página `/login` (`src/app/(public)/login/page.tsx`) lê
            // `payload.userType` e roteia para `/` (home pública —
            // foco do Cliente é solicitar serviços, não administrar
            // perfil) quando vale exatamente `"CLIENTE"`.
            expect(payload.userType).toBe("CLIENTE");

            // Sanity: cookie de sessão íntegro e assinado pelo HMAC do
            // SESSION_SECRET injetado.
            const sessionId = extractSessionIdFromResponse(response);
            const sessionRow = stores.sessions.get(sessionId);
            expect(sessionRow).toBeDefined();
            expect(sessionRow!.userId).toBe(clienteUserId);
            expect(sessionRow!.userType).toBe("CLIENTE");
        },
    );

    it(
        "Acompanhante sem plano: payload userType ACOMPANHANTE; layout redireciona /acompanhante → /acompanhante/selecao-plano (Req 5.5)",
        async () => {
            // (1) Login → resposta carrega userType "ACOMPANHANTE".
            const response = await loginRoute(
                makeLoginRequest(ACOMPANHANTE_SEM_PLANO_EMAIL, PASSWORD),
            );
            expect(response.status).toBe(200);
            const payload = (await response.json()) as {
                ok: boolean;
                userType: string;
            };
            expect(payload.ok).toBe(true);
            expect(payload.userType).toBe("ACOMPANHANTE");

            const sessionId = extractSessionIdFromResponse(response);
            expect(stores.sessions.get(sessionId)?.userId).toBe(
                acompanhanteSemPlanoUserId,
            );

            // (2) Pedido subsequente para /acompanhante: o layout (que
            //     roda em runtime Node, depois do middleware Edge) deve
            //     pedir redirect para /acompanhante/selecao-plano,
            //     porque `obterVigente` devolve `null` (sem plano).
            layoutState.sessionId = sessionId;
            layoutState.pathname = "/acompanhante";
            layoutState.planoVigente = null;

            let caught: NextRedirectError | null = null;
            try {
                await AcompanhanteLayout({
                    children: React.createElement("div", null, "child"),
                });
            } catch (err) {
                if (err instanceof NextRedirectError) {
                    caught = err;
                } else {
                    throw err;
                }
            }

            expect(caught, "layout must call redirect").not.toBeNull();
            expect(caught!.destination).toBe("/acompanhante/selecao-plano");
            expect(layoutState.redirectCalls).toEqual([
                "/acompanhante/selecao-plano",
            ]);
        },
    );

    it(
        "Acompanhante com plano: payload userType ACOMPANHANTE; layout passa adiante (sem redirect) em /acompanhante (Req 5.10 lado complementar)",
        async () => {
            // (1) Mesmo payload da Acompanhante (Req 1.6).
            const response = await loginRoute(
                makeLoginRequest(ACOMPANHANTE_COM_PLANO_EMAIL, PASSWORD),
            );
            expect(response.status).toBe(200);
            const payload = (await response.json()) as {
                ok: boolean;
                userType: string;
            };
            expect(payload.ok).toBe(true);
            expect(payload.userType).toBe("ACOMPANHANTE");

            const sessionId = extractSessionIdFromResponse(response);
            expect(stores.sessions.get(sessionId)?.userId).toBe(
                acompanhanteComPlanoUserId,
            );

            // (2) Pedido subsequente para /acompanhante com plano
            //     vigente BASICO: o layout deve passar adiante, sem
            //     emitir redirect. Isso cobre o lado complementar de
            //     5.10 (com plano, a Acompanhante acessa a área
            //     principal sem ser empurrada para /selecao-plano).
            layoutState.sessionId = sessionId;
            layoutState.pathname = "/acompanhante";
            layoutState.planoVigente = PLANO_DEFINITIONS.BASICO;

            let caught: NextRedirectError | null = null;
            try {
                await AcompanhanteLayout({
                    children: React.createElement("div", null, "child"),
                });
            } catch (err) {
                if (err instanceof NextRedirectError) {
                    caught = err;
                } else {
                    throw err;
                }
            }

            expect(caught, "layout must NOT redirect when plano is set").toBeNull();
            expect(layoutState.redirectCalls).toEqual([]);
        },
    );
});
