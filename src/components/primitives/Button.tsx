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
 * Direção visual: Notion-like. Cantos pequenos, fundo sólido, sem
 * gradiente, sombra tênue, hover discreto, animação curta.
 */
const VARIANT_CLASSES: Record<ButtonVariant, string> = {
    primary:
        "text-white bg-primary-600 hover:bg-primary-700 shadow-sm focus-visible:ring-primary-500/40 disabled:bg-primary-300 disabled:shadow-none",
    secondary:
        "text-white bg-secondary-600 hover:bg-secondary-700 shadow-sm focus-visible:ring-secondary-500/40 disabled:bg-secondary-300 disabled:shadow-none",
    ghost:
        "text-text-primary bg-transparent hover:bg-neutral-100 focus-visible:ring-neutral-300 disabled:text-text-disabled",
    danger:
        "text-white bg-danger-600 hover:bg-danger-700 shadow-sm focus-visible:ring-danger-500/40 disabled:bg-danger-300 disabled:shadow-none",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
    sm: "h-8 px-3 text-sm rounded-md",
    md: "h-9 px-4 text-sm rounded-md",
    lg: "h-10 px-5 text-[0.95rem] rounded-md",
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
