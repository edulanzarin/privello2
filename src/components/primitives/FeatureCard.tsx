import * as React from "react";

/**
 * Tom visual do {@link FeatureCard}.
 *
 * - `"surface"` (padrão): fundo branco com hairline e ícone tonal.
 *   Visual editorial limpo pra atalhos secundários.
 * - `"primary"`: fundo soft `primary-50` com ícone destacado. Use
 *   pra atalhos principais que precisam puxar o olho.
 */
export type FeatureCardTone = "surface" | "primary";

/**
 * Forma do {@link FeatureCard}.
 *
 * - `"row"` (padrão): layout horizontal `[ícone] [título / desc] [seta]`.
 *   Ideal pra listas de atalhos rápidos (mobile-first).
 * - `"tile"`: layout vertical centralizado `[ícone grande] [título]
 *   [desc]`. Ideal pra grid 2/4 colunas com features de produto.
 */
export type FeatureCardShape = "row" | "tile";

/**
 * Props do {@link FeatureCard}.
 *
 * Card-atalho com ícone, título e descrição. Inteiramente clicável
 * via `href` ou `onClick` (mutuamente exclusivos), com hover/focus
 * sutis. Sem efeitos pesados — segue o tema editorial 2026 com
 * hairline e cantos generosos.
 *
 * Substitui o padrão repetido `<a className="rounded-2xl border ...">
 * [icon] [textos] [chevron] </a>` que aparecia em landings,
 * dashboards e listas de "Acesse rápido".
 *
 * Nenhuma prop carrega nomes de entidades de domínio (Property 29).
 */
export interface FeatureCardProps {
    /** URL de destino. Mutuamente exclusivo com `onClick`. */
    href?: string;
    /** Callback ao clicar. Mutuamente exclusivo com `href`. */
    onClick?: () => void;
    /** Ícone tonal exibido à esquerda (row) ou no topo (tile). */
    icon?: React.ReactNode;
    /** Título principal. */
    title: React.ReactNode;
    /** Descrição secundária opcional. */
    description?: React.ReactNode;
    /**
     * Slot opcional renderizado à direita (em `row`) ou abaixo
     * (em `tile`) — tipicamente uma seta ou badge "NOVO".
     */
    trailing?: React.ReactNode;
    /** Tom visual. Padrão: `"surface"`. */
    tone?: FeatureCardTone;
    /** Forma do card. Padrão: `"row"`. */
    shape?: FeatureCardShape;
    /** Classes extras aplicadas ao container. */
    className?: string;
}

const TONE_CLASSES: Record<FeatureCardTone, string> = {
    surface:
        "bg-surface border-border hover:border-primary-300 hover:bg-primary-50/40",
    primary:
        "bg-primary-50/60 border-primary-100 hover:bg-primary-50",
};

const ICON_TONE_CLASSES: Record<FeatureCardTone, string> = {
    surface: "bg-primary-50 text-primary-700",
    primary: "bg-primary-100 text-primary-700",
};

/**
 * FeatureCard — card-atalho clicável com ícone, título e descrição.
 *
 * Quando `href` é fornecido, renderiza como `<a>`. Quando `onClick`
 * é fornecido, renderiza como `<button>`. Quando nenhum dos dois é
 * passado, vira `<div>` puramente decorativo.
 */
export function FeatureCard({
    href,
    onClick,
    icon,
    title,
    description,
    trailing,
    tone = "surface",
    shape = "row",
    className,
}: FeatureCardProps): React.ReactElement {
    const baseInteractive =
        "transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-300";
    const isInteractive = href !== undefined || onClick !== undefined;

    if (shape === "tile") {
        const composed = [
            "flex flex-col items-center gap-3 rounded-3xl border p-5 text-center",
            TONE_CLASSES[tone],
            isInteractive ? baseInteractive : "",
            className ?? "",
        ]
            .filter(Boolean)
            .join(" ");

        const inner = (
            <>
                {icon != null ? (
                    <span
                        aria-hidden="true"
                        className={[
                            "inline-flex h-12 w-12 flex-none items-center justify-center rounded-2xl",
                            ICON_TONE_CLASSES[tone],
                        ].join(" ")}
                    >
                        {icon}
                    </span>
                ) : null}
                <div className="flex flex-col gap-1">
                    <span className="text-sm font-semibold tracking-tight text-text-primary">
                        {title}
                    </span>
                    {description != null ? (
                        <span className="text-xs text-text-secondary">
                            {description}
                        </span>
                    ) : null}
                </div>
                {trailing != null ? (
                    <div className="mt-1">{trailing}</div>
                ) : null}
            </>
        );

        return renderShell({ href, onClick, composed, inner });
    }

    // shape === "row"
    const composed = [
        "flex items-center gap-3 rounded-2xl border px-4 py-3",
        TONE_CLASSES[tone],
        isInteractive ? baseInteractive : "",
        className ?? "",
    ]
        .filter(Boolean)
        .join(" ");

    const inner = (
        <>
            {icon != null ? (
                <span
                    aria-hidden="true"
                    className={[
                        "inline-flex h-9 w-9 flex-none items-center justify-center rounded-full",
                        ICON_TONE_CLASSES[tone],
                    ].join(" ")}
                >
                    {icon}
                </span>
            ) : null}
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-sm font-semibold tracking-tight text-text-primary">
                    {title}
                </span>
                {description != null ? (
                    <span className="text-xs text-text-secondary">
                        {description}
                    </span>
                ) : null}
            </div>
            {trailing != null ? (
                <span aria-hidden="true" className="flex-none text-text-disabled">
                    {trailing}
                </span>
            ) : null}
        </>
    );

    return renderShell({ href, onClick, composed, inner });
}

function renderShell({
    href,
    onClick,
    composed,
    inner,
}: {
    href?: string;
    onClick?: () => void;
    composed: string;
    inner: React.ReactElement;
}): React.ReactElement {
    if (href !== undefined) {
        return (
            <a href={href} className={composed}>
                {inner}
            </a>
        );
    }
    if (onClick !== undefined) {
        return (
            <button
                type="button"
                onClick={onClick}
                className={`${composed} text-left`}
            >
                {inner}
            </button>
        );
    }
    return <div className={composed}>{inner}</div>;
}
