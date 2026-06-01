import * as React from "react";

/**
 * Tom visual do {@link TagChip}.
 *
 * - `"soft"`: fundo `primary-50` com texto `primary-700`. Tag de
 *   destaque suave — característica positiva, atributo selecionado.
 * - `"neutral"`: fundo cinza claro com texto secundário. Tag
 *   informativa neutra.
 * - `"outline"`: borda fina + fundo do surface. Variação mais leve
 *   pra contextos densos onde fundo colorido seria muito.
 * - `"primary"`: fundo `primary-600` com texto branco. Tag em
 *   destaque forte — destaque/promoção/CTA.
 */
export type TagChipTone = "soft" | "neutral" | "outline" | "primary";

/** Tamanho do {@link TagChip}. */
export type TagChipSize = "sm" | "md";

/**
 * Props do {@link TagChip}.
 *
 * Pílula visualmente leve para listas de atributos, características
 * e tags. Diferente do {@link import("./Badge").Badge} (uppercase,
 * "selo") e do `<button role="checkbox">` do
 * {@link import("./ChipGroup").ChipGroup} (interativo): o `TagChip`
 * é estritamente decorativo, em case normal, com tons mais quentes.
 *
 * Nenhuma prop carrega nomes de entidades de domínio (Property 29).
 */
export interface TagChipProps {
    /** Tom visual. Padrão: `"soft"`. */
    tone?: TagChipTone;
    /** Tamanho. Padrão: `"md"`. */
    size?: TagChipSize;
    /** Ícone opcional exibido à esquerda do texto. */
    icon?: React.ReactNode;
    /**
     * Prefixo curto exibido em destaque antes do texto. Útil pra
     * marcar visualmente uma "categoria" sem precisar de ícone
     * (ex.: `"#"`, `"@"`).
     */
    prefix?: React.ReactNode;
    /** Conteúdo do chip. */
    children: React.ReactNode;
    /** Classes extras aplicadas ao container. */
    className?: string;
}

const TONE_CLASSES: Record<TagChipTone, string> = {
    soft:
        "bg-accent-soft text-accent-deep ring-1 ring-accent/15",
    neutral: "bg-surface-muted text-text-secondary border border-border",
    outline: "border border-border bg-transparent text-text-primary",
    primary:
        "bg-gradient-to-br from-accent to-accent-deep text-white shadow-[0_4px_12px_-4px_rgba(197,82,58,0.4)]",
};

const SIZE_CLASSES: Record<TagChipSize, string> = {
    sm: "px-2.5 py-0.5 text-xs gap-1",
    md: "px-3 py-1 text-xs gap-1.5",
};

/**
 * TagChip — pílula decorativa de atributo/característica.
 *
 * Visual: cantos totalmente arredondados (`rounded-full`), peso
 * `font-medium`, espaçamento confortável entre ícone, prefixo e
 * texto. Sem case forçado — o caller decide.
 */
export function TagChip({
    tone = "soft",
    size = "md",
    icon,
    prefix,
    children,
    className,
}: TagChipProps): React.ReactElement {
    const composed = [
        "inline-flex items-center rounded-full font-medium",
        TONE_CLASSES[tone],
        SIZE_CLASSES[size],
        className ?? "",
    ]
        .filter(Boolean)
        .join(" ");

    return (
        <span className={composed}>
            {icon != null ? (
                <span aria-hidden="true" className="inline-flex flex-none">
                    {icon}
                </span>
            ) : null}
            {prefix != null ? (
                <span aria-hidden="true" className="opacity-60">
                    {prefix}
                </span>
            ) : null}
            {children}
        </span>
    );
}
