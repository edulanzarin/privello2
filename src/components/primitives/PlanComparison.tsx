import * as React from "react";

import { CheckIcon, XIcon } from "../icons";

/**
 * Valor de uma célula do comparativo: `true`/`false` viram ícone
 * de check/x; string/number são renderizados como texto.
 */
export type ComparisonValue = boolean | string | number;

/**
 * Uma linha do comparativo — um atributo com um valor por coluna.
 */
export interface ComparisonRow {
    /** Rótulo do atributo (1ª coluna). */
    label: string;
    /** Valores por coluna, na mesma ordem de {@link ComparisonColumnsProps.columns}. */
    values: ReadonlyArray<ComparisonValue>;
}

export interface ComparisonColumn {
    /** Título da coluna (ex.: nome do tier). */
    title: React.ReactNode;
    /** Quando `true`, a coluna é destacada (recomendada). */
    highlight?: boolean;
}

/**
 * Props do {@link PlanComparison}.
 *
 * Tabela comparativa genérica de N colunas × M atributos. Pensada
 * pra mostrar a diferença entre opções (ex.: tiers de oferta) lado
 * a lado, em vez de só bloquear um recurso.
 *
 * Nenhuma prop carrega nomes de entidades de domínio (Property 29) —
 * quem dá significado às colunas/linhas é o consumidor.
 */
export interface PlanComparisonProps {
    /** Cabeçalhos das colunas de valor (sem contar a 1ª de rótulos). */
    columns: ReadonlyArray<ComparisonColumn>;
    /** Linhas de atributos. */
    rows: ReadonlyArray<ComparisonRow>;
    /** Texto opcional no canto superior esquerdo (acima dos rótulos). */
    caption?: React.ReactNode;
    /** Classes extras aplicadas ao container. */
    className?: string;
}

function Cell({ value }: { value: ComparisonValue }): React.ReactElement {
    if (value === true) {
        return (
            <span
                aria-label="incluído"
                className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-success-100 text-success-700"
            >
                <CheckIcon size={14} />
            </span>
        );
    }
    if (value === false) {
        return (
            <span
                aria-label="não incluído"
                className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-neutral-100 text-text-disabled"
            >
                <XIcon size={14} />
            </span>
        );
    }
    return (
        <span className="text-sm font-medium text-text-primary">
            {value}
        </span>
    );
}

/**
 * PlanComparison — tabela comparativa responsiva.
 *
 * Visual: grade com 1ª coluna de rótulos alinhada à esquerda e N
 * colunas de valores centralizadas. A coluna `highlight` ganha
 * fundo warm sutil pra puxar o olho. Em mobile a tabela rola
 * horizontalmente se necessário (largura mínima por coluna).
 */
export function PlanComparison({
    columns,
    rows,
    caption,
    className,
}: PlanComparisonProps): React.ReactElement {
    const gridCols = {
        gridTemplateColumns: `minmax(7rem, 1.4fr) repeat(${columns.length}, minmax(5rem, 1fr))`,
    };

    return (
        <div
            className={[
                "overflow-x-auto rounded-3xl border border-border bg-surface",
                className ?? "",
            ]
                .filter(Boolean)
                .join(" ")}
        >
            <div className="min-w-[20rem]">
                {/* Cabeçalho */}
                <div
                    style={gridCols}
                    className="grid items-end gap-2 border-b border-border px-4 py-3"
                >
                    <div className="text-xs font-medium text-text-secondary">
                        {caption ?? ""}
                    </div>
                    {columns.map((col, i) => (
                        <div
                            key={i}
                            className={[
                                "rounded-t-xl px-2 py-1 text-center text-sm font-semibold",
                                col.highlight
                                    ? "bg-[#fff0eb] text-[color:var(--accent-deep)]"
                                    : "text-text-primary",
                            ].join(" ")}
                        >
                            {col.title}
                        </div>
                    ))}
                </div>

                {/* Linhas */}
                {rows.map((row, ri) => (
                    <div
                        key={ri}
                        style={gridCols}
                        className={[
                            "grid items-center gap-2 px-4 py-2.5",
                            ri % 2 === 1 ? "bg-neutral-50/60" : "",
                        ].join(" ")}
                    >
                        <div className="text-sm text-text-secondary">
                            {row.label}
                        </div>
                        {row.values.map((v, ci) => (
                            <div
                                key={ci}
                                className={[
                                    "flex items-center justify-center py-0.5",
                                    columns[ci]?.highlight
                                        ? "bg-[#fff0eb]/50"
                                        : "",
                                ].join(" ")}
                            >
                                <Cell value={v} />
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
}
