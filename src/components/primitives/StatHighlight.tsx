import * as React from "react";

/**
 * Tom visual do {@link StatHighlight}. Espelha as decisões cromáticas
 * do {@link import("./Badge").Badge}: `"primary"` (gradiente warm),
 * `"neutral"` (sutil, fundo claro) ou `"accent"` (cor de destaque
 * single para indicar valor positivo).
 */
export type StatHighlightTone = "primary" | "neutral" | "accent";

/**
 * Props do {@link StatHighlight}.
 *
 * Card grande de "valor em destaque" — usado para chamar atenção a um
 * número/valor singular no perfil público (ex.: valor da hora) ou em
 * dashboards. Ícone à esquerda em círculo, valor grande no centro,
 * label pequeno abaixo. Quando `hint` é passado, aparece como linha
 * extra discreta (ex.: "negociável", "a combinar").
 *
 * Diferença para {@link import("./MetricPill").MetricPill}: este
 * componente é "hero" — alto, com gradiente, valor grande e mais
 * presença visual. MetricPill é compacto e usado em linhas de stats.
 *
 * Nenhuma prop carrega nomes de entidades de domínio (Property 29).
 */
export interface StatHighlightProps {
    /** Ícone exibido em círculo à esquerda. */
    icon: React.ReactNode;
    /** Valor em destaque (texto grande). Pode ser número ou string. */
    value: React.ReactNode;
    /** Rótulo curto descritivo abaixo do valor. */
    label: React.ReactNode;
    /** Texto auxiliar opcional (ex.: "negociável"). */
    hint?: React.ReactNode;
    /** Tom visual. Padrão: `"primary"`. */
    tone?: StatHighlightTone;
    /** Classes extras aplicadas ao container. */
    className?: string;
}

const TONE_CLASSES: Record<StatHighlightTone, { wrapper: string; icon: string }> = {
    primary: {
        wrapper:
            "bg-gradient-to-br from-primary-50 via-surface to-primary-100/60 border-primary-200",
        icon:
            "bg-gradient-to-br from-primary-400 to-primary-600 text-white shadow-sm",
    },
    accent: {
        wrapper: "bg-surface border-primary-300",
        icon: "bg-primary-100 text-primary-700",
    },
    neutral: {
        wrapper: "bg-neutral-50 border-neutral-200",
        icon: "bg-neutral-200 text-text-secondary",
    },
};

/**
 * StatHighlight — card "hero" para um valor em destaque.
 *
 * Layout horizontal: círculo de ícone com gradient + bloco de texto
 * com `value` em escala maior (`text-2xl`) e `label` em uppercase
 * sutil. Quando `hint` é passado, vira terceira linha abaixo do
 * label.
 *
 * Bordas e fundo tonais discretos para que o card destaque sem
 * brigar com o restante do layout. Em mobile, o ícone reduz para
 * `w-12 h-12`; em ≥sm, `w-14 h-14`.
 */
export function StatHighlight({
    icon,
    value,
    label,
    hint,
    tone = "primary",
    className,
}: StatHighlightProps): React.ReactElement {
    const t = TONE_CLASSES[tone];
    const composed = [
        "flex items-center gap-3 rounded-xl border p-3 sm:gap-4 sm:p-4",
        t.wrapper,
        className ?? "",
    ]
        .filter(Boolean)
        .join(" ");

    return (
        <div className={composed}>
            <div
                aria-hidden="true"
                className={[
                    "flex h-12 w-12 flex-none items-center justify-center rounded-full sm:h-14 sm:w-14",
                    t.icon,
                ].join(" ")}
            >
                {icon}
            </div>
            <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-2xl font-semibold tracking-tight text-text-primary sm:text-3xl">
                    {value}
                </span>
                <span className="text-[0.65rem] font-medium uppercase tracking-wider text-text-secondary">
                    {label}
                </span>
                {hint != null ? (
                    <span className="text-[0.7rem] text-text-disabled">
                        {hint}
                    </span>
                ) : null}
            </div>
        </div>
    );
}
