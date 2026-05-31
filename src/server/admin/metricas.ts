/**
 * Métricas rápidas do painel admin (W8).
 *
 * Consolida contadores operacionais numa única chamada pra a aba
 * "Visão geral": pendências de moderação (verificações + denúncias)
 * e totais de saúde da plataforma (perfis ativos, verificados,
 * clientes, boosts ativos). Tudo via `count` agregado — barato.
 *
 * Sem PII: só números. Best-effort não se aplica aqui — o admin
 * quer ver erro se algo falhar (deixa propagar pro boundary).
 */

import { db } from "@/lib/db";

export interface MetricasAdmin {
    /** Verificações aguardando triagem (`status = PENDENTE`). */
    verificacoesPendentes: number;
    /** Denúncias abertas (`status = PENDENTE`). */
    denunciasPendentes: number;
    /** Acompanhantes com perfil visível + plano vigente. */
    perfisAtivos: number;
    /** Acompanhantes com selo de verificação ativo. */
    perfisVerificados: number;
    /** Total de Clientes cadastrados. */
    clientes: number;
    /** Acompanhantes com boost ativo agora. */
    boostsAtivos: number;
}

/**
 * Lê todas as métricas do painel em paralelo.
 */
export async function obterMetricasAdmin(
    options: { now?: Date } = {},
): Promise<MetricasAdmin> {
    const now = options.now ?? new Date();

    const baseAtivo = {
        perfilVisivel: true,
        planoVigente: { not: null },
        user: { type: "ACOMPANHANTE" as const },
    };

    const [
        verificacoesPendentes,
        denunciasPendentes,
        perfisAtivos,
        perfisVerificados,
        clientes,
        boostsAtivos,
    ] = await Promise.all([
        db.verification.count({ where: { status: "PENDENTE" } }),
        db.report.count({ where: { status: "PENDENTE" } }),
        db.acompanhanteProfile.count({ where: baseAtivo }),
        db.acompanhanteProfile.count({
            where: { ...baseAtivo, verificada: true },
        }),
        db.user.count({ where: { type: "CLIENTE" } }),
        db.acompanhanteProfile.count({
            where: { ...baseAtivo, boostUntil: { gt: now } },
        }),
    ]);

    return {
        verificacoesPendentes,
        denunciasPendentes,
        perfisAtivos,
        perfisVerificados,
        clientes,
        boostsAtivos,
    };
}
