"use client";

import * as React from "react";

/**
 * Célula do {@link Heatmap}. `row`/`col` são índices 0-based na
 * grade; `value` é a intensidade (>= 0).
 */
export interface HeatmapCell {
    row: number;
    col: number;
    value: number;
}

/**
 * Props do {@link Heatmap}.
 *
 * Mapa de calor genérico em grade (linhas × colunas) feito só com
 * CSS — sem dependência externa. A intensidade de cada célula é
 * mapeada num gradiente de opacidade da cor accent: 0 = vazio
 * (fundo neutro), max = accent cheio.
 *
 * O componente não conhece "stories", "visualizações" nem qualquer
 * entidade de domínio (Property 29) — recebe `rowLabels`,
 * `colLabels` e `cells` genéricos. Quem monta decide se a grade é
 * dia×hora, mês×dia, etc.
 *
 * Acessibilidade: `role="img"` com `aria-label` descritivo. Cada
 * célula tem `title` nativo (tooltip) com o valor.
 */
export interface HeatmapProps {
    /** Número de linhas. */
    rows: number;
    /** Número de colunas. */
    cols: number;
    /** Células com valor. Células ausentes são tratadas como 0. */
    cells: ReadonlyArray<HeatmapCell>;
    /** Rótulos das linhas (eixo Y). Tamanho deve casar com `rows`. */
    rowLabels: ReadonlyArray<string>;
    /**
     * Rótulos das colunas (eixo X). Tamanho deve casar com `cols`.
     * Quando muitas colunas, o consumidor pode passar strings vazias
     * pra ocultar parte (ex.: mostrar só horas pares).
     */
    colLabels: ReadonlyArray<string>;
    /** Rótulo acessível geral. */
    "aria-label": string;
    /**
     * Constrói o texto do tooltip de cada célula. Default:
     * `"<rowLabel> <colLabel>: <value>"`.
     */
    formatTooltip?: (args: {
        rowLabel: string;
        colLabel: string;
        value: number;
    }) => string;
    /** Classes extras no container. */
    className?: string;
}

/**
 * Heatmap — grade de intensidade CSS-only.
 *
 * Visual: células quadradas com `aspect-square`, gap pequeno,
 * cantos levemente arredondados. Intensidade vira opacidade do
 * accent (5 faixas). Scroll horizontal quando a grade não cabe.
 */
export function Heatmap({
    rows,
    cols,
    cells,
    rowLabels,
    colLabels,
    "aria-label": ariaLabel,
    formatTooltip,
    className,
}: HeatmapProps): React.ReactElement {
    // Indexa células por "row:col" e acha o máximo pra normalizar.
    const byKey = new Map<string, number>();
    let max = 0;
    for (const c of cells) {
        byKey.set(`${c.row}:${c.col}`, c.value);
        if (c.value > max) max = c.value;
    }
    const safeMax = max === 0 ? 1 : max;

    const tooltipFor = (
        rowLabel: string,
        colLabel: string,
        value: number,
    ): string =>
        formatTooltip
            ? formatTooltip({ rowLabel, colLabel, value })
            : `${rowLabel} ${colLabel}: ${value}`;

    const composed = ["w-full overflow-x-auto", className ?? ""]
        .filter(Boolean)
        .join(" ");

    return (
        <div
            className={composed}
            role="img"
            aria-label={`${ariaLabel}. Máximo: ${max}.`}
        >
            <div className="inline-flex flex-col gap-1 min-w-full">
                {Array.from({ length: rows }, (_, r) => (
                    <div key={`row-${r}`} className="flex items-center gap-1">
                        <span className="w-9 flex-none text-right text-[0.6rem] font-medium text-text-secondary">
                            {rowLabels[r] ?? ""}
                        </span>
                        <div className="flex flex-1 gap-1">
                            {Array.from({ length: cols }, (_, c) => {
                                const value = byKey.get(`${r}:${c}`) ?? 0;
                                const intensity =
                                    value === 0 ? 0 : value / safeMax;
                                return (
                                    <span
                                        key={`cell-${r}-${c}`}
                                        title={tooltipFor(
                                            rowLabels[r] ?? "",
                                            colLabels[c] ?? "",
                                            value,
                                        )}
                                        className="aspect-square flex-1 rounded-[3px] ring-1 ring-inset ring-black/[0.03]"
                                        style={{
                                            backgroundColor:
                                                intensity === 0
                                                    ? "rgb(244, 244, 245)"
                                                    : `color-mix(in srgb, var(--accent) ${Math.round(
                                                          15 + intensity * 85,
                                                      )}%, transparent)`,
                                        }}
                                    />
                                );
                            })}
                        </div>
                    </div>
                ))}
                {/* Eixo X (colunas). */}
                <div className="flex items-center gap-1 pt-0.5">
                    <span className="w-9 flex-none" aria-hidden="true" />
                    <div className="flex flex-1 gap-1">
                        {Array.from({ length: cols }, (_, c) => (
                            <span
                                key={`collabel-${c}`}
                                className="flex-1 text-center text-[0.55rem] text-text-disabled"
                            >
                                {colLabels[c] ?? ""}
                            </span>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
