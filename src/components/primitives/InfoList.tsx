"use client";

import * as React from "react";

import { Card } from "./Card";

/**
 * Props do {@link InfoList}.
 *
 * Lista densa de {@link import("./InfoRow").InfoRow}s dentro de um
 * {@link Card} sem padding interno e separadas por divisor fino.
 * Substitui o padrão repetido nos painéis (Cliente e Acompanhante):
 *
 * ```tsx
 * <Card padding="none">
 *   <ul className="divide-y divide-neutral-200/70">
 *     <li><InfoRow ... /></li>
 *     <li><InfoRow ... /></li>
 *   </ul>
 * </Card>
 * ```
 *
 * Com este primitivo o consumidor passa as InfoRows como filhos
 * diretos e o `<Card>` + `<ul>` + `<li>` saem implícitos.
 *
 * Nenhuma prop carrega nomes de entidades de domínio (Property 29).
 */
export interface InfoListProps {
    /** InfoRows a serem listadas, em ordem de exibição. */
    children: React.ReactNode;
    /** Classes extras aplicadas ao Card. */
    className?: string;
}

/**
 * InfoList — Card sem padding com lista de InfoRows separadas por
 * divisor. Cada filho é wrappado em `<li>` automaticamente para
 * manter semântica de lista enquanto o consumidor escreve apenas
 * `<InfoRow>` direto.
 */
export function InfoList({
    children,
    className,
}: InfoListProps): React.ReactElement {
    // `React.Children.toArray` filtra `null`/`false`/`undefined`
    // automaticamente — útil quando o consumidor renderiza linhas
    // condicionalmente com `{showFoo && <InfoRow ... />}`.
    const rows = React.Children.toArray(children);

    return (
        <Card padding="none" className={className}>
            <ul className="divide-y divide-neutral-200/70">
                {rows.map((row, idx) => (
                    <li key={idx}>{row}</li>
                ))}
            </ul>
        </Card>
    );
}
