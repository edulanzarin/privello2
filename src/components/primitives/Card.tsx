"use client";

import * as React from "react";

/**
 * Variante visual do {@link Card}.
 *
 * - `"default"`: superfície sólida, borda neutra fina, cantos discretos
 *   (visual "Notion-like"). Usado em formulários, listas e contextos
 *   utilitários onde a leitura prevalece sobre o destaque.
 * - `"glass"`: superfície translúcida com `backdrop-filter`, borda clara
 *   e sombra de vidro (Liquid Glass). Usado em destaques sobre fundos
 *   gradiente/animados.
 * - `"elevated"`: variação do glass com sombra mais profunda e hover-lift,
 *   pensada para cards "selecionáveis" (planos, ofertas, CTAs).
 */
export type CardVariant = "default" | "glass" | "elevated";

/**
 * Tamanho do padding interno do {@link Card}.
 *
 * - `"default"`: padding canônico de cada variante (5 para default,
 *   6 para glass/elevated). Usado em 95% dos casos.
 * - `"none"`: sem padding interno — para conter `<ul>` com
 *   `divide-y` ou outros componentes que cuidam do próprio espaço
 *   (`InfoRow`, `EmptyState`).
 *
 * Substitui o hack `className="!p-0"` que repetia em vários lugares
 * antes deste prop existir.
 */
export type CardPadding = "default" | "none";

/**
 * Props do componente {@link Card}.
 *
 * Estende as props nativas de `<div>`, adicionando suporte a estado
 * desabilitado refletido em `aria-disabled`. Nenhuma prop carrega nomes
 * de entidades de domínio.
 */
export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    /**
     * Quando `true`, aplica `aria-disabled="true"` ao elemento raiz e um
     * estilo visual de inatividade (opacidade reduzida, sem ponteiro).
     */
    disabled?: boolean;
    /** Variante visual. Padrão: `"default"`. */
    variant?: CardVariant;
    /**
     * Quando `true`, adiciona um anel/glow sutil de destaque (ex.: card
     * "recomendado" em listas de planos). Combina com qualquer variante.
     */
    featured?: boolean;
    /**
     * Padding interno. Padrão: `"default"`. Use `"none"` para listas
     * `divide-y` ou EmptyState que cuidam do próprio espaço.
     */
    padding?: CardPadding;
    /** Conteúdo exibido dentro do card. */
    children?: React.ReactNode;
}

/**
 * Cada combinação variant × padding tem suas próprias classes.
 * Mantido como matriz fechada para garantir que cada par seja
 * inspecionável e classes do Tailwind apareçam literalmente
 * (necessário para o JIT capturar).
 */
const VARIANT_CLASSES: Record<
    CardVariant,
    Record<CardPadding, string>
> = {
    default: {
        default:
            "rounded-lg bg-neutral-50 p-5 transition-colors duration-150",
        none:
            "rounded-lg bg-neutral-50 transition-colors duration-150",
    },
    glass: {
        default:
            "rounded-2xl border border-white/60 bg-white/55 p-6 shadow-glass backdrop-blur-md transition-all duration-300 ease-spring",
        none:
            "rounded-2xl border border-white/60 bg-white/55 shadow-glass backdrop-blur-md transition-all duration-300 ease-spring",
    },
    elevated: {
        default:
            "rounded-2xl border border-white/60 bg-white/55 p-6 shadow-glass backdrop-blur-md transition-all duration-300 ease-spring hover:-translate-y-1 hover:shadow-glassLg",
        none:
            "rounded-2xl border border-white/60 bg-white/55 shadow-glass backdrop-blur-md transition-all duration-300 ease-spring hover:-translate-y-1 hover:shadow-glassLg",
    },
};

/**
 * Card primitivo da Biblioteca_de_Componentes.
 *
 * Suporta três variantes visuais (`default`/`glass`/`elevated`) que
 * compartilham o mesmo contrato e podem ser permutadas pelas páginas
 * conforme a hierarquia visual desejada. Nenhuma variante conhece
 * entidades de domínio (Property 29).
 */
export function Card({
    disabled = false,
    variant = "default",
    featured = false,
    padding = "default",
    className,
    children,
    ...rest
}: CardProps): React.ReactElement {
    const tone = disabled ? "opacity-60 pointer-events-none" : "";
    const accent = featured
        ? "ring-1 ring-primary-300/60 shadow-glassLg"
        : "";
    const composed = [
        VARIANT_CLASSES[variant][padding],
        accent,
        tone,
        className ?? "",
    ]
        .filter(Boolean)
        .join(" ");

    return (
        <div
            {...rest}
            aria-disabled={disabled || undefined}
            className={composed}
        >
            {children}
        </div>
    );
}
