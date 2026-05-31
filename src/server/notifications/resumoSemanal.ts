/**
 * Resumo semanal in-site da Acompanhante (W3).
 *
 * Uma vez por semana, consolida a atividade do perfil (visitas,
 * curtidas, novos favoritos, perguntas pendentes) numa notificação
 * in-site (reusa V2). Disparado pelo cron (`runCleanup`), com guarda
 * de cadência: só envia se a última notificação `RESUMO_SEMANAL`
 * daquela Acompanhante foi há ≥ 7 dias (ou nunca).
 *
 * # Por que no cron
 *
 * Não há agendador dedicado no MVP. O `POST /api/cleanup` roda
 * periodicamente (ex.: de hora em hora) e é o lugar natural pra
 * tarefas recorrentes. A guarda de cadência por-usuário evita
 * spammar mesmo que o cron rode com frequência alta.
 *
 * # Privacidade
 *
 * Só agrega números do próprio perfil — nada de quem visitou/
 * favoritou. Best-effort: falha numa Acompanhante não derruba as
 * demais.
 */

import { db } from "@/lib/db";
import { logger } from "@/lib/observability/logger";

import { criarNotificacao } from "./index";

const log = logger("resumo-semanal");

const SETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000;

export interface EnviarResumosResult {
    /** Quantas Acompanhantes receberam resumo nesta execução. */
    enviados: number;
}

/**
 * Gera e envia o resumo semanal pras Acompanhantes elegíveis.
 *
 * Elegível = perfil visível com plano vigente, sem `RESUMO_SEMANAL`
 * nos últimos 7 dias, e com **alguma** atividade na semana (não
 * enviamos "0 visitas, 0 curtidas" — seria ruído desmotivador).
 */
export async function enviarResumosSemanais(
    options: { now?: Date } = {},
): Promise<EnviarResumosResult> {
    const now = options.now ?? new Date();
    const desde = new Date(now.getTime() - SETE_DIAS_MS);

    let enviados = 0;

    let perfis: Array<{ userId: string }>;
    try {
        perfis = await db.acompanhanteProfile.findMany({
            where: {
                perfilVisivel: true,
                planoVigente: { not: null },
                user: { type: "ACOMPANHANTE" },
            },
            select: { userId: true },
        });
    } catch (err) {
        log.error("falha ao listar perfis para resumo", err);
        return { enviados: 0 };
    }

    for (const { userId } of perfis) {
        try {
            // Guarda de cadência: já mandou resumo nos últimos 7d?
            const ultimo = await db.notification.findFirst({
                where: {
                    userId,
                    type: "RESUMO_SEMANAL",
                    criadoEm: { gte: desde },
                },
                select: { id: true },
            });
            if (ultimo) continue;

            // Agrega visitas/curtidas da semana via profile_daily_stats.
            const statsAgg = await db.profileDailyStat.aggregate({
                where: { userId, day: { gte: desde } },
                _sum: { views: true, likes: true },
            });
            const visitas = statsAgg._sum.views ?? 0;
            const curtidas = statsAgg._sum.likes ?? 0;

            // Novos favoritos na janela.
            const novosFavoritos = await db.clientFavorite.count({
                where: { acompanhanteUserId: userId, criadoEm: { gte: desde } },
            });

            // Perguntas pendentes (snapshot atual, não só da semana).
            const perguntasPendentes = await db.acompanhanteQuestion.count({
                where: { targetUserId: userId, answeredAt: null },
            });

            // Sem nenhuma atividade relevante → não envia (evita ruído).
            const temAlgo =
                visitas > 0 ||
                curtidas > 0 ||
                novosFavoritos > 0 ||
                perguntasPendentes > 0;
            if (!temAlgo) continue;

            const id = await criarNotificacao({
                userId,
                type: "RESUMO_SEMANAL",
                payload: {
                    visitas,
                    curtidas,
                    novosFavoritos,
                    perguntasPendentes,
                },
            });
            if (id) enviados += 1;
        } catch (err) {
            log.error("falha ao gerar resumo de um perfil", err, { userId });
        }
    }

    return { enviados };
}
