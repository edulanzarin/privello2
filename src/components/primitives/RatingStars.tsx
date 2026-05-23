"use client";

import * as React from "react";

/**
 * Tamanho do {@link RatingStars}.
 */
export type RatingStarsSize = "sm" | "md" | "lg";

/**
 * Props do {@link RatingStars}.
 *
 * Linha de estrelas para exibir uma nota de 0 a 5 (ou outro `max`).
 * Renderiza `max` estrelas em SVG, preenchendo proporcionalmente as
 * primeiras `value` (suporta frações: `4.7` rende 4 estrelas cheias
 * + 70% da quinta). Sem dependência externa, autoral inline.
 *
 * Componente puramente visual e read-only — input de rating fica
 * fora do escopo do `RatingStars`. Quando precisarmos de input,
 * cria-se um `RatingInput` separado pra manter este componente
 * leve.
 *
 * Nenhuma prop carrega nomes de entidades de domínio (Property 29).
 */
export interface RatingStarsProps {
    /** Nota atual (0..max). Aceita frações. */
    value: number;
    /** Total de estrelas. Padrão: 5. */
    max?: number;
    /** Tamanho. Padrão: `"md"`. */
    size?: RatingStarsSize;
    /**
     * Quando `true`, exibe o valor numérico ao lado das estrelas
     * (ex.: "4.7"). Padrão: `false`.
     */
    showValue?: boolean;
    /** Classes extras aplicadas ao container. */
    className?: string;
}

const SIZE_PX: Record<RatingStarsSize, number> = {
    sm: 12,
    md: 16,
    lg: 22,
};

const SIZE_TEXT: Record<RatingStarsSize, string> = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
};

/**
 * RatingStars — linha de estrelas com preenchimento proporcional.
 *
 * Cada estrela é um SVG com dois layers: o "vazio" (stroke +
 * fill `neutral-200`) e o "cheio" (fill `amber-400`). O cheio é
 * cortado por um `clipPath` que recebe a fração apropriada — assim
 * estrelas parciais (como 4.7) ficam preenchidas só até 70%.
 */
export function RatingStars({
    value,
    max = 5,
    size = "md",
    showValue = false,
    className,
}: RatingStarsProps): React.ReactElement {
    const safeValue = Math.max(0, Math.min(max, value));
    const px = SIZE_PX[size];
    const reactId = React.useId();

    const composed = ["inline-flex items-center gap-1.5", className ?? ""]
        .filter(Boolean)
        .join(" ");

    return (
        <span
            className={composed}
            role="img"
            aria-label={`Nota ${safeValue.toFixed(1)} de ${max}`}
        >
            <span className="inline-flex items-center gap-0.5">
                {Array.from({ length: max }).map((_, i) => {
                    // Fração preenchida desta estrela: 0..1.
                    const fill = Math.max(0, Math.min(1, safeValue - i));
                    return (
                        <Star
                            key={i}
                            sizePx={px}
                            fill={fill}
                            clipId={`rs-${reactId}-${i}`}
                        />
                    );
                })}
            </span>
            {showValue ? (
                <span
                    className={[
                        "font-medium tabular-nums text-text-primary",
                        SIZE_TEXT[size],
                    ].join(" ")}
                >
                    {safeValue.toFixed(1)}
                </span>
            ) : null}
        </span>
    );
}

/**
 * Estrela individual com fill proporcional. O `clipId` precisa ser
 * único por estrela (passado pelo pai com base em `useId`+índice)
 * para que os clipPaths não colidam quando múltiplos `RatingStars`
 * coexistem na página.
 */
function Star({
    sizePx,
    fill,
    clipId,
}: {
    sizePx: number;
    fill: number;
    clipId: string;
}): React.ReactElement {
    const path =
        "M12 2.5l2.95 5.98 6.6.96-4.78 4.66 1.13 6.58L12 17.6l-5.9 3.08 1.13-6.58L2.45 9.44l6.6-.96L12 2.5Z";

    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width={sizePx}
            height={sizePx}
            viewBox="0 0 24 24"
            aria-hidden="true"
            className="block"
        >
            <defs>
                <clipPath id={clipId}>
                    <rect x="0" y="0" width={fill * 24} height="24" />
                </clipPath>
            </defs>
            {/* Camada base: estrela "vazia" em cinza claro. */}
            <path d={path} fill="#e5e7eb" />
            {/* Camada cheia: amarelo, recortada pelo fill. */}
            <path
                d={path}
                fill="#fbbf24"
                clipPath={`url(#${clipId})`}
            />
            {/* Borda fina pra não desaparecer em fundos coloridos. */}
            <path
                d={path}
                fill="none"
                stroke="#d97706"
                strokeWidth="0.6"
                strokeLinejoin="round"
                opacity="0.35"
            />
        </svg>
    );
}
