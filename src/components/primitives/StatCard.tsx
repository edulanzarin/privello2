import * as React from "react";

/**
 * Tom visual do header do {@link StatCard}.
 *
 * - `"primary"`: ícone em pílula `primary-100/700`. Default.
 * - `"neutral"`: ícone em pílula neutra. Para cards "informativos"
 *   sem destaque tonal.
 */
export type StatCardTone = "primary" | "neutral";

/**
 * Props do {@link StatCard}.
 *
 * Card compacto com header (ícone tonal pequeno + label) e área de
 * conteúdo livre. Pensado para "fichas" de informação que aparecem
 * lado a lado em duas colunas no desktop e empilhadas no mobile
 * (ex.: "Valores" + "Localização" + "Avaliações").
 *
 * Diferença para {@link import("./SectionHeader").SectionHeader}:
 * SectionHeader é título de seção da página inteira; StatCard é uma
 * unidade de informação fechada com header próprio menor.
 *
 * Diferença para {@link import("./Card").Card} sozinho: StatCard já
 * carrega a estrutura do header com ícone + label uppercase, sem o
 * caller ter que repetir o markup.
 *
 * Nenhuma prop carrega nomes de entidades de domínio (Property 29).
 */
export interface StatCardProps {
    /** Ícone exibido em pílula tonal no canto superior esquerdo. */
    icon: React.ReactNode;
    /** Label do header em uppercase tracking-wider. */
    label: React.ReactNode;
    /**
     * Slot opcional exibido à direita do label (chevron, badge,
     * link "Ver todas"). Não tem comportamento próprio — é só um
     * slot de layout.
     */
    trailing?: React.ReactNode;
    /** Tom visual do ícone. Padrão: `"primary"`. */
    tone?: StatCardTone;
    /** Conteúdo do card. Pode ser qualquer composição. */
    children: React.ReactNode;
    /** Classes extras aplicadas ao container. */
    className?: string;
}

const TONE_CLASSES: Record<StatCardTone, string> = {
    primary:
        "bg-[color:var(--accent-soft)] text-[color:var(--accent-deep)] ring-2 ring-[#ec7b5b]/15",
    neutral: "bg-neutral-100 text-text-secondary",
};

/**
 * StatCard — card de "ficha" com header tonal e conteúdo livre.
 *
 * Layout: header `flex items-center gap-2` (ícone 28×28 + label
 * uppercase) + linha divisória fina + área de conteúdo com padding
 * confortável. Borda neutra fina, fundo `surface`, cantos `rounded-xl`.
 * Mobile-first sempre.
 */
export function StatCard({
    icon,
    label,
    trailing,
    tone = "primary",
    children,
    className,
}: StatCardProps): React.ReactElement {
    const composed = [
        "flex flex-col rounded-3xl border border-border bg-surface transition-shadow duration-200 hover:shadow-[0_18px_36px_-22px_rgba(26,20,16,0.18)]",
        className ?? "",
    ]
        .filter(Boolean)
        .join(" ");

    return (
        <div className={composed}>
            <div className="flex items-center justify-between gap-2 border-b border-[color:var(--hairline)] px-4 py-3">
                <div className="flex min-w-0 items-center gap-2">
                    <span
                        aria-hidden="true"
                        className={[
                            "inline-flex h-7 w-7 flex-none items-center justify-center rounded-full",
                            TONE_CLASSES[tone],
                        ].join(" ")}
                    >
                        {icon}
                    </span>
                    <span className="truncate text-[0.7rem] font-semibold uppercase tracking-wider text-text-secondary">
                        {label}
                    </span>
                </div>
                {trailing != null ? (
                    <div className="flex flex-none items-center text-text-secondary">
                        {trailing}
                    </div>
                ) : null}
            </div>
            <div className="flex flex-1 flex-col px-4 py-3">{children}</div>
        </div>
    );
}
