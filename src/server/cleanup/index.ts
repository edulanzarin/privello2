/**
 * Garbage collection — apaga registros antigos das tabelas que
 * crescem indefinidamente.
 *
 * Operações:
 *
 *   - **Sessões**: revogadas/expiradas há > 7 dias são apagadas.
 *   - **OnboardingDraft**: expirados (TTL 60min) há > 1 dia.
 *   - **LoginAttempt**: > 30 dias.
 *   - **PasswordResetToken**: usados ou expirados há > 7 dias.
 *   - **Stories**: COMMITTED com `expiresAt` no passado viram
 *     ARCHIVED (delegado a `arquivarStoriesExpiradosGlobal`).
 *
 * Cada operação retorna o `count` deletado/atualizado pra
 * facilitar logging/monitoramento.
 *
 * Idempotente — rodar múltiplas vezes em sequência não tem efeito
 * negativo. Designed pra ser chamado por um cron job (ex.: a
 * cada hora) ou por um endpoint admin protegido.
 */

import { db } from "@/lib/db";

import { arquivarStoriesExpiradosGlobal } from "@/server/storage/storyMedia";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export interface CleanupReport {
    sessionsDeleted: number;
    onboardingDraftsDeleted: number;
    loginAttemptsDeleted: number;
    passwordResetTokensDeleted: number;
    storiesArchived: number;
}

/**
 * Executa todos os passos de limpeza. Cada passo isolado em
 * try/catch — falha em um não impede os outros. Soma reportada
 * no objeto de retorno.
 */
export async function runCleanup(
    options: { now?: Date } = {},
): Promise<CleanupReport> {
    const now = options.now ?? new Date();
    const report: CleanupReport = {
        sessionsDeleted: 0,
        onboardingDraftsDeleted: 0,
        loginAttemptsDeleted: 0,
        passwordResetTokensDeleted: 0,
        storiesArchived: 0,
    };

    // 1) Sessões revogadas há > 7 dias OU expiradas há > 7 dias.
    const sessionCutoff = new Date(now.getTime() - SEVEN_DAYS_MS);
    try {
        const result = await db.session.deleteMany({
            where: {
                OR: [
                    { revokedAt: { lt: sessionCutoff } },
                    { expiresAt: { lt: sessionCutoff } },
                ],
            },
        });
        report.sessionsDeleted = result.count;
    } catch {
        // best-effort
    }

    // 2) OnboardingDrafts expirados há > 1 dia.
    const draftCutoff = new Date(now.getTime() - ONE_DAY_MS);
    try {
        const result = await db.onboardingDraft.deleteMany({
            where: { expiresAt: { lt: draftCutoff } },
        });
        report.onboardingDraftsDeleted = result.count;
    } catch {
        // best-effort
    }

    // 3) LoginAttempts > 30 dias (sucesso ou falha — depois de 30d
    //    nada mais é útil pra rate-limit ou auditoria).
    const attemptCutoff = new Date(now.getTime() - THIRTY_DAYS_MS);
    try {
        const result = await db.loginAttempt.deleteMany({
            where: { createdAt: { lt: attemptCutoff } },
        });
        report.loginAttemptsDeleted = result.count;
    } catch {
        // best-effort
    }

    // 4) PasswordResetToken usados/expirados há > 7 dias.
    const tokenCutoff = new Date(now.getTime() - SEVEN_DAYS_MS);
    try {
        const result = await db.passwordResetToken.deleteMany({
            where: {
                OR: [
                    { usedAt: { lt: tokenCutoff } },
                    { expiresAt: { lt: tokenCutoff } },
                ],
            },
        });
        report.passwordResetTokensDeleted = result.count;
    } catch {
        // best-effort
    }

    // 5) Stories expirados → ARCHIVED.
    try {
        const result = await arquivarStoriesExpiradosGlobal({ now });
        report.storiesArchived = result.archived;
    } catch {
        // best-effort
    }

    return report;
}
