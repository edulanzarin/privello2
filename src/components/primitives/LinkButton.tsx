import * as React from "react";

/**
 * Tom visual do {@link LinkButton}.
 *
 * - `"neutral"` (padrão): borda neutra, hover suave em primary.
 *   Para ações secundárias gerais ("Editar", "Ver como cliente").
 * - `"danger"`: hover em danger. Para ações destrutivas reversíveis
 *   (sair, descartar rascunho).
 */
export type LinkButtonTone = "neutral" | "danger";

/**
 * Props do {@link LinkButton}.
 *
 * Botão pequeno em formato de link com borda fina, ícone à esquerda
 * e texto compacto. Pensado para ações inline em headers de seção,
 * trailings de cabeçalhos e barras de ação secundária.
 *
 * Substitui o padrão repetido de `inline-flex items-center gap-1.5
 * rounded-md border border-neutral-200 bg-surface px-3 py-2 text-xs
 * font-medium ...` que aparecia em "Ver como cliente", "Editar" da
 * Descrição, e variantes do LogoutButton.
 *
 * Usa `<a>` quando recebe `href` e `<button>` quando recebe `onClick`.
 *
 * Nenhuma prop carrega nomes de entidades de domínio (Property 29).
 */
export interface LinkButtonProps {
    /** URL de destino. Mutuamente exclusivo com `onClick`. */
    href?: string;
    /** Callback ao clicar. Mutuamente exclusivo com `href`. */
    onClick?: () => void;
    /** Ícone exibido à esquerda do label. Opcional. */
    icon?: React.ReactNode;
    /**
     * Ícone exibido à direita do label (geralmente uma seta).
     * Opcional.
     */
    trailingIcon?: React.ReactNode;
    /** Tom visual. Padrão: `"neutral"`. */
    tone?: LinkButtonTone;
    /** Conteúdo textual do botão. */
    children: React.ReactNode;
    /**
     * Quando `true`, o texto fica oculto em telas estreitas
     * (mobile) e visível a partir de `sm:`. O ícone permanece
     * sempre visível, então o botão vira quadradinho-só-de-ícone em
     * mobile. Requer `icon` e `aria-label` para acessibilidade.
     */
    collapseToIcon?: boolean;
    /**
     * Rótulo acessível usado quando o texto está oculto via
     * `collapseToIcon` (ou quando o botão é puramente icônico).
     */
    "aria-label"?: string;
    /** Classes extras aplicadas ao container. */
    className?: string;
    /** Quando `true`, desabilita o botão. */
    disabled?: boolean;
}

const TONE_CLASSES: Record<LinkButtonTone, string> = {
    neutral:
        "border-border bg-surface text-text-secondary hover:border-[#ec7b5b]/35 hover:text-[color:var(--accent-deep)] focus-visible:ring-[#ec7b5b]/40",
    danger:
        "border-border bg-surface text-text-secondary hover:border-danger-300 hover:bg-danger-50 hover:text-danger-700 focus-visible:ring-danger-500/40",
};

/**
 * LinkButton — botão pequeno em formato de link, com borda fina.
 *
 * Visual: padding compacto (`px-2.5 py-1.5`), tipografia em `text-xs`
 * com peso medium, sombra fina, foco visível com ring tonal. Ícones
 * à esquerda e/ou à direita opcionais.
 */
export function LinkButton({
    href,
    onClick,
    icon,
    trailingIcon,
    tone = "neutral",
    children,
    collapseToIcon = false,
    "aria-label": ariaLabel,
    className,
    disabled = false,
}: LinkButtonProps): React.ReactElement {
    const composed = [
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium tracking-tight transition-all duration-150 focus:outline-none focus-visible:ring-2 disabled:opacity-60 disabled:cursor-not-allowed",
        TONE_CLASSES[tone],
        className ?? "",
    ]
        .filter(Boolean)
        .join(" ");

    const inner = (
        <>
            {icon != null ? (
                <span aria-hidden="true" className="flex-none">
                    {icon}
                </span>
            ) : null}
            <span className={collapseToIcon ? "hidden sm:inline" : undefined}>
                {children}
            </span>
            {trailingIcon != null ? (
                <span
                    aria-hidden="true"
                    className={[
                        "flex-none",
                        collapseToIcon ? "hidden sm:inline-flex" : "",
                    ]
                        .filter(Boolean)
                        .join(" ")}
                >
                    {trailingIcon}
                </span>
            ) : null}
        </>
    );

    if (href !== undefined && !disabled) {
        return (
            <a href={href} aria-label={ariaLabel} className={composed}>
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
            className={composed}
        >
            {inner}
        </button>
    );
}
