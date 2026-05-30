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

import { ativarBoostsAgendados } from "@/server/boost";
import { arquivarStoriesExpiradosGlobal } from "@/server/storage/storyMedia";
import { rebaixarVerificacoesExpiradas } from "@/server/verification";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export interface CleanupReport {
    sessionsDeleted: number;
    onboardingDraftsDeleted: number;
    loginAttemptsDeleted: number;
    passwordResetTokensDeleted: number;
    storiesArchived: number;
    /**
     * Quantos `ClientProfile.planoVigente='FAN'` com
     * `planoExpiraEm <= now` foram normalizados pra `GRATIS`.
     * Operação idempotente — rodar de novo não muda nada.
     */
    fansClienteExpirados: number;
    /**
     * Quantas verificações `APROVADA` com `expiraEm < now`
     * tiveram `acompanhante_profiles.verificada` rebaixado pra
     * `false`. Acompanhante perde o selo até reenviar selfie +
     * documento.
     */
    verificacoesExpiradas: number;
    /**
     * Quantos boosts agendados (`startAt <= now`, ainda não
     * ativados) foram ativados nesta varredura — estendem o
     * `boostUntil` da Acompanhante.
     */
    boostsAgendadosAtivados: number;
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
        fansClienteExpirados: 0,
        verificacoesExpiradas: 0,
        boostsAgendadosAtivados: 0,
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

    // 6) Cliente Fan expirado → GRATIS.
    //    A leitura via `obterPerfilCliente`/`obterVigente` já faz
    //    downgrade lazy (retorna GRATIS quando expirado), mas o
    //    registro físico pode ficar desatualizado por dias se ninguém
    //    consultar — esta etapa normaliza o banco. Não toca em
    //    `planoSelecionadoEm` (mantém histórico).
    try {
        const result = await db.clientProfile.updateMany({
            where: {
                planoVigente: "FAN",
                planoExpiraEm: { not: null, lt: now },
            },
            data: {
                planoVigente: "GRATIS",
                planoExpiraEm: null,
            },
        });
        report.fansClienteExpirados = result.count;
    } catch {
        // best-effort
    }

    // 7) Verificações expiradas → rebaixa `verificada` no
    //    AcompanhanteProfile. Acompanhante reenvia documento pra
    //    renovar (validade de 180 dias).
    try {
        const result = await rebaixarVerificacoesExpiradas({ now });
        report.verificacoesExpiradas = result.rebaixadas;
    } catch {
        // best-effort
    }

    // 8) Boosts agendados que chegaram a hora → ativa (estende
    //    `boostUntil`). Idempotente via `activatesAt IS NULL`.
    try {
        const result = await ativarBoostsAgendados({ now });
        report.boostsAgendadosAtivados = result.ativados;
    } catch {
        // best-effort
    }

    return report;
}
