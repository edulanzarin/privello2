import * as React from "react";

/**
 * Tamanhos disponíveis para o {@link LoadingSpinner}.
 */
export type LoadingSpinnerSize = "sm" | "md" | "lg";

/**
 * Props do {@link LoadingSpinner}.
 *
 * Spinner moderno com 3 pontos pulsantes em gradiente warm,
 * em vez de spinner SVG genérico. Usado em loading states
 * inline (botões, listas, sentinelas).
 *
 * Para loading de "página inteira" use {@link PageLoader}, que
 * combina este spinner com label centralizada.
 *
 * Nenhuma prop carrega nomes de entidades de domínio (Property 29).
 */
export interface LoadingSpinnerProps {
    /** Tamanho. Padrão: `"md"`. */
    size?: LoadingSpinnerSize;
    /** Rótulo acessível. Padrão: `"Carregando"`. */
    label?: string;
    /** Classes extras aplicadas ao container. */
    className?: string;
}

const SIZE_CLASSES: Record<LoadingSpinnerSize, string> = {
    sm: "h-1.5 w-1.5",
    md: "h-2 w-2",
    lg: "h-3 w-3",
};

const GAP_CLASSES: Record<LoadingSpinnerSize, string> = {
    sm: "gap-1",
    md: "gap-1.5",
    lg: "gap-2",
};

/**
 * LoadingSpinner — 3 pontos pulsantes em gradiente warm.
 *
 * Visual: três bolinhas que pulsam em sequência (delay escalonado
 * 0ms / 150ms / 300ms). Cor `accent` warm. Substitui o spinner
 * SVG genérico em todos os loading states.
 */
export function LoadingSpinner({
    size = "md",
    label = "Carregando",
    className,
}: LoadingSpinnerProps): React.ReactElement {
    const dot = `${SIZE_CLASSES[size]} rounded-full bg-gradient-to-br from-[color:var(--accent)] to-[color:var(--accent-deep)]`;
    return (
        <span
            role="status"
            aria-label={label}
            className={[
                "inline-flex items-center",
                GAP_CLASSES[size],
                className ?? "",
            ]
                .filter(Boolean)
                .join(" ")}
        >
            <span
                aria-hidden="true"
                className={`${dot} animate-pulse-soft`}
                style={{ animationDelay: "0ms" }}
            />
            <span
                aria-hidden="true"
                className={`${dot} animate-pulse-soft`}
                style={{ animationDelay: "150ms" }}
            />
            <span
                aria-hidden="true"
                className={`${dot} animate-pulse-soft`}
                style={{ animationDelay: "300ms" }}
            />
        </span>
    );
}

/**
 * Props do {@link PageLoader}.
 *
 * Loading state em "página cheia" — usa {@link LoadingSpinner} em
 * tamanho lg dentro de um container vertical centralizado, com
 * label opcional abaixo. Para usar em `loading.tsx` files do Next.
 */
export interface PageLoaderProps {
    /** Mensagem opcional abaixo do spinner. */
    label?: string;
    /** Quando `true`, ocupa min-height para centralizar verticalmente. */
    fullHeight?: boolean;
    /** Classes extras aplicadas ao container. */
    className?: string;
}

/**
 * PageLoader — loading hero centralizado.
 */
export function PageLoader({
    label = "Carregando…",
    fullHeight = true,
    className,
}: PageLoaderProps): React.ReactElement {
    return (
        <div
            className={[
                "flex flex-col items-center justify-center gap-3 py-10 text-center",
                fullHeight ? "min-h-[40vh]" : "",
                className ?? "",
            ]
                .filter(Boolean)
                .join(" ")}
        >
            <LoadingSpinner size="lg" />
            {label ? (
                <span className="text-xs uppercase tracking-wider text-text-secondary">
                    {label}
                </span>
            ) : null}
        </div>
    );
}
