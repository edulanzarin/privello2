"use client";

import * as React from "react";

import {
    BarChart,
    Card,
    ChatIcon,
    EmptyState,
    Heatmap,
    HeartIcon,
    IconSegmented,
    ImageIcon,
    PlayIcon,
    SectionHeader,
    UsersIcon,
    type IconSegmentedOption,
} from "@/components";

import type { StatDiaria } from "@/server/acompanhante-profile/stats";

/**
 * Dados das estatísticas avançadas (T10), já serializados pra
 * client (URLs prontas, sem storageKey cru).
 */
export interface EstatisticasAvancadas {
    heatmap: ReadonlyArray<{ weekday: number; hour: number; views: number }>;
    origens: ReadonlyArray<{ origin: string; views: number }>;
    topMidias: ReadonlyArray<{
        mediaId: string;
        kind: "PHOTO" | "VIDEO";
        url: string;
        likesCount: number;
        commentsCount: number;
    }>;
    totalWhatsappClicks: number;
    /** Conversão view → WhatsApp em %, ou `null` se não há views. */
    conversao: number | null;
}

/**
 * Aba "Estatísticas" do painel da Acompanhante.
 *
 * Sub-tabs internas (T10):
 *   - **Geral**: gráfico diário de views/curtidas + totais + conversão.
 *   - **Horários**: heatmap 7×24 (dia da semana × hora UTC).
 *   - **Origens**: barras de views por origem (busca/home/etc).
 *   - **Top mídias**: ranking das mídias mais curtidas.
 */
export interface EstatisticasTabProps {
    stats: ReadonlyArray<StatDiaria>;
    /** Total acumulado de visualizações (campo agregado direto). */
    totalViews: number;
    /** Total acumulado de curtidas (soma de likesCount em mídias). */
    totalLikes: number;
    /** Dados avançados (T10). */
    avancadas: EstatisticasAvancadas;
}

type SubTab = "geral" | "horarios" | "origens" | "midias";
type Metrica = "views" | "likes";

const DIAS_SEMANA_LABEL = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const ORIGEM_LABEL: Record<string, string> = {
    BUSCA: "Busca",
    HOME: "Home",
    COMPARTILHADO: "Compartilhado",
    DIRECT: "Direto",
};

export function EstatisticasTab({
    stats,
    totalViews,
    totalLikes,
    avancadas,
}: EstatisticasTabProps): React.ReactElement {
    const [subTab, setSubTab] = React.useState<SubTab>("geral");

    const subTabOptions: ReadonlyArray<IconSegmentedOption> = [
        { value: "geral", label: "Geral", icon: <UsersIcon size={14} /> },
        { value: "horarios", label: "Horários", icon: <PlayIcon size={14} /> },
        { value: "origens", label: "Origens", icon: <ChatIcon size={14} /> },
        { value: "midias", label: "Top mídias", icon: <ImageIcon size={14} /> },
    ];

    return (
        <div className="flex flex-col gap-5">
            <SectionHeader
                title="Estatísticas"
                subtitle="Entenda como seu perfil performa."
            />

            <IconSegmented
                options={subTabOptions}
                value={subTab}
                onChange={(v) => setSubTab(v as SubTab)}
                aria-label="Trocar visão de estatística"
            />

            {subTab === "geral" ? (
                <GeralView
                    stats={stats}
                    totalViews={totalViews}
                    totalLikes={totalLikes}
                    totalWhatsappClicks={avancadas.totalWhatsappClicks}
                    conversao={avancadas.conversao}
                />
            ) : null}

            {subTab === "horarios" ? (
                <HorariosView heatmap={avancadas.heatmap} />
            ) : null}

            {subTab === "origens" ? (
                <OrigensView origens={avancadas.origens} />
            ) : null}

            {subTab === "midias" ? (
                <TopMidiasView midias={avancadas.topMidias} />
            ) : null}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Geral
// ---------------------------------------------------------------------------

function GeralView({
    stats,
    totalViews,
    totalLikes,
    totalWhatsappClicks,
    conversao,
}: {
    stats: ReadonlyArray<StatDiaria>;
    totalViews: number;
    totalLikes: number;
    totalWhatsappClicks: number;
    conversao: number | null;
}): React.ReactElement {
    const [metrica, setMetrica] = React.useState<Metrica>("views");

    const opcoes: ReadonlyArray<IconSegmentedOption> = [
        { value: "views", label: "Visualizações", icon: <UsersIcon size={14} /> },
        { value: "likes", label: "Curtidas", icon: <HeartIcon size={14} /> },
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
            {/* Cards de totais */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <TotalCard label="Visualizações" value={totalViews} hint="total" />
                <TotalCard label="Curtidas" value={totalLikes} hint="mídias" />
                <TotalCard
                    label="Contatos WhatsApp"
                    value={totalWhatsappClicks}
                    hint="cliques"
                />
                <Card>
                    <div className="flex flex-col gap-1">
                        <span className="text-[0.65rem] font-semibold uppercase tracking-wider text-text-secondary">
                            Conversão
                        </span>
                        <span className="text-2xl font-semibold tracking-tight text-text-primary tabular-nums">
                            {conversao !== null ? `${conversao}%` : "—"}
                        </span>
                        <span className="text-xs text-text-secondary">
                            view → contato
                        </span>
                    </div>
                </Card>
            </div>

            {/* Gráfico diário */}
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
                            formatXLabel={(iso) => iso.slice(8, 10)}
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

function TotalCard({
    label,
    value,
    hint,
}: {
    label: string;
    value: number;
    hint: string;
}): React.ReactElement {
    return (
        <Card>
            <div className="flex flex-col gap-1">
                <span className="text-[0.65rem] font-semibold uppercase tracking-wider text-text-secondary">
                    {label}
                </span>
                <span className="text-2xl font-semibold tracking-tight text-text-primary tabular-nums">
                    {value.toLocaleString("pt-BR")}
                </span>
                <span className="text-xs text-text-secondary">{hint}</span>
            </div>
        </Card>
    );
}

// ---------------------------------------------------------------------------
// Horários (heatmap)
// ---------------------------------------------------------------------------

function HorariosView({
    heatmap,
}: {
    heatmap: ReadonlyArray<{ weekday: number; hour: number; views: number }>;
}): React.ReactElement {
    const cells = React.useMemo(
        () =>
            heatmap.map((c) => ({
                row: c.weekday,
                col: c.hour,
                value: c.views,
            })),
        [heatmap],
    );

    // Labels de hora: mostra só pares pra não poluir (0, 2, 4...).
    const colLabels = React.useMemo(
        () =>
            Array.from({ length: 24 }, (_, h) =>
                h % 3 === 0 ? String(h) : "",
            ),
        [],
    );

    if (cells.length === 0) {
        return (
            <Card padding="none">
                <EmptyState
                    size="sm"
                    icon={<UsersIcon size={20} />}
                    title="Sem dados de horário ainda"
                    description="Conforme seu perfil recebe visitas, o mapa mostra os horários de pico."
                />
            </Card>
        );
    }

    return (
        <Card>
            <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-semibold text-text-primary">
                        Horários de pico
                    </span>
                    <span className="text-xs text-text-secondary">
                        Visitas por dia da semana × hora (UTC). Quanto mais
                        forte, mais visitas.
                    </span>
                </div>
                <Heatmap
                    rows={7}
                    cols={24}
                    cells={cells}
                    rowLabels={DIAS_SEMANA_LABEL}
                    colLabels={colLabels}
                    aria-label="Mapa de calor de visitas por dia e hora"
                    formatTooltip={({ rowLabel, colLabel, value }) =>
                        `${rowLabel} ${colLabel.length > 0 ? colLabel : "?"}h: ${value} visita${
                            value === 1 ? "" : "s"
                        }`
                    }
                />
            </div>
        </Card>
    );
}

// ---------------------------------------------------------------------------
// Origens
// ---------------------------------------------------------------------------

function OrigensView({
    origens,
}: {
    origens: ReadonlyArray<{ origin: string; views: number }>;
}): React.ReactElement {
    const total = origens.reduce((acc, o) => acc + o.views, 0);

    if (total === 0) {
        return (
            <Card padding="none">
                <EmptyState
                    size="sm"
                    icon={<ChatIcon size={20} />}
                    title="Sem dados de origem ainda"
                    description="Quando seu perfil receber visitas, mostramos de onde vieram."
                />
            </Card>
        );
    }

    return (
        <Card>
            <div className="flex flex-col gap-4">
                <span className="text-sm font-semibold text-text-primary">
                    De onde vêm suas visitas
                </span>
                <div className="flex flex-col gap-3">
                    {origens.map((o) => {
                        const pct = total > 0 ? (o.views / total) * 100 : 0;
                        return (
                            <div
                                key={o.origin}
                                className="flex flex-col gap-1"
                            >
                                <div className="flex items-center justify-between text-xs">
                                    <span className="font-medium text-text-primary">
                                        {ORIGEM_LABEL[o.origin] ?? o.origin}
                                    </span>
                                    <span className="text-text-secondary tabular-nums">
                                        {o.views.toLocaleString("pt-BR")} (
                                        {Math.round(pct)}%)
                                    </span>
                                </div>
                                <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-100">
                                    <div
                                        className="h-full rounded-full bg-gradient-to-r from-accent to-accent-deep"
                                        style={{ width: `${pct}%` }}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </Card>
    );
}

// ---------------------------------------------------------------------------
// Top mídias
// ---------------------------------------------------------------------------

function TopMidiasView({
    midias,
}: {
    midias: ReadonlyArray<{
        mediaId: string;
        kind: "PHOTO" | "VIDEO";
        url: string;
        likesCount: number;
        commentsCount: number;
    }>;
}): React.ReactElement {
    const comAlgumaCurtida = midias.some((m) => m.likesCount > 0);

    if (midias.length === 0 || !comAlgumaCurtida) {
        return (
            <Card padding="none">
                <EmptyState
                    size="sm"
                    icon={<ImageIcon size={20} />}
                    title="Sem curtidas ainda"
                    description="Suas mídias mais curtidas aparecem aqui em ranking."
                />
            </Card>
        );
    }

    return (
        <Card>
            <div className="flex flex-col gap-4">
                <span className="text-sm font-semibold text-text-primary">
                    Mídias mais curtidas
                </span>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {midias.map((m, i) => (
                        <div key={m.mediaId} className="flex flex-col gap-1.5">
                            <span className="relative block aspect-[3/4] overflow-hidden rounded-xl bg-neutral-100 ring-1 ring-neutral-200">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={m.url}
                                    alt=""
                                    className="h-full w-full object-cover"
                                />
                                <span className="absolute left-1.5 top-1.5 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-black/60 px-1 text-[0.6rem] font-semibold text-white">
                                    #{i + 1}
                                </span>
                                {m.kind === "VIDEO" ? (
                                    <span className="absolute right-1.5 top-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white">
                                        <PlayIcon size={10} />
                                    </span>
                                ) : null}
                            </span>
                            <div className="flex items-center gap-2 px-0.5 text-[0.65rem] text-text-secondary">
                                <span className="inline-flex items-center gap-0.5">
                                    <HeartIcon size={10} />
                                    {m.likesCount}
                                </span>
                                <span className="inline-flex items-center gap-0.5">
                                    <ChatIcon size={10} />
                                    {m.commentsCount}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </Card>
    );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
