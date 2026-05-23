"use client";

import * as React from "react";

/**
 * Props do {@link HorizontalSnap}.
 *
 * Container genérico para listas horizontais com scroll snap. Usado
 * em destaques na home, listas de cidades populares e qualquer
 * fileira de cards que deve rolar lateralmente em mobile.
 *
 * Nenhuma prop carrega nomes de entidades de domínio (Property 29).
 */
export interface HorizontalSnapProps {
    /**
     * Itens já renderizados como filhos. Cada filho deve ser um
     * elemento "snap" inteiro — o container só cuida do
     * comportamento de rolagem e da margem entre eles.
     */
    children: React.ReactNode;
    /**
     * Espaçamento entre itens. Padrão: `"md"` (gap-3). Use `"sm"`
     * para fileiras compactas (chips) e `"lg"` para cards grandes
     * que precisam respirar.
     */
    gap?: "sm" | "md" | "lg";
    /**
     * Quando `true`, aplica um pequeno padding lateral interno
     * (1 unidade) pra que o foco-ring/sombra dos itens não fique
     * cortado na borda. Padrão: `false`.
     */
    edgePadding?: boolean;
    /** Rótulo acessível pra leitor de tela. */
    "aria-label"?: string;
    /** Classes extras aplicadas ao container externo. */
    className?: string;
}

const GAP_CLASSES: Record<NonNullable<HorizontalSnapProps["gap"]>, string> = {
    sm: "gap-2",
    md: "gap-3",
    lg: "gap-4",
};

/**
 * HorizontalSnap — fileira rolável horizontalmente com snap de
 * primeiro nível.
 *
 * Aplica `overflow-x-auto`, `snap-x snap-mandatory` e
 * `scroll-smooth` no container e expõe os filhos lado a lado. O
 * consumidor é responsável por aplicar `snap-start` em cada item se
 * desejar o snap mais agressivo (default: snap suave).
 *
 * Esconde a scrollbar nativa via `scrollbar-hidden` (utilitário
 * declarado em `globals.css`) e mantém o foco por teclado funcional —
 * usuários com tab/setas conseguem navegar.
 */
export function HorizontalSnap({
    children,
    gap = "md",
    edgePadding = false,
    "aria-label": ariaLabel,
    className,
}: HorizontalSnapProps): React.ReactElement {
    return (
        <div
            role="region"
            aria-label={ariaLabel}
            className={[
                "scrollbar-none overflow-x-auto scroll-smooth snap-x snap-mandatory",
                className ?? "",
            ]
                .filter(Boolean)
                .join(" ")}
        >
            <div
                className={[
                    "flex w-max",
                    GAP_CLASSES[gap],
                    edgePadding ? "px-1" : "",
                ].join(" ")}
            >
                {children}
            </div>
        </div>
    );
}
