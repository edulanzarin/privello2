"use client";

import * as React from "react";

/**
 * Forma de uma opção do {@link FilterChips}.
 *
 * Cada chip tem um `value` único, um `label` exibido, ícone opcional
 * e um modo `locked` que indica recurso bloqueado (ex.: exclusivo de
 * um tier superior). Chips bloqueados continuam clicáveis para
 * disparar um CTA de upgrade — o callback recebe o chip que foi
 * tocado e a página decide o que fazer.
 *
 * Nenhuma prop carrega nomes de entidades de domínio (Property 29).
 */
export interface FilterChipsOption {
    value: string;
    label: React.ReactNode;
    /** Ícone opcional exibido à esquerda do label. */
    icon?: React.ReactNode;
    /**
     * Quando `true`, o chip aparece com tom apagado e cadeado. O
     * callback `onChange` ainda é disparado (a página usa para abrir
     * modal de upgrade ou redirecionar).
     */
    locked?: boolean;
    /** Contador opcional exibido em pill após o label. */
    count?: number;
}

/**
 * Props do {@link FilterChips}.
 *
 * Selector segmentado com aparência de pill. Pode operar como
 * controle único (radio: `value` + `onChange`) ou como navegação que
 * sempre tem um chip ativo. O componente é ARIA `radiogroup`.
 */
export interface FilterChipsProps {
    /** Opções renderizadas em sequência. */
    options: ReadonlyArray<FilterChipsOption>;
    /** Valor atualmente selecionado. */
    value: string;
    /** Callback chamado ao selecionar um chip (incluindo `locked`). */
    onChange: (value: string) => void;
    /** Rótulo acessível do grupo. */
    "aria-label": string;
    /**
     * Layout do grupo:
     *
     * - `"wrap"` (padrão): largura natural com `flex-wrap`. Bom para
     *   listas curtas (2-3 chips) ou labels pequenos.
     * - `"fixed"`: grade 2×2 em mobile (cada chip preenche metade da
     *   linha) e fila natural em telas a partir de `sm:`. Garante
     *   que 4-6 chips de label longo não fiquem 3+1 em telas
     *   estreitas. Os labels truncam quando faltar espaço.
     */
    layout?: "wrap" | "fixed";
    /** Classes extras aplicadas ao container. */
    className?: string;
}

const LAYOUT_CLASSES: Record<NonNullable<FilterChipsProps["layout"]>, string> =
{
    wrap: "flex flex-wrap items-center gap-2",
    fixed: "grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center",
};

/**
 * FilterChips — selector segmentado em pílulas, com suporte a chips
 * bloqueados.
 *
 * Visual: layout configurável (`wrap` natural ou `fixed` 2×2 em
 * mobile). Chip ativo recebe fundo `primary-600` e texto branco.
 * Chip bloqueado fica com tom apagado e ícone de cadeado, mas
 * dispara o callback (a página decide o redirect/CTA).
 */
export function FilterChips({
    options,
    value,
    onChange,
    "aria-label": ariaLabel,
    layout = "wrap",
    className,
}: FilterChipsProps): React.ReactElement {
    const composed = [LAYOUT_CLASSES[layout], className ?? ""]
        .filter(Boolean)
        .join(" ");

    return (
        <div role="radiogroup" aria-label={ariaLabel} className={composed}>
            {options.map((opt) => {
                const isActive = opt.value === value && !opt.locked;
                // `min-w-0` é essencial para que o `truncate` no
                // label funcione dentro da grade `fixed` (sem ele a
                // célula expande para o conteúdo intrínseco).
                const baseClass =
                    "inline-flex min-w-0 items-center justify-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium tracking-tight transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40";
                const stateClass = opt.locked
                    ? "border-neutral-200 bg-neutral-50 text-text-disabled hover:bg-neutral-100"
                    : isActive
                        ? "border-primary-600 bg-primary-600 text-white shadow-sm"
                        : "border-neutral-200 bg-surface text-text-secondary hover:border-primary-300 hover:text-text-primary";
                return (
                    <button
                        key={opt.value}
                        type="button"
                        role="radio"
                        aria-checked={isActive}
                        aria-disabled={opt.locked || undefined}
                        onClick={() => onChange(opt.value)}
                        className={[baseClass, stateClass].join(" ")}
                    >
                        {opt.icon != null ? (
                            <span aria-hidden="true" className="flex-none">
                                {opt.icon}
                            </span>
                        ) : null}
                        <span className="min-w-0 truncate">{opt.label}</span>
                        {opt.locked ? (
                            <span aria-hidden="true" className="flex-none">
                                🔒
                            </span>
                        ) : opt.count !== undefined ? (
                            <span
                                aria-hidden="true"
                                className={[
                                    "inline-flex min-w-[1.25rem] flex-none items-center justify-center rounded-full px-1.5 text-[0.65rem] font-semibold",
                                    isActive
                                        ? "bg-white/20 text-white"
                                        : "bg-neutral-100 text-text-secondary",
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
