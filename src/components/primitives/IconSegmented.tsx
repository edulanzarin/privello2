"use client";

import * as React from "react";

/**
 * Forma de uma opção do {@link IconSegmented}.
 *
 * Cada segmento é puramente icônico — o texto fica como `aria-label`
 * (acessibilidade) e como tooltip (`title`). O contador opcional
 * aparece como pílula compacta ao lado do ícone.
 *
 * Nenhuma prop carrega nomes de entidades de domínio (Property 29).
 */
export interface IconSegmentedOption {
    /** Identificador único do segmento. */
    value: string;
    /**
     * Rótulo para acessibilidade (aria-label) e tooltip nativo.
     * Obrigatório porque o segmento não tem texto visível.
     */
    label: string;
    /** Ícone exibido. */
    icon: React.ReactNode;
    /** Contador opcional renderizado em pílula ao lado do ícone. */
    count?: number;
}

/**
 * Props do {@link IconSegmented}.
 *
 * Controle segmentado puramente icônico em "faixa" única, estilo
 * iOS segmented control. Em vez de cada segmento ser uma pílula
 * própria como no {@link import("./FilterChips").FilterChips}, todos
 * os segmentos vivem dentro de um único container com fundo neutro,
 * e o segmento ativo recebe um "track" branco deslizante.
 *
 * Vantagem visual: toma uma linha só e mantém a forma constante
 * mesmo em mobile estreito — o contador da contagem some quando
 * `0` para deixar o ícone sozinho.
 */
export interface IconSegmentedProps {
    /** Opções renderizadas em sequência. */
    options: ReadonlyArray<IconSegmentedOption>;
    /** Valor atualmente selecionado. */
    value: string;
    /** Callback chamado ao trocar de segmento. */
    onChange: (value: string) => void;
    /** Rótulo acessível do grupo. */
    "aria-label": string;
    /**
     * Quando `true`, esconde o contador `0`. Útil quando os
     * contadores apenas servem para "preview" e não precisam de
     * destaque enquanto a galeria está vazia. Padrão: `true`.
     */
    hideZeroCounts?: boolean;
    /** Classes extras aplicadas ao container. */
    className?: string;
}

/**
 * IconSegmented — segmented control icônico de uma linha.
 *
 * Visual: faixa `bg-neutral-100 rounded-full p-1` que comporta os
 * segmentos. O segmento ativo recebe `bg-surface` + sombra fina,
 * dando ilusão de "pill flutuante". Tudo `min-w-0` pra colapsar
 * graciosamente em telas estreitas.
 */
export function IconSegmented({
    options,
    value,
    onChange,
    "aria-label": ariaLabel,
    hideZeroCounts = true,
    className,
}: IconSegmentedProps): React.ReactElement {
    return (
        <div
            role="radiogroup"
            aria-label={ariaLabel}
            className={[
                "inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-neutral-100 p-1",
                className ?? "",
            ]
                .filter(Boolean)
                .join(" ")}
        >
            {options.map((opt) => {
                const isActive = opt.value === value;
                const showCount =
                    opt.count !== undefined &&
                    !(hideZeroCounts && opt.count === 0);
                return (
                    <button
                        key={opt.value}
                        type="button"
                        role="radio"
                        aria-checked={isActive}
                        aria-label={opt.label}
                        title={opt.label}
                        onClick={() => onChange(opt.value)}
                        className={[
                            "inline-flex flex-none items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium tracking-tight transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40",
                            isActive
                                ? "bg-surface text-primary-700 shadow-sm"
                                : "text-text-secondary hover:text-text-primary",
                        ].join(" ")}
                    >
                        <span aria-hidden="true">{opt.icon}</span>
                        {showCount ? (
                            <span
                                aria-hidden="true"
                                className={[
                                    "tabular-nums text-[0.65rem] font-semibold",
                                    isActive
                                        ? "text-primary-700"
                                        : "text-text-disabled",
                                ].join(" ")}
                            >
                                {opt.count}
                            </span>
                        ) : null}
                    </button>
                );
            })}
        </div>
    );
}
