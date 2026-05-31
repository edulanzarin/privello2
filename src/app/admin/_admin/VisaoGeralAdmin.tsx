import * as React from "react";

import {
    BookmarkIcon,
    FlagIcon,
    FlameIcon,
    ShieldIcon,
    UsersIcon,
    VerifiedBadgeIcon,
} from "@/components";

import type { MetricasAdmin } from "@/server/admin/metricas";

/**
 * Aba "Visão geral" do painel admin (W8).
 *
 * Mostra os números operacionais num grid de cartões: pendências
 * de moderação em destaque (precisam de ação) + saúde geral da
 * plataforma. Sem interatividade — é leitura rápida pro admin
 * decidir pra onde ir.
 */
export interface VisaoGeralAdminProps {
    metricas: MetricasAdmin;
}

export function VisaoGeralAdmin({
    metricas,
}: VisaoGeralAdminProps): React.ReactElement {
    return (
        <div className="flex flex-col gap-5">
            {/* Pendências — exigem ação. */}
            <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-secondary">
                    Pendências
                </h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <MetricCard
                        icon={<ShieldIcon size={18} />}
                        value={metricas.verificacoesPendentes}
                        label="Verificações na fila"
                        alert={metricas.verificacoesPendentes > 0}
                    />
                    <MetricCard
                        icon={<FlagIcon size={18} />}
                        value={metricas.denunciasPendentes}
                        label="Denúncias abertas"
                        alert={metricas.denunciasPendentes > 0}
                    />
                </div>
            </div>

            {/* Saúde da plataforma. */}
            <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-secondary">
                    Plataforma
                </h3>
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <MetricCard
                        icon={<UsersIcon size={18} />}
                        value={metricas.perfisAtivos}
                        label="Perfis ativos"
                    />
                    <MetricCard
                        icon={<VerifiedBadgeIcon size={18} />}
                        value={metricas.perfisVerificados}
                        label="Verificados"
                    />
                    <MetricCard
                        icon={<FlameIcon size={18} />}
                        value={metricas.boostsAtivos}
                        label="Boosts ativos"
                    />
                    <MetricCard
                        icon={<BookmarkIcon size={18} />}
                        value={metricas.clientes}
                        label="Clientes"
                    />
                </div>
            </div>
        </div>
    );
}

function MetricCard({
    icon,
    value,
    label,
    alert = false,
}: {
    icon: React.ReactNode;
    value: number;
    label: string;
    alert?: boolean;
}): React.ReactElement {
    return (
        <div
            className={[
                "flex items-center gap-3 rounded-2xl border bg-surface px-4 py-3",
                alert ? "border-[#ec7b5b]/40 bg-[#fff0eb]/50" : "border-border",
            ].join(" ")}
        >
            <span
                aria-hidden="true"
                className={[
                    "inline-flex h-10 w-10 flex-none items-center justify-center rounded-full",
                    alert
                        ? "bg-[color:var(--accent)] text-white"
                        : "bg-[color:var(--accent-soft)] text-[color:var(--accent-deep)]",
                ].join(" ")}
            >
                {icon}
            </span>
            <div className="flex min-w-0 flex-col">
                <span className="text-xl font-bold tabular-nums text-text-primary">
                    {value.toLocaleString("pt-BR")}
                </span>
                <span className="truncate text-xs text-text-secondary">
                    {label}
                </span>
            </div>
        </div>
    );
}
