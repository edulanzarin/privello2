"use client";

import * as React from "react";

import {
    BarChart,
    Card,
    EmptyState,
    HeartIcon,
    IconSegmented,
    SectionHeader,
    UsersIcon,
    type IconSegmentedOption,
} from "@/components";

import type { StatDiaria } from "@/server/acompanhante-profile/stats";

/**
 * Aba "Estatísticas" do painel da Acompanhante.
 *
 * Mostra gráfico de visualizações + curtidas dos últimos 30 dias
 * com filtro segmentado pra alternar a métrica exibida. Totais
 * agregados em cards no topo.
 */
export interface EstatisticasTabProps {
    stats: ReadonlyArray<StatDiaria>;
    /** Total acumulado de visualizações (campo agregado direto). */
    totalViews: number;
    /** Total acumulado de curtidas (soma de likesCount em mídias). */
    totalLikes: number;
}

type Metrica = "views" | "likes";

export function EstatisticasTab({
    stats,
    totalViews,
    totalLikes,
}: EstatisticasTabProps): React.ReactElement {
    const [metrica, setMetrica] = React.useState<Metrica>("views");

    const opcoes: ReadonlyArray<IconSegmentedOption> = [
        {
            value: "views",
            label: "Visualizações",
            icon: <UsersIcon size={14} />,
        },
        {
            value: "likes",
            label: "Curtidas",
            icon: <HeartIcon size={14} />,
        },
    ];

    const points = React.useMemo(
        () =>
            stats.map((s) => ({
                label: s.day,
                value: metrica === "views" ? s.views : s.likes,
                tooltip: `${formatDia(s.day)}: ${
                    metrica === "views" ? s.views : s.likes
                } ${metrica === "views" ? "visualizações" : "curtidas"}`,
            })),
        [stats, metrica],
    );

    const hasAnyData = points.some((p) => p.value > 0);
    const recentes7d = points.slice(-7).reduce((acc, p) => acc + p.value, 0);
    const recentes30d = points.reduce((acc, p) => acc + p.value, 0);

    return (
        <div className="flex flex-col gap-5">
            <SectionHeader
                title="Estatísticas"
                subtitle="Atividade do seu perfil nos últimos 30 dias."
            />

            {/* Cards de totais */}
            <div className="grid grid-cols-2 gap-3">
                <Card>
                    <div className="flex flex-col gap-1">
                        <span className="text-[0.65rem] font-semibold uppercase tracking-wider text-text-secondary">
                            Visualizações
                        </span>
                        <span className="text-2xl font-semibold tracking-tight text-text-primary tabular-nums">
                            {totalViews.toLocaleString("pt-BR")}
                        </span>
                        <span className="text-xs text-text-secondary">
                            total acumulado
                        </span>
                    </div>
                </Card>
                <Card>
                    <div className="flex flex-col gap-1">
                        <span className="text-[0.65rem] font-semibold uppercase tracking-wider text-text-secondary">
                            Curtidas
                        </span>
                        <span className="text-2xl font-semibold tracking-tight text-text-primary tabular-nums">
                            {totalLikes.toLocaleString("pt-BR")}
                        </span>
                        <span className="text-xs text-text-secondary">
                            em todas as mídias
                        </span>
                    </div>
                </Card>
            </div>

            {/* Gráfico */}
            <Card>
                <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex flex-col gap-0.5">
                            <span className="text-sm font-semibold text-text-primary">
                                Últimos 30 dias
                            </span>
                            <span className="text-xs text-text-secondary">
                                {metrica === "views" ? "Visualizações" : "Curtidas"}{" "}
                                por dia
                            </span>
                        </div>
                        <IconSegmented
                            options={opcoes}
                            value={metrica}
                            onChange={(v) => setMetrica(v as Metrica)}
                            aria-label="Trocar métrica"
                        />
                    </div>

                    {hasAnyData ? (
                        <BarChart
                            data={points}
                            height={180}
                            aria-label={
                                metrica === "views"
                                    ? "Visualizações por dia"
                                    : "Curtidas por dia"
                            }
                        />
                    ) : (
                        <EmptyState
                            size="sm"
                            icon={
                                metrica === "views" ? (
                                    <UsersIcon size={20} />
                                ) : (
                                    <HeartIcon size={20} />
                                )
                            }
                            title="Sem dados ainda"
                            description="A série diária aparece aqui assim que houver atividade."
                        />
                    )}

                    {/* Resumo 7d / 30d */}
                    <div className="grid grid-cols-2 gap-2 border-t border-neutral-100 pt-3 text-xs">
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[0.65rem] uppercase tracking-wider text-text-secondary">
                                Últimos 7 dias
                            </span>
                            <span className="text-base font-semibold text-text-primary tabular-nums">
                                {recentes7d.toLocaleString("pt-BR")}
                            </span>
                        </div>
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[0.65rem] uppercase tracking-wider text-text-secondary">
                                Últimos 30 dias
                            </span>
                            <span className="text-base font-semibold text-text-primary tabular-nums">
                                {recentes30d.toLocaleString("pt-BR")}
                            </span>
                        </div>
                    </div>
                </div>
            </Card>
        </div>
    );
}

/**
 * Formata um dia ISO (`YYYY-MM-DD`) para `Dia, dd mmm`. Exibido
 * no tooltip do gráfico.
 */
function formatDia(iso: string): string {
    const d = new Date(`${iso}T00:00:00Z`);
    return d.toLocaleDateString("pt-BR", {
        weekday: "short",
        day: "2-digit",
        month: "short",
    });
}
