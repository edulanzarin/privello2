import * as React from "react";

/**
 * Tom visual do {@link IconButton}.
 *
 * Cada tom traz um par de classes de fundo + texto + hover, pensado
 * para diferentes níveis de hierarquia visual:
 *
 * - `"primary"`: ação positiva em destaque (adicionar, confirmar).
 *   Fundo `primary-600` cheio com texto branco — chama atenção.
 * - `"neutral"`: ação secundária discreta (editar pequeno, copiar).
 *   Fundo `surface` com borda fina, igual ao
 *   {@link import("./LinkButton").LinkButton} mas sem texto.
 * - `"danger"`: ação destrutiva (remover, descartar). Fundo
 *   `surface` com hover em vermelho.
 * - `"ghost"`: sem fundo nem borda. Para uso sobre superfícies
 *   tonais (toolbars de carrossel, overlays).
 */
export type IconButtonTone = "primary" | "neutral" | "danger" | "ghost";

/**
 * Tamanho canônico do {@link IconButton}.
 *
 * - `"sm"` (32px): para cabeçalhos densos e barras compactas.
 * - `"md"` (40px): padrão; CTAs em headers de seção.
 * - `"lg"` (48px): destaque (FAB, ação principal de página).
 */
export type IconButtonSize = "sm" | "md" | "lg";

/**
 * Props do {@link IconButton}.
 *
 * Botão circular puramente icônico, pensado para ações primárias
 * sem texto. Usa `<a>` quando recebe `href` e `<button>` quando
 * recebe `onClick`. O `aria-label` é obrigatório porque o botão
 * não tem texto visível.
 *
 * Nenhuma prop carrega nomes de entidades de domínio (Property 29).
 */
export interface IconButtonProps {
    /** Ícone exibido no centro do botão. */
    icon: React.ReactNode;
    /**
     * Rótulo acessível obrigatório (aria-label + tooltip nativo).
     * O botão não tem texto visível, então este é o único nome
     * que leitores de tela e hover-tooltips usam.
     */
    "aria-label": string;
    /** URL de destino. Mutuamente exclusivo com `onClick`. */
    href?: string;
    /** Callback ao clicar. Mutuamente exclusivo com `href`. */
    onClick?: () => void;
    /** Tom visual. Padrão: `"neutral"`. */
    tone?: IconButtonTone;
    /** Tamanho do botão. Padrão: `"md"`. */
    size?: IconButtonSize;
    /** Quando `true`, desabilita o botão. */
    disabled?: boolean;
    /** Classes extras aplicadas ao container. */
    className?: string;
}

const TONE_CLASSES: Record<IconButtonTone, string> = {
    primary:
        "bg-primary-600 text-white shadow-sm hover:bg-primary-700 focus-visible:ring-primary-500/40",
    neutral:
        "border border-neutral-200 bg-surface text-text-secondary shadow-sm hover:border-primary-300 hover:text-primary-700 focus-visible:ring-primary-500/40",
    danger:
        "border border-neutral-200 bg-surface text-text-secondary shadow-sm hover:border-danger-300 hover:bg-danger-50 hover:text-danger-700 focus-visible:ring-danger-500/40",
    ghost:
        "text-text-secondary hover:bg-neutral-100 hover:text-text-primary focus-visible:ring-primary-500/40",
};

const SIZE_CLASSES: Record<IconButtonSize, string> = {
    sm: "h-8 w-8",
    md: "h-10 w-10",
    lg: "h-12 w-12",
};

/**
 * IconButton — botão circular puramente icônico.
 *
 * Visual: forma circular (`rounded-full`), conteúdo centralizado,
 * tom configurável. Quando `tone="primary"`, vira o "FAB-style"
 * óbvio para ação primária (ex.: adicionar mídia, criar post).
 */
export function IconButton({
    icon,
    "aria-label": ariaLabel,
    href,
    onClick,
    tone = "neutral",
    size = "md",
    disabled = false,
    className,
}: IconButtonProps): React.ReactElement {
    const composed = [
        "inline-flex flex-none items-center justify-center rounded-full transition-colors duration-150 focus:outline-none focus-visible:ring-2 disabled:opacity-60 disabled:cursor-not-allowed",
        TONE_CLASSES[tone],
        SIZE_CLASSES[size],
        className ?? "",
    ]
        .filter(Boolean)
        .join(" ");

    const inner = <span aria-hidden="true">{icon}</span>;

    if (href !== undefined && !disabled) {
        return (
            <a
                href={href}
                aria-label={ariaLabel}
                title={ariaLabel}
                className={composed}
            >
                {inner}
            </a>
        );
    }

    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            aria-label={ariaLabel}
            title={ariaLabel}
            className={composed}
        >
            {inner}
        </button>
    );
}
