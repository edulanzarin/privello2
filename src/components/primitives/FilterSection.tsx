"use client";

import * as React from "react";

/**
 * Props do {@link FilterSection}.
 *
 * Bloco simples para uma "seção" dentro do {@link FilterPanel}. Tem
 * apenas título uppercase pequeno e conteúdo. Sem domínio nas props
 * (Property 29).
 */
export interface FilterSectionProps {
    /** Título da seção, em texto curto. */
    title: string;
    /** Conteúdo (chips, switches, inputs etc). */
    children: React.ReactNode;
    /** Classes extras aplicadas ao container. */
    className?: string;
}

/**
 * FilterSection — agrupador visual de filtros com título eyebrow.
 *
 * Visual: title em microcopy uppercase letterspaced, body livre. Sem
 * borda nem padding extras — a separação fica por conta do
 * `flex flex-col gap-X` do `FilterPanel`.
 */
export function FilterSection({
    title,
    children,
    className,
}: FilterSectionProps): React.ReactElement {
    const composed = ["flex flex-col gap-2", className ?? ""]
        .filter(Boolean)
        .join(" ");
    return (
        <section className={composed}>
            <h3 className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-text-secondary">
                {title}
            </h3>
            {children}
        </section>
    );
}
