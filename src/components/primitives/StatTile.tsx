import * as React from "react";

/**
 * Props do {@link StatTile}.
 *
 * Card compacto exibindo um indicador numérico com rótulo e tendência
 * opcional. Pensado para painéis (dashboard) onde múltiplos `StatTile`
 * compõem um grid horizontal/vertical de KPIs. Nenhuma prop carrega
 * nomes de entidades de domínio (Property 29).
 */
export interface StatTileProps {
    /** Rótulo curto descrevendo o que o número representa. */
    label: React.ReactNode;
    /**
     * Valor principal exibido em destaque. Aceita `number` ou `string`
     * para permitir formatação customizada (ex.: `"R$ 1.200"`,
     * `"—"` para indicar "ainda sem dados").
     */
    value: React.ReactNode;
    /**
     * Texto auxiliar exibido abaixo do valor (ex.: "+12% vs. semana
     * passada"). Quando ausente, é omitido.
     */
    delta?: React.ReactNode;
    /**
     * Tom do `delta`: positivo (verde), neutro (cinza) ou negativo
     * (vermelho). Padrão: `"neutral"`.
     */
    deltaTone?: "positive" | "neutral" | "negative";
    /** Ícone exibido em pílula tonal no canto superior. Opcional. */
    icon?: React.ReactNode;
    /** Classes extras aplicadas ao container. */
    className?: string;
}

const DELTA_CLASSES: Record<NonNullable<StatTileProps["deltaTone"]>, string> = {
    positive: "text-success-700",
    neutral: "text-text-secondary",
    negative: "text-danger-700",
};

/**
 * StatTile — número grande + rótulo + delta opcional.
 *
 * Visual: card branco com borda neutra fina e cantos discretos, igual
 * ao {@link import("./Card").Card} default — para que múltiplos tiles
 * combinem com cards/`AuthCard` na mesma página sem dissonância
 * visual.
 */
export function StatTile({
    label,
    value,
    delta,
    deltaTone = "neutral",
    icon,
    className,
}: StatTileProps): React.ReactElement {
    const composed = [
        "flex flex-col gap-2 rounded-3xl border border-neutral-200 bg-surface p-5",
        className ?? "",
    ]
        .filter(Boolean)
        .join(" ");

    return (
        <div className={composed}>
            <div className="flex items-center justify-between gap-2">
                <span className="text-[0.7rem] font-medium uppercase tracking-wider text-text-secondary">
                    {label}
                </span>
                {icon != null ? (
                    <span
                        aria-hidden="true"
                        className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-accent-soft text-accent-deep"
                    >
                        {icon}
                    </span>
                ) : null}
            </div>
            <span className="text-2xl font-semibold tracking-tight text-text-primary">
                {value}
            </span>
            {delta != null ? (
                <span className={`text-xs ${DELTA_CLASSES[deltaTone]}`}>
                    {delta}
                </span>
            ) : null}
        </div>
    );
}
