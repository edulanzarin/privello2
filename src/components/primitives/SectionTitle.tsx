import * as React from "react";

/**
 * Props do {@link SectionTitle}.
 *
 * Cabeçalho **grande** de seção, voltado pra landing/marketing —
 * tipografia pesada, tracking apertado, opcional chip pequeno ao
 * lado pra contextualizar a seção (ex.: "Boost ativo", "Da
 * semana"). Diferente do {@link SectionHeader}, que é um cabeçalho
 * compacto com ícone redondo pra painéis e listas internas.
 *
 * Nenhuma prop carrega nomes de entidades de domínio (Property 29).
 */
export interface SectionTitleProps {
    /** Título principal. */
    title: React.ReactNode;
    /** Subtítulo opcional renderizado abaixo. */
    subtitle?: React.ReactNode;
    /**
     * Chip/pill exibido ao lado do título (em mobile fica embaixo).
     * Pode receber ícone via composição.
     */
    chip?: React.ReactNode;
    /**
     * Slot trailing — tipicamente um link "Ver todos →".
     */
    trailing?: React.ReactNode;
    /** Classes extras aplicadas ao container. */
    className?: string;
}

/**
 * SectionTitle — headline pesada pra seções de página.
 *
 * Visual: `text-3xl sm:text-4xl` em `font-bold`, tracking
 * `-0.02em`, com opcional chip à direita do título (uppercase
 * pequeno, fundo `primary-50`). Em mobile o chip vai pra linha
 * abaixo do título pra preservar largura útil.
 */
export function SectionTitle({
    title,
    subtitle,
    chip,
    trailing,
    className,
}: SectionTitleProps): React.ReactElement {
    return (
        <div
            className={[
                "flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4",
                className ?? "",
            ]
                .filter(Boolean)
                .join(" ")}
        >
            <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-baseline gap-3">
                    <h2 className="text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">
                        {title}
                    </h2>
                    {chip != null ? <div>{chip}</div> : null}
                </div>
                {subtitle != null ? (
                    <p className="max-w-2xl text-sm text-text-secondary sm:text-base">
                        {subtitle}
                    </p>
                ) : null}
            </div>
            {trailing != null ? (
                <div className="flex-none">{trailing}</div>
            ) : null}
        </div>
    );
}
