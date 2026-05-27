import * as React from "react";

/**
 * Variantes do {@link Skeleton}.
 *
 * - `"box"`: retângulo com cantos arredondados pequenos. Default.
 * - `"text"`: linha curta com cantos arredondados maiores —
 *   simula uma linha de texto.
 * - `"avatar"`: disco circular completo.
 * - `"card"`: bloco grande com cantos `rounded-2xl` — usado pra
 *   placeholders de cards inteiros.
 */
export type SkeletonVariant = "box" | "text" | "avatar" | "card";

/**
 * Props do {@link Skeleton}.
 *
 * Placeholder visual com animação shimmer enquanto dados estão
 * carregando. Tamanho controlado via `width`/`height` ou
 * classes Tailwind passadas em `className`.
 *
 * Nenhum nome de domínio nas props (Property 29).
 */
export interface SkeletonProps {
    variant?: SkeletonVariant;
    /** Largura. Aceita CSS string. */
    width?: string | number;
    /** Altura. Aceita CSS string. */
    height?: string | number;
    /** Classes extras aplicadas ao elemento. */
    className?: string;
}

const VARIANT_CLASSES: Record<SkeletonVariant, string> = {
    box: "rounded-md",
    text: "rounded-full h-3",
    avatar: "rounded-full",
    card: "rounded-2xl",
};

/**
 * Skeleton — placeholder com shimmer.
 *
 * Visual: fundo `neutral-100` com keyframe `shimmer` que move um
 * gradiente claro ciclicamente (definido em
 * `tailwind.config.ts`). Respeita `prefers-reduced-motion`
 * (anula a animação).
 */
export function Skeleton({
    variant = "box",
    width,
    height,
    className,
}: SkeletonProps): React.ReactElement {
    const composed = [
        "block bg-neutral-100 overflow-hidden relative",
        VARIANT_CLASSES[variant],
        // Shimmer via gradient + keyframe `skeleton-shimmer`
        // (transform translateX, mais performático que background
        // position).
        "before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/60 before:to-transparent before:animate-skeleton-shimmer",
        className ?? "",
    ]
        .filter(Boolean)
        .join(" ");

    return (
        <span
            aria-hidden="true"
            className={composed}
            style={{
                width: typeof width === "number" ? `${width}px` : width,
                height: typeof height === "number" ? `${height}px` : height,
            }}
        />
    );
}
