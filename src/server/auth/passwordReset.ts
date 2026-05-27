/**
 * Sistema de reset de senha.
 *
 * Fluxo:
 *
 *   1. Cliente faz `POST /api/auth/forgot-password` com email.
 *   2. Service `criarTokenResetSenha`:
 *      - Encontra usuário por email (silencioso se não existir —
 *        evita enumeração de contas).
 *      - Gera token aleatório (32 bytes hex = 64 chars).
 *      - Persiste apenas SHA-256 do token (`tokenHash`).
 *      - TTL: 60 min.
 *      - **TODO**: enviar token por email. Por enquanto, retorna
 *        o token raw para que possa ser exibido em logs durante
 *        desenvolvimento.
 *   3. Cliente abre `/redefinir-senha?token=<raw>`.
 *   4. Cliente envia novo password + token para
 *      `POST /api/auth/reset-password`.
 *   5. Service `consumirTokenResetSenha`:
 *      - Valida hash do token.
 *      - Verifica `expiresAt > now` e `usedAt IS NULL`.
 *      - Atualiza `passwordHash` do usuário com argon2id.
 *      - Marca token como usado (`usedAt = now`).
 *      - Revoga todas as sessões ativas do usuário (segurança —
 *        outras pessoas que estavam logadas perdem acesso).
 *
 * Anti-abuse: rate limit por email (3 solicitações / 60 min).
 * Reusa o mesmo `LoginAttempt` que já existe — diferenciamos via
 * prefixo no campo `email` (`reset:` evita colisão com login).
 */

import { createHash, randomBytes } from "node:crypto";

import { Prisma } from "@prisma/client";

import { hashPassword } from "@/domain/auth/password";
import { db } from "@/lib/db";

/** TTL do token em ms — 60 min. */
const TOKEN_TTL_MS = 60 * 60 * 1000;

/**
 * Janela do rate limit por email para solicitações de reset.
 * Distinta do rate limit de login.
 */
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 3;

/** Prefixo no `LoginAttempt.email` que identifica solicitação de reset. */
const RESET_PREFIX = "reset:";

// ---------------------------------------------------------------------------
// criarTokenResetSenha
// ---------------------------------------------------------------------------

export type CriarTokenResetSenhaResult =
    | {
        ok: true;
        /**
         * Token em texto claro. Em prod, o caller MANDA POR EMAIL e
         * NÃO retorna ao cliente. Em dev, o `/api/auth/forgot-password`
         * pode incluir no payload pra facilitar teste manual (com
         * flag).
         */
        token: string;
        /**
         * `true` quando o usuário existia e o token foi gerado.
         * `false` quando o email não existe — o caller responde
         * sempre 200 pra não vazar enumeração.
         */
        emailValido: boolean;
    }
    | { ok: false; reason: "RATE_LIMITED" };

/**
 * Gera token aleatório, persiste hash e devolve raw. Idempotente
 * por email — chamadas repetidas geram tokens novos sem invalidar
 * os anteriores (ambos ficam válidos até expirar ou serem usados).
 */
export async function criarTokenResetSenha(
    emailRaw: string,
    options: { now?: Date } = {},
): Promise<CriarTokenResetSenhaResult> {
    const now = options.now ?? new Date();
    const email = emailRaw.trim().toLowerCase();

    // Rate limit por email — 3 solicitações / 60 min.
    const since = new Date(now.getTime() - RATE_LIMIT_WINDOW_MS);
    const recentRequests = await db.loginAttempt.count({
        where: {
            email: `${RESET_PREFIX}${email}`,
            createdAt: { gt: since, lte: now },
        },
    });
    if (recentRequests >= RATE_LIMIT_MAX_REQUESTS) {
        return { ok: false, reason: "RATE_LIMITED" };
    }

    // Registra a tentativa antes de qualquer trabalho — o rate limit
    // acerta mesmo quando o email não existe.
    await db.loginAttempt.create({
        data: {
            email: `${RESET_PREFIX}${email}`,
            success: false,
            createdAt: now,
        },
    });

    // Localiza usuário. Silencioso quando não existe.
    const user = await db.user.findUnique({
        where: { email },
        select: { id: true },
    });

    // Gera token aleatório de 32 bytes (64 chars hex). Forte o
    // bastante pra brute-force ser inviável.
    const tokenRaw = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(tokenRaw).digest("hex");

    if (user !== null) {
        await db.passwordResetToken.create({
            data: {
                userId: user.id,
                tokenHash,
                expiresAt: new Date(now.getTime() + TOKEN_TTL_MS),
            },
        });
    }

    return {
        ok: true,
        token: tokenRaw,
        emailValido: user !== null,
    };
}

// ---------------------------------------------------------------------------
// consumirTokenResetSenha
// ---------------------------------------------------------------------------

export type ConsumirTokenResetSenhaResult =
    | { ok: true; userId: string }
    | {
        ok: false;
        reason: "TOKEN_INVALIDO" | "SENHA_INVALIDA" | "PERSISTENCIA";
    };

/**
 * Valida o token e troca a senha. Marca o token como usado e
 * revoga todas as sessões ativas do usuário (segurança — alguém
 * pediu reset, então provavelmente perdeu acesso ou suspeita de
 * comprometimento).
 *
 * @param tokenRaw   Token original recebido por email.
 * @param novaSenha  Senha em texto claro (validada por
 *                   `validarSenha` antes de chamar).
 */
export async function consumirTokenResetSenha(input: {
    token: string;
    novaSenha: string;
    now?: Date;
}): Promise<ConsumirTokenResetSenhaResult> {
    const now = input.now ?? new Date();

    // Validação básica de senha — comprimento. Validações mais
    // ricas ficam no caller (Zod no route handler).
    if (input.novaSenha.length < 8 || input.novaSenha.length > 128) {
        return { ok: false, reason: "SENHA_INVALIDA" };
    }

    const tokenHash = createHash("sha256")
        .update(input.token)
        .digest("hex");

    const row = await db.passwordResetToken.findUnique({
        where: { tokenHash },
        select: {
            id: true,
            userId: true,
            expiresAt: true,
            usedAt: true,
        },
    });

    if (
        !row ||
        row.usedAt !== null ||
        row.expiresAt.getTime() <= now.getTime()
    ) {
        return { ok: false, reason: "TOKEN_INVALIDO" };
    }

    // Hash da nova senha fora da transação (CPU-bound).
    const passwordHash = await hashPassword(input.novaSenha);

    try {
        await db.$transaction(async (tx) => {
            // Re-verifica idempotência dentro da transação pra
            // evitar race onde dois requests consomem o mesmo
            // token simultaneamente.
            const fresh = await tx.passwordResetToken.findUnique({
                where: { id: row.id },
                select: { usedAt: true },
            });
            if (fresh === null || fresh.usedAt !== null) {
                throw new TokenInvalidoError();
            }

            await tx.user.update({
                where: { id: row.userId },
                data: { passwordHash },
            });

            await tx.passwordResetToken.update({
                where: { id: row.id },
                data: { usedAt: now },
            });

            // Revoga todas as sessões ativas do usuário —
            // segurança, alguém pode ter perdido acesso ou
            // estar logado sem permissão.
            await tx.session.updateMany({
                where: { userId: row.userId, revokedAt: null },
                data: { revokedAt: now },
            });
        });
    } catch (error) {
        if (error instanceof TokenInvalidoError) {
            return { ok: false, reason: "TOKEN_INVALIDO" };
        }
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
            return { ok: false, reason: "PERSISTENCIA" };
        }
        return { ok: false, reason: "PERSISTENCIA" };
    }

    return { ok: true, userId: row.userId };
}

class TokenInvalidoError extends Error {
    constructor() {
        super("TOKEN_INVALIDO");
        this.name = "TokenInvalidoError";
    }
}

// ---------------------------------------------------------------------------
// limparTokensExpirados (GC)
// ---------------------------------------------------------------------------

/**
 * Apaga tokens expirados há mais de 7 dias. Mantém os recém
 * expirados pra debug. Chamado pelo cron de manutenção.
 */
export async function limparTokensExpirados(
    options: { now?: Date } = {},
): Promise<{ deleted: number }> {
    const now = options.now ?? new Date();
    const cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const result = await db.passwordResetToken.deleteMany({
        where: {
            OR: [
                { usedAt: { not: null }, createdAt: { lt: cutoff } },
                { expiresAt: { lt: cutoff } },
            ],
        },
    });
    return { deleted: result.count };
}
