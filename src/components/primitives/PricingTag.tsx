import * as React from "react";

/**
 * Tom visual do {@link PricingTag}.
 *
 * - `"soft"`: fundo `primary-50`/borda `primary-200`. Discreto, mas
 *   com tom warm. Default.
 * - `"primary"`: fundo gradient warm `primary-500/600` + texto
 *   branco. Pricing em destaque forte.
 * - `"outline"`: borda fina + fundo neutro. Variante "informativa"
 *   sem competir com outros CTAs próximos.
 */
export type PricingTagTone = "soft" | "primary" | "outline";

/**
 * Props do {@link PricingTag}.
 *
 * Card centralizado para exibir um valor monetário em destaque
 * (preço por hora, mensalidade, valor de plano). Layout vertical
 * empilhado: label tiny uppercase em cima, valor enorme no meio,
 * sufixo "/período" pequeno ao lado do valor, descrição opcional
 * abaixo.
 *
 * Diferença para {@link import("./StatHighlight").StatHighlight}:
 * `StatHighlight` tem ícone redondo grande à esquerda e layout
 * horizontal (mais "dashboard widget"). `PricingTag` é centralizado
 * e dedicado a preço (mais "menu de preços").
 *
 * Diferença para {@link import("./Badge").Badge}: Badge é uppercase
 * pequeno; PricingTag é hero centralizado com valor display.
 *
 * Nenhuma prop carrega nomes de entidades de domínio (Property 29).
 */
export interface PricingTagProps {
    /** Valor em destaque (texto display). Aceita ReactNode pra
     *  permitir formatação rica (ex.: `R$ <strong>300</strong>,00`). */
    value: React.ReactNode;
    /**
     * Label uppercase pequeno renderizado acima do valor. Opcional.
     */
    label?: React.ReactNode;
    /**
     * Sufixo "/período" pequeno ao lado do valor (ex.: "/hora",
     * "/mês"). Renderizado em escala menor com leve opacidade.
     */
    period?: React.ReactNode;
    /**
     * Texto auxiliar exibido abaixo do valor em pequeno
     * (ex.: "negociável", "à vista").
     */
    description?: React.ReactNode;
    /** Tom visual. Padrão: `"soft"`. */
    tone?: PricingTagTone;
    /** Classes extras aplicadas ao container. */
    className?: string;
}

const TONE_CLASSES: Record<
    PricingTagTone,
    { wrapper: string; value: string; label: string; meta: string }
> = {
    soft: {
        wrapper:
            "bg-gradient-to-b from-primary-50/70 to-surface border border-primary-200",
        value: "text-text-primary",
        label: "text-primary-700",
        meta: "text-text-secondary",
    },
    primary: {
        wrapper:
            "bg-gradient-to-br from-primary-500 to-primary-600 border border-primary-700/30 shadow-sm",
        value: "text-white",
        label: "text-white/80",
        meta: "text-white/85",
    },
    outline: {
        wrapper: "bg-surface border border-neutral-200",
        value: "text-text-primary",
        label: "text-text-secondary",
        meta: "text-text-secondary",
    },
};

/**
 * PricingTag — card centralizado para preço em destaque.
 *
 * Tipografia hierárquica: label uppercase letterspacing largo em
 * cima, valor em `text-4xl` no centro com `tabular-nums` (alinha
 * dígitos), sufixo "/período" em `text-sm` ao lado, descrição
 * opcional abaixo em `text-xs`. Tudo center-aligned.
 *
 * Mobile: padding `py-5`. Desktop (`sm`): padding `py-6`. Sempre
 * full-width — o caller controla a largura via wrapper.
 */
export function PricingTag({
    value,
    label,
    period,
    description,
    tone = "soft",
    className,
}: PricingTagProps): React.ReactElement {
    const t = TONE_CLASSES[tone];
    const composed = [
        "flex flex-col items-center gap-1 rounded-2xl px-4 py-5 text-center sm:py-6",
        t.wrapper,
        className ?? "",
    ]
        .filter(Boolean)
        .join(" ");

    return (
        <div className={composed}>
            {label != null ? (
                <span
                    className={[
                        "text-[0.65rem] font-semibold uppercase tracking-[0.18em]",
                        t.label,
                    ].join(" ")}
                >
                    {label}
                </span>
            ) : null}
            <div className="flex items-baseline justify-center gap-1.5">
                <span
                    className={[
                        "text-4xl font-semibold leading-none tracking-tight tabular-nums sm:text-5xl",
                        t.value,
                    ].join(" ")}
                >
                    {value}
                </span>
                {period != null ? (
                    <span
                        className={[
                            "text-sm font-medium",
                            t.meta,
                        ].join(" ")}
                    >
                        {period}
                    </span>
                ) : null}
            </div>
            {description != null ? (
                <span className={["text-xs", t.meta].join(" ")}>
                    {description}
                </span>
            ) : null}
        </div>
    );
}
