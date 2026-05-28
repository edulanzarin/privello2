import * as React from "react";

/**
 * Props do {@link MetricPill}.
 *
 * Pill horizontal compacto que exibe um indicador numérico em linha
 * (`ícone · valor · rótulo`). Pensado para painéis e cabeçalhos onde
 * o {@link import("./StatTile").StatTile} tradicional ocuparia
 * espaço demais. Vários `MetricPill` podem ser dispostos lado a lado
 * com `flex flex-wrap gap-2` no container.
 *
 * Diferença para `StatTile`:
 * - `StatTile` empilha rótulo / valor grande / delta verticalmente e
 *   serve para dashboards com KPIs em destaque.
 * - `MetricPill` mantém tudo em uma linha curta — bom para header
 *   de perfil, sumário inline, "linha de stats" sob o avatar.
 *
 * Nenhuma prop carrega nomes de entidades de domínio (Property 29).
 */
export interface MetricPillProps {
    /** Ícone tonal exibido à esquerda. Opcional. */
    icon?: React.ReactNode;
    /**
     * Valor principal em destaque (numérico ou string formatada).
     * Use `"—"` para indicar "ainda sem dados".
     */
    value: React.ReactNode;
    /** Rótulo curto descrevendo o valor. */
    label: React.ReactNode;
    /**
     * Tom do pill:
     * - `"neutral"` (padrão): fundo branco, borda neutra.
     * - `"primary"`: fundo `primary-50`, borda `primary-200`. Usado para
     *   destacar a métrica principal de uma linha.
     */
    tone?: "neutral" | "primary";
    /** Classes extras aplicadas ao container. */
    className?: string;
}

const TONE_CLASSES: Record<NonNullable<MetricPillProps["tone"]>, string> = {
    neutral: "border-border bg-surface",
    primary:
        "border-[color:var(--accent)]/30 bg-[color:var(--accent-soft)]",
};

const ICON_TONE_CLASSES: Record<
    NonNullable<MetricPillProps["tone"]>,
    string
> = {
    neutral:
        "bg-[color:var(--accent-soft)] text-[color:var(--accent-deep)]",
    primary: "bg-surface text-[color:var(--accent-deep)]",
};

/**
 * MetricPill — métrica compacta em linha.
 *
 * Visual: pill arredondado com sombra fina, ícone em círculo tonal,
 * valor em peso semibold e rótulo em texto secundário menor.
 */
export function MetricPill({
    icon,
    value,
    label,
    tone = "neutral",
    className,
}: MetricPillProps): React.ReactElement {
    const composed = [
        "flex items-center gap-1.5 rounded-full border px-3 py-1.5 min-w-0",
        TONE_CLASSES[tone],
        className ?? "",
    ]
        .filter(Boolean)
        .join(" ");

    return (
        <div className={composed}>
            {icon != null ? (
                <span
                    aria-hidden="true"
                    className={[
                        "inline-flex h-5 w-5 flex-none items-center justify-center rounded-full",
                        ICON_TONE_CLASSES[tone],
                    ].join(" ")}
                >
                    {icon}
                </span>
            ) : null}
            <span className="flex-none text-sm font-semibold tracking-tight text-text-primary">
                {value}
            </span>
            <span className="min-w-0 truncate text-xs text-text-secondary">
                {label}
            </span>
        </div>
    );
}
