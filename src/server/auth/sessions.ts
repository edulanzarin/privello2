import type { Prisma, UserType as PrismaUserType } from "@prisma/client";

import { db } from "@/lib/db";

/**
 * Sistema_de_Autenticacao — repositório de sessões.
 *
 * Este módulo implementa a parte do design (`Sistema_de_Autenticacao`)
 * responsável por:
 *
 * - Criar sessões com expiração estritamente menor ou igual a
 *   `createdAt + 30 dias` (Requirement 1.1).
 * - Revogar sessões via `logout` (Requirement 1.5).
 * - Resolver o estado de uma sessão e diferenciar tipos de Usuario
 *   (Requirements 1.6 e 1.7), atualizando `lastSeenAt` com throttle
 *   ≥ 60s para evitar contenção em alto tráfego.
 *
 * Os helpers de assinatura HMAC do cookie (`signSessionCookie` e
 * `verifySessionCookie`) ficam em `./sessionCookie.ts` para que o
 * middleware (Edge Runtime, sem Prisma) possa importá-los sem
 * arrastar o `@prisma/client` consumido aqui. Eles são re-exportados
 * deste módulo para preservar a API pública anterior.
 */

export {
    signSessionCookie,
    verifySessionCookie,
} from "./sessionCookie";

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

/** Limite máximo (e default) de duração de uma sessão: 30 dias em ms. */
const MAX_SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Atualiza `lastSeenAt` apenas quando o último update aconteceu há mais
 * de 60 segundos, conforme a seção "Concorrência e Retentativas" do
 * design.
 */
const LAST_SEEN_AT_THROTTLE_MS = 60 * 1000;

// ---------------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------------

/**
 * Tipo de usuário associado a uma sessão. Replica o enum do Prisma para
 * manter o módulo desacoplado do client gerado em consumidores externos.
 */
export type UserType = PrismaUserType;

/**
 * Sessão autenticada conforme definida em design.md
 * (`Sistema_de_Autenticacao`).
 *
 * `id` é tanto a chave primária na tabela `sessions` quanto o token
 * opaco transportado pelo cookie de sessão.
 */
export type Session = {
    /** Identificador opaco (UUID v4) da sessão. */
    id: string;
    /** Identificador do usuário dono da sessão. */
    userId: string;
    /** Tipo do usuário (Cliente ou Acompanhante). */
    userType: UserType;
    /** Instante de expiração; sempre ≤ `createdAt + 30 dias`. */
    expiresAt: Date;
    /** Instante de revogação por logout, ou `null` se ainda ativa. */
    revokedAt: Date | null;
};

/** Opções de criação de sessão; expostas principalmente para testes. */
export type CreateSessionOptions = {
    /**
     * Relógio injetável. Útil em testes; em produção deixe ausente para
     * usar `new Date()`.
     */
    now?: Date;
    /**
     * Duração da sessão em milissegundos. Default e máximo absoluto:
     * 30 dias (Requirement 1.1). Valores maiores são truncados para 30d.
     */
    durationMs?: number;
    /**
     * Cliente Prisma a usar para a inserção. Permite que serviços que
     * precisam criar a sessão dentro de uma transação maior (por
     * exemplo, `Sistema_de_Cadastro_Cliente.registrar` no Requirement
     * 2.10) passem o `tx` recebido em `prisma.$transaction(...)`. Quando
     * ausente, usa o singleton {@link db}.
     */
    client?: Prisma.TransactionClient | typeof db;
};

/** Opções de resolução de sessão; expostas principalmente para testes. */
export type ResolveSessionOptions = {
    /** Relógio injetável. */
    now?: Date;
};

// ---------------------------------------------------------------------------
// API pública: repositório de sessões
// ---------------------------------------------------------------------------

/**
 * Cria uma nova sessão para `userId` do tipo `userType` e a persiste na
 * tabela `sessions`.
 *
 * `expiresAt` é calculado como `now + min(durationMs, 30 dias)` para
 * garantir o invariante do Requirement 1.1.
 *
 * @param userId   Identificador do usuário dono da sessão.
 * @param userType Tipo do usuário (`CLIENTE` ou `ACOMPANHANTE`).
 * @param opts     Opções (relógio e duração); úteis em testes.
 * @returns Sessão recém-criada já com `userType` resolvido.
 */
export async function createSession(
    userId: string,
    userType: UserType,
    opts: CreateSessionOptions = {},
): Promise<Session> {
    const now = opts.now ?? new Date();
    const requested = opts.durationMs ?? MAX_SESSION_DURATION_MS;
    const durationMs = Math.min(
        Math.max(requested, 0),
        MAX_SESSION_DURATION_MS,
    );
    const expiresAt = new Date(now.getTime() + durationMs);

    const client = opts.client ?? db;
    const created = await client.session.create({
        data: {
            userId,
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
}

/**
 * Marca uma sessão como revogada (logout). Idempotente: chamadas
 * subsequentes não sobrescrevem o `revokedAt` original e nunca lançam
 * para sessões inexistentes.
 *
 * @param sessionId Identificador opaco da sessão.
 */
export async function revokeSession(sessionId: string): Promise<void> {
    await db.session.updateMany({
        where: { id: sessionId, revokedAt: null },
        data: { revokedAt: new Date() },
    });
}

/**
 * Lê e valida uma sessão pelo identificador.
 *
 * Retorna `null` quando a sessão não existe, foi revogada ou já expirou.
 * Em caso de sucesso, atualiza `lastSeenAt` apenas se o último update
 * aconteceu há mais de 60 segundos, evitando contenção em alto tráfego.
 *
 * @param sessionId Identificador opaco da sessão.
 * @param opts      Opções (relógio); útil em testes.
 * @returns Sessão válida com `userType` resolvido, ou `null`.
 */
export async function resolveSession(
    sessionId: string,
    opts: ResolveSessionOptions = {},
): Promise<Session | null> {
    if (!sessionId) {
        return null;
    }
    const now = opts.now ?? new Date();

    const row = await db.session.findUnique({
        where: { id: sessionId },
        select: {
            id: true,
            userId: true,
            expiresAt: true,
            revokedAt: true,
            lastSeenAt: true,
            user: {
                select: { type: true },
            },
        },
    });

    if (!row) {
        return null;
    }
    if (row.revokedAt !== null) {
        return null;
    }
    if (row.expiresAt.getTime() <= now.getTime()) {
        return null;
    }

    if (now.getTime() - row.lastSeenAt.getTime() >= LAST_SEEN_AT_THROTTLE_MS) {
        await db.session.update({
            where: { id: row.id },
            data: { lastSeenAt: now },
        });
    }

    return {
        id: row.id,
        userId: row.userId,
        userType: row.user.type,
        expiresAt: row.expiresAt,
        revokedAt: row.revokedAt,
    };
}
