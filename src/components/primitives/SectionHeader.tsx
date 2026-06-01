import * as React from "react";

/**
 * Props do {@link SectionHeader}.
 *
 * Cabeçalho compacto para seções de painel, abas e listagens. Reúne
 * ícone tonal, título e subtítulo num linha, com slot opcional à
 * direita (`trailing`) para badges, contadores ou ações pequenas.
 *
 * Substitui o padrão repetido de div+span+span que aparecia em
 * `AtividadeTab` e similares — agora qualquer página da plataforma
 * pode reusar o mesmo cabeçalho com um único import.
 *
 * Nenhuma prop carrega nomes de entidades de domínio (Property 29).
 */
export interface SectionHeaderProps {
    /** Ícone tonal exibido em círculo à esquerda. Opcional. */
    icon?: React.ReactNode;
    /** Título principal. */
    title: React.ReactNode;
    /** Subtítulo descritivo abaixo do título. Opcional. */
    subtitle?: React.ReactNode;
    /**
     * Slot exibido à direita (badge, contador, link de ação).
     * Quando ausente, o cabeçalho fica alinhado à esquerda.
     */
    trailing?: React.ReactNode;
    /**
     * Tom visual. `"neutral"` (padrão) usa pill primário; `"muted"`
     * usa pill neutro — útil quando a seção representa um recurso
     * bloqueado ou inativo.
     */
    tone?: "neutral" | "muted";
    /** Classes extras aplicadas ao container. */
    className?: string;
}

const ICON_TONE_CLASSES: Record<
    NonNullable<SectionHeaderProps["tone"]>,
    string
> = {
    neutral:
        "bg-accent-soft text-accent-deep",
    muted: "bg-neutral-100 text-text-disabled",
};

/**
 * SectionHeader — cabeçalho compacto e reutilizável.
 *
 * Layout: `[ícone] [título / subtítulo] [trailing]`. Em mobile
 * mantém a mesma linha porque o ícone ocupa um quadrado fixo de
 * 36px e os textos truncam naturalmente.
 */
export function SectionHeader({
    icon,
    title,
    subtitle,
    trailing,
    tone = "neutral",
    className,
}: SectionHeaderProps): React.ReactElement {
    const composed = [
        "flex items-start gap-3",
        className ?? "",
    ]
        .filter(Boolean)
        .join(" ");

    return (
        <div className={composed}>
            {icon != null ? (
                <span
                    aria-hidden="true"
                    className={[
                        "inline-flex h-10 w-10 flex-none items-center justify-center rounded-full ring-4 ring-accent/15",
                        ICON_TONE_CLASSES[tone],
                    ].join(" ")}
                >
                    {icon}
                </span>
            ) : null}
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-base font-semibold tracking-tight text-text-primary">
                    {title}
                </span>
                {subtitle != null ? (
                    <span className="text-xs leading-relaxed text-text-secondary">
                        {subtitle}
                    </span>
                ) : null}
            </div>
            {trailing != null ? (
                <div className="flex flex-none items-center">{trailing}</div>
            ) : null}
        </div>
    );
}
