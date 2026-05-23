import type { UserType } from "@prisma/client";

import { verifyPassword } from "@/domain/auth/password";
import { db } from "@/lib/db";
import type { Session } from "@/server/auth/sessions";

/**
 * Sistema_de_Autenticacao — caso de uso de login com rate limit por email.
 *
 * Este módulo implementa a parte do design (`Sistema_de_Autenticacao`)
 * responsável pelo fluxo:
 *
 * 1. Aplicar rate limit por email (Requirement 1.8): se houver ≥ 5
 *    tentativas falhas registradas em `LoginAttempt` para o mesmo email
 *    dentro dos últimos 15 minutos, retornar `RATE_LIMITED` sem nem
 *    chegar a verificar a senha.
 * 2. Resolver o usuário pelo email (case-insensitive — `email` é
 *    persistido em caixa baixa).
 * 3. Verificar a senha com argon2id reusando `verifyPassword` do módulo
 *    de domínio `src/domain/auth/password.ts`.
 * 4. Em sucesso, registrar `LoginAttempt(success=true)` e criar uma
 *    `Session` com `expiresAt ≤ now + 30 dias` (Requirement 1.1) numa
 *    única transação atômica.
 * 5. Em falha (email inexistente ou senha incorreta), registrar
 *    `LoginAttempt(success=false)` e retornar `INVALID_CREDENTIALS`.
 *    A resposta é idêntica nos dois casos para satisfazer Requirements
 *    1.2 e 1.3 / Property 2 ("indistinguível").
 *
 * O relógio é injetável via {@link LoginOptions.now} para que testes
 * property-based possam controlar a janela do rate limit e a expiração
 * da sessão deterministicamente.
 */

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

/** Janela do rate limit em ms (Requirement 1.8): 15 minutos. */
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

/**
 * Número mínimo de falhas em {@link RATE_LIMIT_WINDOW_MS} que dispara o
 * bloqueio. Conforme Property 5: o corte é em ≥ 5.
 */
const RATE_LIMIT_MAX_FAILURES = 5;

/**
 * Duração máxima e default de uma sessão (Requirement 1.1): 30 dias.
 *
 * Replicado aqui em vez de importado de `sessions.ts` para manter o
 * módulo fechado sobre seu invariante de expiração — qualquer mudança
 * deve passar pelos testes de Property 3.
 */
const MAX_SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------------

/** Razão pela qual um login falhou. */
export type LoginFailureReason = "INVALID_CREDENTIALS" | "RATE_LIMITED";

/**
 * Resultado de uma tentativa de login. Sucesso carrega a sessão recém
 * criada; falha carrega apenas o motivo, sem qualquer informação
 * adicional que permita distinguir "email não existe" de "senha
 * incorreta" (Requirements 1.2 e 1.3).
 */
export type LoginResult =
    | { ok: true; session: Session }
    | { ok: false; reason: LoginFailureReason };

/** Opções do caso de uso; expostas para permitir injeção de relógio em testes. */
export type LoginOptions = {
    /**
     * Relógio injetável usado tanto para o cálculo da janela do rate
     * limit quanto para `expiresAt`/`createdAt` das linhas gravadas.
     * Default: `new Date()`.
     */
    now?: Date;
    /**
     * Duração desejada da sessão em ms. Valores são clampados em
     * `[0, 30 dias]` para preservar o invariante do Requirement 1.1.
     */
    sessionDurationMs?: number;
};

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

/**
 * Tenta autenticar `loginValue` + `password`.
 *
 * `loginValue` aceita **email** (`fulano@example.com`) **ou**
 * **identificador** (com ou sem `@` à esquerda — `@fulano` e `fulano`
 * são equivalentes). A normalização é:
 *
 * - Trim de espaços.
 * - Lower-case.
 * - Se contém `@` em posição interna (não no início) → trata como email.
 * - Caso contrário → trata como identificador, removendo um eventual
 *   `@` decorativo no início.
 *
 * O fluxo segue exatamente a ordem descrita no header deste módulo. Em
 * particular, a verificação da senha (argon2) é deliberadamente feita
 * fora de qualquer transação: argon2id é CPU-bound e segurar uma
 * conexão Postgres durante a verificação aumentaria a contenção sob
 * carga sem ganho de correção.
 *
 * Para o rate limit (Requirement 1.8), a chave normalizada é o
 * `email` quando o usuário foi resolvido (via lookup pelo identificador
 * quando aplicável). Isso preserva o comportamento "rate limit por
 * email" exigido pela Property 5 mesmo quando a UI envia o
 * identificador.
 *
 * @param loginValue Email ou identificador (com `@` opcional).
 * @param password   Senha em texto claro.
 * @param opts       Opções (relógio, duração da sessão); úteis em testes.
 * @returns          Resultado do login (sucesso com sessão ou falha tipada).
 */
export async function login(
    loginValue: string,
    password: string,
    opts: LoginOptions = {},
): Promise<LoginResult> {
    const now = opts.now ?? new Date();
    const requestedDuration = opts.sessionDurationMs ?? MAX_SESSION_DURATION_MS;
    const sessionDurationMs = Math.min(
        Math.max(requestedDuration, 0),
        MAX_SESSION_DURATION_MS,
    );

    // Normaliza o input: trim + lower-case. Decide se trata como email
    // ou identificador. `@user@example.com` é tratado como identificador
    // pelo critério "começa com @"; nesses casos o `@` decorativo é
    // removido antes do lookup.
    const trimmed = loginValue.trim().toLowerCase();
    const startsWithAt = trimmed.startsWith("@");
    const looksLikeEmail = !startsWithAt && /.@./.test(trimmed);
    const lookupKind: "email" | "identificador" = looksLikeEmail
        ? "email"
        : "identificador";
    const lookupValue =
        lookupKind === "email"
            ? trimmed
            : startsWithAt
                ? trimmed.slice(1)
                : trimmed;

    // ---- Resolve o usuário ANTES do rate limit, porque o rate limit
    // é por email (Requirement 1.8 / Property 5). Se o usuário não for
    // encontrado, ainda assim aplicamos o rate limit usando o próprio
    // valor de lookup como chave (evita que ataques por
    // identificadores inexistentes escapem do limit).
    //
    // Para preservar o contrato dos mocks dos testes existentes (que
    // implementam `db.user.findUnique` dentro de `$transaction` para o
    // caminho de email), mantemos o caminho de email igual ao original
    // do design. O lookup por `identificador` só é exercitado quando o
    // input claramente não é um email, e roda fora da transação — esse
    // ramo é novo e ainda não tem testes.
    let user: {
        id: string;
        type: UserType;
        passwordHash: string;
        email: string;
    } | null = null;
    let rateLimited = false;
    const windowStart = new Date(now.getTime() - RATE_LIMIT_WINDOW_MS);

    if (lookupKind === "email") {
        const phaseOne = await db.$transaction(async (tx) => {
            const recentFailures = await tx.loginAttempt.count({
                where: {
                    email: lookupValue,
                    success: false,
                    createdAt: { gt: windowStart, lte: now },
                },
            });
            if (recentFailures >= RATE_LIMIT_MAX_FAILURES) {
                return { rateLimited: true as const };
            }
            const found = await tx.user.findUnique({
                where: { email: lookupValue },
                select: {
                    id: true,
                    type: true,
                    passwordHash: true,
                    email: true,
                },
            });
            return { rateLimited: false as const, user: found };
        });
        if (phaseOne.rateLimited) {
            rateLimited = true;
        } else {
            user = phaseOne.user;
        }
    } else {
        // Caminho identificador: lookup primeiro, rate-limit depois.
        // Usamos `findUnique` porque `identificador` é único.
        user = await db.user.findUnique({
            where: { identificador: lookupValue },
            select: {
                id: true,
                type: true,
                passwordHash: true,
                email: true,
            },
        });
        const rateLimitKey = user?.email ?? lookupValue;
        const recentFailures = await db.loginAttempt.count({
            where: {
                email: rateLimitKey,
                success: false,
                createdAt: { gt: windowStart, lte: now },
            },
        });
        if (recentFailures >= RATE_LIMIT_MAX_FAILURES) {
            rateLimited = true;
        }
    }

    const rateLimitKey = user?.email ?? lookupValue;

    if (rateLimited) {
        return { ok: false, reason: "RATE_LIMITED" };
    }

    // -------------------------------------------------------------------
    // Fase 2: verificação argon2 (sem transação, CPU-bound).
    //
    // Quando o usuário não existe pulamos a verificação e seguimos para
    // o caminho de falha. A resposta retornada é literalmente a mesma
    // que para uma senha incorreta, satisfazendo a Property 2.
    // -------------------------------------------------------------------
    const passwordOk =
        user !== null ? await verifyPassword(password, user.passwordHash) : false;

    // -------------------------------------------------------------------
    // Fase 3a: falha — registrar tentativa malsucedida.
    // -------------------------------------------------------------------
    if (!user || !passwordOk) {
        await db.loginAttempt.create({
            data: {
                email: rateLimitKey,
                success: false,
                userId: user?.id ?? null,
                createdAt: now,
            },
        });
        return { ok: false, reason: "INVALID_CREDENTIALS" };
    }

    // -------------------------------------------------------------------
    // Fase 3b: sucesso — registrar tentativa bem-sucedida e criar sessão
    // numa única transação para preservar a invariante "se a sessão foi
    // criada, a tentativa também foi registrada" (e vice-versa).
    // -------------------------------------------------------------------
    const expiresAt = new Date(now.getTime() + sessionDurationMs);
    const userType: UserType = user.type;

    const session: Session = await db.$transaction(async (tx) => {
        await tx.loginAttempt.create({
            data: {
                email: user.email,
                success: true,
                userId: user.id,
                createdAt: now,
            },
        });
        const created = await tx.session.create({
            data: {
                userId: user.id,
                createdAt: now,
                expiresAt,
                lastSeenAt: now,
            },
            select: {
                id: true,
                userId: true,
                expiresAt: true,
                revokedAt: true,
            },
        });
        return {
            id: created.id,
            userId: created.userId,
            userType,
            expiresAt: created.expiresAt,
            revokedAt: created.revokedAt,
        };
    });

    return { ok: true, session };
}
