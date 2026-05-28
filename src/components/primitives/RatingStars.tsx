"use client";

import * as React from "react";

import { StarIcon } from "../icons";

/**
 * Tamanho da estrela individual.
 */
export type RatingStarsSize = "sm" | "md" | "lg";

/**
 * Props do {@link RatingStars}.
 *
 * Componente dual: serve como display (`readOnly: true`) ou como
 * input (`onChange` definido). Quando readOnly, valores fracionários
 * (ex.: 4.3) são preservados como meia-estrela visual; em modo
 * input só inteiros 1..5 são aceitos.
 *
 * Nenhuma prop carrega nomes de entidades de domínio.
 */
export interface RatingStarsProps {
    /** Valor atual. `null` = nenhuma estrela acesa. */
    value: number | null;
    /** Callback ao clicar — recebe o número da estrela 1..5. */
    onChange?: (value: number) => void;
    /** Quando `true`, vira display. Default: `onChange ? false : true`. */
    readOnly?: boolean;
    /** Tamanho. Default: `"md"`. */
    size?: RatingStarsSize;
    /**
     * Quando `true`, mostra os labels descritivos abaixo
     * ("Muito ruim", "Ruim", "OK", "Gostei", "Amei") quando o
     * usuário hover ou seleciona uma estrela. Default: `false`.
     * Em modo readOnly, ignorado.
     */
    showLabel?: boolean;
    /** Classes extras aplicadas ao container. */
    className?: string;
    /** Rótulo acessível pra leitor de tela (ex.: "Sua nota"). */
    "aria-label"?: string;
}

const SIZE_PX: Record<RatingStarsSize, number> = {
    sm: 14,
    md: 18,
    lg: 26,
};

const LABELS: Record<1 | 2 | 3 | 4 | 5, string> = {
    1: "Muito ruim",
    2: "Ruim",
    3: "OK",
    4: "Gostei",
    5: "Amei",
};

/**
 * RatingStars — 5 estrelas clicáveis (input) ou estáticas (display).
 *
 * - Input: hover ilumina até a estrela em foco; clique fixa o valor.
 *   Acessível via teclado (setas ←/→ + Espaço).
 * - Display: estrelas cheias até o `value` arredondado pra baixo.
 *   Suporta meia-estrela visual quando o valor não é inteiro
 *   (ex.: `value=4.5` → 4 cheias + meia).
 */
export function RatingStars({
    value,
    onChange,
    readOnly,
    size = "md",
    showLabel = false,
    className,
    "aria-label": ariaLabel,
}: RatingStarsProps): React.ReactElement {
    const isInput = !readOnly && onChange !== undefined;
    const [hover, setHover] = React.useState<number | null>(null);
    const px = SIZE_PX[size];

    const effective = hover ?? value ?? 0;
    const labelKey = (hover ?? value) as 1 | 2 | 3 | 4 | 5 | null;

    function handleClick(n: number): void {
        if (!isInput) return;
        onChange?.(n);
    }

    function handleKey(
        e: React.KeyboardEvent<HTMLDivElement>,
    ): void {
        if (!isInput) return;
        const cur = value ?? 0;
        if (e.key === "ArrowRight") {
            e.preventDefault();
            onChange?.(Math.min(5, Math.max(1, cur + 1)));
        } else if (e.key === "ArrowLeft") {
            e.preventDefault();
            onChange?.(Math.max(1, cur - 1));
        } else if (e.key >= "1" && e.key <= "5") {
            e.preventDefault();
            onChange?.(Number.parseInt(e.key, 10));
        }
    }

    return (
        <div
            className={["inline-flex flex-col gap-1", className ?? ""]
                .filter(Boolean)
                .join(" ")}
            role={isInput ? "radiogroup" : undefined}
            aria-label={ariaLabel ?? "Avaliação em estrelas"}
            onKeyDown={handleKey}
            tabIndex={isInput ? 0 : -1}
        >
            <div className="inline-flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((n) => {
                    const filled = n <= Math.floor(effective);
                    const half =
                        !filled &&
                        n <= effective &&
                        n - 1 < effective &&
                        effective < n;

                    return (
                        <button
                            key={n}
                            type="button"
                            onClick={() => handleClick(n)}
                            onMouseEnter={() =>
                                isInput ? setHover(n) : undefined
                            }
                            onMouseLeave={() =>
                                isInput ? setHover(null) : undefined
                            }
                            disabled={!isInput}
                            aria-label={`${n} ${n === 1 ? "estrela" : "estrelas"}`}
                            aria-checked={isInput ? value === n : undefined}
                            role={isInput ? "radio" : undefined}
                            className={[
                                "inline-flex items-center justify-center transition-transform",
                                isInput
                                    ? "cursor-pointer hover:scale-110 active:scale-95"
                                    : "cursor-default",
                                filled || half
                                    ? "text-warning-500"
                                    : "text-neutral-300",
                                "focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/40 rounded",
                            ].join(" ")}
                        >
                            {half ? (
                                <span
                                    className="relative inline-flex"
                                    aria-hidden="true"
                                >
                                    <StarIcon size={px} className="text-neutral-300" />
                                    <span
                                        className="absolute inset-0 overflow-hidden text-warning-500"
                                        style={{ width: "50%" }}
                                    >
                                        <StarIcon size={px} />
                                    </span>
                                </span>
                            ) : (
                                <StarIcon size={px} />
                            )}
                        </button>
                    );
                })}
            </div>

            {showLabel && isInput && labelKey !== null ? (
                <span className="text-xs font-medium text-text-secondary">
                    {LABELS[labelKey]}
                </span>
            ) : null}
        </div>
    );
}
