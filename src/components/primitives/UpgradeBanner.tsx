import * as React from "react";

/**
 * Props do {@link UpgradeBanner}.
 *
 * Banner horizontal compacto de upgrade/CTA. Usado quando uma página
 * exibe um misto de seções liberadas e bloqueadas: em vez de poluir
 * cada seção com um botão "Virar tier X", colocamos um único banner
 * acima do conteúdo principal.
 *
 * Nenhuma prop carrega nomes de entidades de domínio (Property 29).
 */
export interface UpgradeBannerProps {
    /** Ícone tonal exibido à esquerda. Opcional. */
    icon?: React.ReactNode;
    /** Título do banner. */
    title: React.ReactNode;
    /** Descrição auxiliar abaixo do título. Opcional. */
    description?: React.ReactNode;
    /** URL de destino do CTA principal. */
    ctaHref: string;
    /** Texto do CTA principal. */
    ctaLabel: React.ReactNode;
    /** Classes extras aplicadas ao container. */
    className?: string;
}

/**
 * UpgradeBanner — chamada de upgrade compacta e horizontal.
 *
 * Visual: card sólido com fundo `primary-50` translúcido, borda
 * `primary-200`, ícone em pill e CTA sólido `primary-600`. Cabe em
 * uma linha em desktop; em mobile vira coluna preservando a
 * hierarquia.
 */
export function UpgradeBanner({
    icon,
    title,
    description,
    ctaHref,
    ctaLabel,
    className,
}: UpgradeBannerProps): React.ReactElement {
    const composed = [
        "flex flex-col items-stretch gap-3 rounded-3xl border border-[color:var(--accent)]/25 bg-gradient-to-br from-[color:var(--accent-soft)]/80 to-surface p-4 sm:flex-row sm:items-center sm:gap-4 sm:p-4",
        className ?? "",
    ]
        .filter(Boolean)
        .join(" ");

    return (
        <div className={composed}>
            <div className="flex flex-1 items-center gap-3">
                {icon != null ? (
                    <span
                        aria-hidden="true"
                        className="inline-flex h-11 w-11 flex-none items-center justify-center rounded-full bg-[color:var(--accent-soft)] text-[color:var(--accent-deep)] ring-4 ring-[color:var(--accent)]/15"
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
            </div>
            <a
                href={ctaHref}
                className="glass-cta inline-flex flex-none items-center justify-center px-4 py-2 text-xs font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/40"
            >
                {ctaLabel}
            </a>
        </div>
    );
}
