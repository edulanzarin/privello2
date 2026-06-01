import * as React from "react";

import { ArrowRightIcon } from "../icons";

/**
 * Tom visual do {@link OptionCard}.
 *
 * Define a cor da pílula tonal do ícone e da borda destacada no
 * hover. Usar tons distintos quando duas opções coexistem na mesma
 * tela (ex.: Cliente vs Acompanhante no `/cadastro`).
 */
export type OptionCardTone = "primary" | "info" | "neutral";

/**
 * Props do {@link OptionCard}.
 *
 * Card vertical clicável com ícone tonal, título, descrição e CTA
 * em linha. Usado em telas de **escolha** ("Como você quer
 * começar?", "Selecione um motivo", "Escolha uma ação"), onde cada
 * opção precisa do seu próprio destaque visual e leva para um fluxo
 * diferente.
 *
 * Diferença para o {@link import("./InfoRow").InfoRow}:
 * - `InfoRow` é uma linha horizontal compacta (campo + valor) usada
 *   em listas densas tipo Settings.
 * - `OptionCard` é um cartão vertical que destaca uma escolha
 *   acionável, com mais respiro entre os elementos.
 *
 * Nenhuma prop carrega nomes de entidades de domínio (Property 29).
 */
export interface OptionCardProps {
    /** URL para onde clicar leva. Para fluxos com action/handler, prefira `onClick`. */
    href?: string;
    /** Callback para clique. Use quando não há rota direta. */
    onClick?: () => void;
    /** Ícone exibido em pílula tonal de 40px à esquerda. */
    icon?: React.ReactNode;
    /** Título principal. */
    title: React.ReactNode;
    /** Descrição auxiliar, geralmente uma frase. */
    description?: React.ReactNode;
    /**
     * Texto do CTA exibido abaixo da descrição com seta. Quando
     * ausente, a seta de avanço aparece sozinha à direita.
     */
    cta?: React.ReactNode;
    /** Tom visual. Padrão: `"primary"`. */
    tone?: OptionCardTone;
    /** Classes extras aplicadas ao container. */
    className?: string;
}

const TONE_CLASSES: Record<
    OptionCardTone,
    { accent: string; ring: string }
> = {
    primary: {
        accent:
            "bg-accent-soft text-accent-deep ring-2 ring-accent/15",
        ring: "hover:border-accent/35 hover:bg-accent-soft/40",
    },
    info: {
        accent: "bg-info-100 text-info-700 ring-2 ring-info-200",
        ring: "hover:border-info-300 hover:bg-info-50/40",
    },
    neutral: {
        accent: "bg-neutral-100 text-neutral-700 ring-2 ring-neutral-200",
        ring: "hover:border-neutral-300 hover:bg-neutral-50",
    },
};

/**
 * OptionCard — card vertical clicável de escolha.
 *
 * Visual: borda neutra fina, ícone em pílula tonal de 40px, título e
 * descrição com hierarquia clara, CTA com seta animada no hover. Em
 * mobile mantém boa área de toque (padding 16px).
 */
export function OptionCard({
    href,
    onClick,
    icon,
    title,
    description,
    cta,
    tone = "primary",
    className,
}: OptionCardProps): React.ReactElement {
    const tones = TONE_CLASSES[tone];
    const composed = [
        "group flex items-start gap-3 rounded-3xl border border-border bg-surface p-4 text-left transition-all duration-200 lift focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
        tones.ring,
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
                        "inline-flex h-10 w-10 flex-none items-center justify-center rounded-md",
                        tones.accent,
                    ].join(" ")}
                >
                    {icon}
                </span>
            ) : null}
            <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="text-sm font-semibold tracking-tight text-text-primary">
                    {title}
                </span>
                {description != null ? (
                    <span className="text-xs leading-relaxed text-text-secondary">
                        {description}
                    </span>
                ) : null}
                {cta != null ? (
                    <span className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-text-primary">
                        {cta}
                        <ArrowRightIcon
                            size={12}
                            className="text-text-disabled transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-text-secondary"
                        />
                    </span>
                ) : null}
            </div>
            {cta == null ? (
                <span
                    aria-hidden="true"
                    className="flex-none self-center text-text-disabled transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-text-secondary"
                >
                    <ArrowRightIcon size={14} />
                </span>
            ) : null}
        </>
    );

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
                className={`${composed} w-full`}
            >
                {inner}
            </button>
        );
    }

    return <div className={composed}>{inner}</div>;
}
