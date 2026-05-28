"use client";

import * as React from "react";

/**
 * Ponto de dado de uma série exibida pelo {@link BarChart}.
 */
export interface BarChartPoint {
    /** Rótulo do eixo X (ex.: dia ISO). */
    label: string;
    /**
     * Valor primário (barra principal). Sempre não-negativo — valores
     * negativos são clampados em zero pra não quebrar a escala.
     */
    value: number;
    /**
     * Tooltip opcional exibido no `title` do bar — útil pra mostrar
     * datas formatadas ("Seg, 10 mai" em vez de `2026-05-10`).
     */
    tooltip?: string;
}

/**
 * Props do {@link BarChart}.
 *
 * Gráfico de barras minimalista feito com `<div>` em CSS — sem
 * dependência externa (sem chart.js, recharts etc). Preserva o
 * bundle pequeno.
 *
 * Acessibilidade: cada barra é um `<li>` num `<ul>` com role
 * `list`; o `title` HTML serve de tooltip e o valor numérico é
 * exibido no topo da barra. Para leitor de tela, agregamos os
 * valores numa string acessível via `aria-label`.
 *
 * Nenhuma prop carrega nomes de entidades de domínio (Property 29).
 */
export interface BarChartProps {
    /** Pontos da série, ordem cronológica esquerda → direita. */
    data: ReadonlyArray<BarChartPoint>;
    /**
     * Altura do gráfico em px. Padrão: 160. As barras crescem até
     * 90% dessa altura (10% reservado para o label numérico no
     * topo).
     */
    height?: number;
    /** Rótulo acessível do gráfico. */
    "aria-label": string;
    /** Classes extras aplicadas ao container. */
    className?: string;
    /**
     * Mostra labels no eixo X. Quando `false`, esconde os textos
     * abaixo das barras. Padrão: `true`.
     */
    showXLabels?: boolean;

    /**
     * Formatador opcional do rótulo do eixo X. Recebe `point.label`
     * (e o índice) e devolve a string a ser exibida. Default:
     * mostra os 2 últimos caracteres — funciona pra rótulos curtos
     * tipo `"2026-05-28"` ("28") sem assumir nada do conteúdo.
     *
     * Quando o consumidor passa rótulos com semântica diferente
     * (mês, hora, etc.), passe um formatador customizado.
     */
    formatXLabel?: (label: string, index: number) => string;
    /**
     * Quando `true`, exibe o valor numérico em cima de cada barra.
     * Padrão: `false` (visual mais limpo, info via hover).
     */
    showValues?: boolean;
}

/**
 * BarChart — gráfico de barras simples, CSS-only.
 *
 * Visual: barras verticais salmão (primary-500) com cantos
 * superiores arredondados. Linha de baseline neutra. Hover
 * destaca via `primary-600` + cursor. Labels do eixo X são
 * truncados quando passam de 4 chars (mostra só dia, ex: "10").
 */
export function BarChart({
    data,
    height = 160,
    "aria-label": ariaLabel,
    className,
    showXLabels = true,
    formatXLabel = (label) => label.slice(-2),
    showValues = false,
}: BarChartProps): React.ReactElement {
    const max = data.reduce(
        (acc, p) => Math.max(acc, Math.max(0, p.value)),
        0,
    );
    // Quando todos zeros, o max vira 1 pra evitar divisão por zero
    // — todas as barras ficam com altura zero (placeholder).
    const safeMax = max === 0 ? 1 : max;

    const composed = ["flex flex-col gap-2", className ?? ""]
        .filter(Boolean)
        .join(" ");

    return (
        <div
            className={composed}
            role="img"
            aria-label={`${ariaLabel}. ${describeData(data)}`}
        >
            <ul
                className="flex items-end gap-1"
                style={{ height }}
                role="list"
            >
                {data.map((p, i) => {
                    const v = Math.max(0, p.value);
                    const pct = (v / safeMax) * 90; // 90% reservado pro label
                    return (
                        <li
                            key={`${p.label}-${i}`}
                            className="group relative flex flex-1 items-end justify-center"
                            title={p.tooltip ?? `${p.label}: ${v}`}
                        >
                            {showValues && v > 0 ? (
                                <span
                                    aria-hidden="true"
                                    className="absolute -top-4 text-[0.6rem] font-medium text-text-secondary tabular-nums"
                                >
                                    {v}
                                </span>
                            ) : null}
                            <span
                                aria-hidden="true"
                                className="block w-full rounded-t-sm bg-primary-200 transition-colors group-hover:bg-primary-500"
                                style={{
                                    height: `${pct}%`,
                                    minHeight: v > 0 ? "2px" : "0",
                                }}
                            />
                        </li>
                    );
                })}
            </ul>
            {showXLabels ? (
                <ul
                    className="flex gap-1"
                    aria-hidden="true"
                >
                    {data.map((p, i) => (
                        <li
                            key={`label-${p.label}-${i}`}
                            className="flex-1 text-center text-[0.6rem] text-text-disabled"
                        >
                            {formatXLabel(p.label, i)}
                        </li>
                    ))}
                </ul>
            ) : null}
        </div>
    );
}

/**
 * Constrói uma string descritiva da série para leitores de tela.
 * Ex.: "10 pontos: 0, 5, 12, 30, …".
 */
function describeData(data: ReadonlyArray<BarChartPoint>): string {
    if (data.length === 0) return "Sem dados.";
    const total = data.reduce((acc, p) => acc + Math.max(0, p.value), 0);
    return `${data.length} pontos. Total: ${total}.`;
}
