"use client";

import * as React from "react";

import { StarIcon } from "../icons";

/**
 * Distribuição de notas — mapa de quantos avaliadores deram cada
 * nota de 1 a 5. Sempre tem as 5 chaves mesmo zeradas.
 */
export interface RatingDistributionData {
    /** Quantos deram 1 estrela. */
    1: number;
    /** Quantos deram 2 estrelas. */
    2: number;
    /** Quantos deram 3 estrelas. */
    3: number;
    /** Quantos deram 4 estrelas. */
    4: number;
    /** Quantos deram 5 estrelas. */
    5: number;
}

/**
 * Props do {@link RatingDistribution}.
 */
export interface RatingDistributionProps {
    /** Distribuição completa. */
    data: RatingDistributionData;
    /** Média ponderada (0..5). `null` quando não há nota. */
    media: number | null;
    /** Total de avaliações com nota. */
    total: number;
    /** Classes extras aplicadas ao container. */
    className?: string;
}

/**
 * RatingDistribution — bloco resumo com média + 5 barras
 * proporcionais (estilo App Store / Google Play).
 *
 * Layout:
 *
 * ```
 *   ★ 4.5
 *   8 avaliações
 *
 *   5 ★ ████████████████████ 5
 *   4 ★ ████████░░░░░░░░░░░░ 2
 *   3 ★ ████░░░░░░░░░░░░░░░░ 1
 *   2 ★ ░░░░░░░░░░░░░░░░░░░░ 0
 *   1 ★ ░░░░░░░░░░░░░░░░░░░░ 0
 * ```
 *
 * As barras são preenchidas proporcionalmente ao maior valor da
 * distribuição (não ao total) — destaca a moda visualmente.
 */
export function RatingDistribution({
    data,
    media,
    total,
    className,
}: RatingDistributionProps): React.ReactElement {
    const valores = [data[5], data[4], data[3], data[2], data[1]];
    const maior = Math.max(1, ...valores);

    return (
        <div
            className={["flex flex-col gap-4", className ?? ""]
                .filter(Boolean)
                .join(" ")}
        >
            {/* Header com média grande */}
            <div className="flex items-end justify-between gap-4">
                <div className="flex flex-col">
                    <span className="text-4xl font-bold tabular-nums leading-none text-text-primary">
                        {media !== null ? media.toFixed(1) : "—"}
                    </span>
                    <span className="mt-1 text-xs text-text-secondary">
                        {total} {total === 1 ? "avaliação" : "avaliações"}
                    </span>
                </div>
                <div className="flex items-center gap-0.5 text-warning-500">
                    {[1, 2, 3, 4, 5].map((n) => {
                        const filled =
                            media !== null && n <= Math.round(media);
                        return (
                            <StarIcon
                                key={n}
                                size={20}
                                className={
                                    filled
                                        ? "text-warning-500"
                                        : "text-neutral-200"
                                }
                            />
                        );
                    })}
                </div>
            </div>

            {/* 5 barras (5★ no topo, 1★ na base) */}
            <ul className="flex flex-col gap-1.5">
                {[5, 4, 3, 2, 1].map((nota, idx) => {
                    const valor = valores[idx]!;
                    const pct = (valor / maior) * 100;
                    return (
                        <li
                            key={nota}
                            className="flex items-center gap-2"
                        >
                            <span className="inline-flex w-5 items-center gap-0.5 text-xs font-medium tabular-nums text-text-secondary">
                                {nota}
                            </span>
                            <StarIcon
                                size={11}
                                className="flex-none text-warning-500"
                            />
                            <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-100">
                                <div
                                    className="absolute inset-y-0 left-0 rounded-full bg-warning-500 transition-all"
                                    style={{ width: `${pct}%` }}
                                />
                            </div>
                            <span className="w-6 text-right text-xs tabular-nums text-text-secondary">
                                {valor}
                            </span>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
