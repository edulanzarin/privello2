import * as React from "react";

/**
 * Tom visual do {@link Badge}.
 *
 * - `"primary"`: pill `primary-100` com texto `primary-700`. Indica
 *   destaque/positivo (plano premium, recurso ativo).
 * - `"neutral"`: pill `neutral-100` com texto secundário. Indica
 *   estado calmo/baseline (plano gratuito, item arquivado).
 * - `"primaryGradient"`: gradiente `primary-400 → primary-600` com
 *   texto branco e sombra. Para destaques fortes em cards de oferta
 *   ("Recomendado", "Mais popular"); evite em layouts densos.
 *
 * Nenhuma prop carrega nomes de entidades de domínio (Property 29).
 */
export type BadgeTone = "primary" | "neutral" | "primaryGradient";

/**
 * Props do {@link Badge}.
 *
 * Pill curto em uppercase com letterspacing fino — o "selo" usado
 * para etiquetar planos, status, recursos. Substitui o trecho
 * `inline-flex items-center gap-1 rounded-full px-2.5 py-0.5
 * text-[0.7rem] font-semibold uppercase tracking-wider` que estava
 * espalhado pelas páginas.
 */
export interface BadgeProps
    extends Omit<React.HTMLAttributes<HTMLSpanElement>, "children"> {
    /** Tom visual. Padrão: `"primary"`. */
    tone?: BadgeTone;
    /** Ícone opcional exibido à esquerda do label. */
    icon?: React.ReactNode;
    /** Conteúdo do badge. */
    children: React.ReactNode;
}

const TONE_CLASSES: Record<BadgeTone, string> = {
    primary:
        "bg-[color:var(--accent-soft)] text-[color:var(--accent-deep)] ring-1 ring-[color:var(--accent)]/20",
    neutral: "bg-surface-muted text-text-secondary border border-border",
    primaryGradient:
        "bg-gradient-to-br from-[color:var(--accent)] to-[color:var(--accent-deep)] text-white shadow-[0_4px_12px_-4px_rgba(197,82,58,0.55)]",
};

/**
 * Badge — selo curto em pílula com tom configurável.
 *
 * Visual: tipografia uppercase compacta, padding mínimo. O conjunto
 * `text-[0.7rem]` + `tracking-wider` + `font-semibold` é a "voz
 * tipográfica" dos selos da plataforma. Um único componente garante
 * que toda nova badge nasça com a mesma linguagem.
 */
export function Badge({
    tone = "primary",
    icon,
    className,
    children,
    ...rest
}: BadgeProps): React.ReactElement {
    const composed = [
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[0.7rem] font-semibold uppercase tracking-wider",
        TONE_CLASSES[tone],
        className ?? "",
    ]
        .filter(Boolean)
        .join(" ");

    return (
        <span {...rest} className={composed}>
            {icon != null ? (
                <span aria-hidden="true" className="flex-none">
                    {icon}
                </span>
            ) : null}
            {children}
        </span>
    );
}
