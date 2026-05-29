"use client";

import * as React from "react";

/**
 * Variante visual do {@link Button}.
 *
 * - `"primary"`: ação principal de uma tela.
 * - `"secondary"`: ação secundária complementar à primária.
 * - `"ghost"`: ação discreta, sem preenchimento de fundo.
 * - `"danger"`: ação destrutiva ou irreversível.
 */
export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

/**
 * Tamanho do {@link Button}. Afeta altura, padding horizontal e
 * tamanho da fonte; não altera comportamento ou semântica.
 */
export type ButtonSize = "sm" | "md" | "lg";

/**
 * Direção visual: editorial 2026. Pílulas (`rounded-full`), primary
 * em accent salmão sólido, secondary é card branco com hairline,
 * ghost só revela no hover.
 */
const VARIANT_CLASSES: Record<ButtonVariant, string> = {
    primary:
        "text-white bg-gradient-to-br from-[color:var(--accent)] to-[color:var(--accent-deep)] hover:brightness-105 active:brightness-95 shadow-[0_8px_24px_-8px_rgba(197,82,58,0.55),inset_0_1px_0_rgba(255,255,255,0.4)] focus-visible:ring-[#ec7b5b]/40 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none",
    secondary:
        "text-text-primary bg-surface border border-border hover:border-[#ec7b5b]/30 hover:bg-[#fff0eb]/50 focus-visible:ring-text-primary/20 disabled:opacity-40",
    ghost:
        "text-text-secondary bg-transparent hover:bg-[#fff0eb]/40 hover:text-[color:var(--accent-deep)] focus-visible:ring-[#ec7b5b]/30 disabled:text-text-disabled",
    danger:
        "text-white bg-danger-600 hover:bg-danger-700 focus-visible:ring-danger-500/40 disabled:opacity-40",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
    sm: "h-8 px-4 text-[0.8rem] rounded-full",
    md: "h-10 px-5 text-sm rounded-full",
    lg: "h-12 px-6 text-[0.95rem] rounded-full",
};

/**
 * Props do componente {@link Button}.
 *
 * Estende as props nativas de `<button>` adicionando variante, tamanho e
 * estado de carregamento. Quando `href` é fornecido, o botão renderiza
 * um `<a>` com o mesmo visual — útil para CTAs que navegam para outra
 * rota sem precisar reconstruir o estilo manualmente. Nenhuma prop
 * carrega nomes de entidades de domínio: o componente é genérico e
 * pode ser usado em qualquer página.
 */
export interface ButtonProps
    extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "href"> {
    /** Variante visual. Padrão: `"primary"`. */
    variant?: ButtonVariant;
    /** Tamanho do botão. Padrão: `"md"`. */
    size?: ButtonSize;
    /**
     * Quando `true`, exibe indicador de carregamento, define
     * `aria-busy="true"` e força o estado desabilitado para clique,
     * impedindo submissões duplicadas durante operações assíncronas.
     * Padrão: `false`.
     */
    loading?: boolean;
    /**
     * Quando fornecido, o componente renderiza um `<a href>` em vez de
     * `<button>`, mantendo o mesmo visual. Use para CTAs que navegam
     * para outra rota.
     */
    href?: string;
    /** Conteúdo exibido dentro do botão. */
    children?: React.ReactNode;
}

/**
 * Botão primitivo da Biblioteca_de_Componentes.
 *
 * Semântica de acessibilidade (Property 28):
 * - `loading === true` ⇒ atributo nativo `disabled` aplicado e
 *   `aria-busy="true"` presente no elemento.
 * - `disabled === true` ⇒ atributo nativo `disabled` aplicado.
 *
 * O componente não conhece nenhuma entidade de domínio (Property 29).
 */
export function Button({
    variant = "primary",
    size = "md",
    loading = false,
    disabled = false,
    type = "button",
    href,
    className,
    children,
    ...rest
}: ButtonProps): React.ReactElement {
    const inactive = disabled || loading;
    const base =
        "inline-flex items-center justify-center gap-2 font-medium tracking-tight transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-offset-0 disabled:cursor-not-allowed";
    const composed = [
        base,
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className ?? "",
    ]
        .filter(Boolean)
        .join(" ");

    const inner = (
        <>
            {loading ? (
                <span
                    aria-hidden="true"
                    className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
                />
            ) : null}
            <span className="inline-flex items-center gap-2">{children}</span>
        </>
    );

    // Renderiza como link quando `href` é fornecido. Mantém o mesmo
    // visual; remove props que só fazem sentido em `<button>` (type,
    // form, etc.) para não vazar atributos inválidos no DOM.
    if (href !== undefined && !inactive) {
        return (
            <a href={href} className={composed}>
                {inner}
            </a>
        );
    }

    return (
        <button
            {...rest}
            type={type}
            disabled={inactive}
            aria-busy={loading || undefined}
            className={composed}
        >
            {inner}
        </button>
    );
}
