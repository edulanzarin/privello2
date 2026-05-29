"use client";

import * as React from "react";

import { CheckIcon } from "../icons";

/**
 * Item exibido pelo {@link ChipGroup}.
 *
 * Cada chip carrega um `value` (id estável, gravado no estado) e um
 * `label` (rótulo visível). Opcionalmente um `description` curto pode
 * ser usado em chips com texto auxiliar. Nenhuma prop carrega nomes de
 * entidades de domínio (Property 29).
 */
export interface ChipOption {
    value: string;
    label: React.ReactNode;
    description?: React.ReactNode;
}

export interface ChipGroupProps {
    /** Nome do campo no `FormData` (cada item selecionado vira um valor). */
    name?: string;
    /** Rótulo do grupo. */
    label?: React.ReactNode;
    /** Texto auxiliar exibido abaixo do grupo. */
    hint?: React.ReactNode;
    /** Lista de opções. */
    options: ReadonlyArray<ChipOption>;
    /** Valores selecionados (controlado). */
    value?: ReadonlyArray<string>;
    /** Valores selecionados iniciais (não controlado). */
    defaultValue?: ReadonlyArray<string>;
    /** Callback chamado quando a seleção muda. */
    onChange?: (selected: ReadonlyArray<string>) => void;
    /** Quando `true`, marca como inválido. */
    error?: boolean;
    /** Mensagem de erro exibida abaixo do grupo. */
    errorMessage?: React.ReactNode;
    /** Quando `true`, desabilita interação. */
    disabled?: boolean;
    /**
     * Quando `single`, força seleção única (rádio-like). Padrão:
     * `multiple`.
     */
    selection?: "single" | "multiple";
}

/**
 * ChipGroup — grupo de chips selecionáveis (multi por padrão).
 *
 * Acessibilidade:
 * - O container tem `role="group"` com `aria-labelledby` apontando para
 *   o `label` quando presente.
 * - Cada chip é um `<button type="button" role="checkbox">` (ou
 *   `"radio"` quando `selection="single"`) com `aria-checked` espelhando
 *   o estado.
 * - Quando `name` é fornecido, inputs `<input type="hidden">` paralelos
 *   espelham os valores selecionados para que o componente funcione
 *   dentro de `<form>` nativo / Server Actions.
 */
export function ChipGroup({
    name,
    label,
    hint,
    options,
    value: valueProp,
    defaultValue,
    onChange,
    error = false,
    errorMessage,
    disabled = false,
    selection = "multiple",
}: ChipGroupProps): React.ReactElement {
    const generatedId = React.useId();
    const groupId = `privello-chipgroup-${generatedId}`;
    const labelId = `${groupId}-label`;
    const hintId = `${groupId}-hint`;
    const errorId = `${groupId}-error`;

    const isControlled = valueProp !== undefined;
    const [internal, setInternal] = React.useState<ReadonlyArray<string>>(
        defaultValue ?? [],
    );
    const selected = isControlled ? valueProp : internal;

    function commit(next: ReadonlyArray<string>): void {
        if (!isControlled) {
            setInternal(next);
        }
        onChange?.(next);
    }

    function toggle(value: string): void {
        if (disabled) return;
        if (selection === "single") {
            commit([value]);
            return;
        }
        const has = selected.includes(value);
        commit(has ? selected.filter((v) => v !== value) : [...selected, value]);
    }

    const showError = Boolean(error) && Boolean(errorMessage);
    const showHint = !showError && hint != null;

    return (
        <div className="flex flex-col gap-1.5">
            {label != null ? (
                <span
                    id={labelId}
                    className="text-xs font-medium text-text-secondary"
                >
                    {label}
                </span>
            ) : null}

            <div
                role="group"
                aria-labelledby={label != null ? labelId : undefined}
                aria-describedby={
                    showError ? errorId : showHint ? hintId : undefined
                }
                className="flex flex-wrap gap-2"
            >
                {options.map((opt) => {
                    const isSelected = selected.includes(opt.value);
                    return (
                        <button
                            key={opt.value}
                            type="button"
                            role={selection === "single" ? "radio" : "checkbox"}
                            aria-checked={isSelected}
                            disabled={disabled}
                            onClick={() => toggle(opt.value)}
                            className={[
                                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all duration-150",
                                "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ec7b5b]/40",
                                disabled
                                    ? "cursor-not-allowed opacity-50"
                                    : "cursor-pointer",
                                isSelected
                                    ? "border-[#ec7b5b]/40 bg-[color:var(--accent-soft)] text-[color:var(--accent-deep)] shadow-[0_2px_8px_-3px_rgba(197,82,58,0.3)]"
                                    : "border-border bg-surface text-text-primary hover:border-[#ec7b5b]/30 hover:bg-[#fff0eb]/40",
                            ].join(" ")}
                        >
                            {isSelected ? (
                                <CheckIcon size={12} />
                            ) : null}
                            {opt.label}
                        </button>
                    );
                })}
            </div>

            {/* Espelha a seleção em inputs hidden para integração com
                <form> nativo e Server Actions. Múltiplos inputs com o
                mesmo `name` viram um array em `FormData.getAll(name)`. */}
            {name != null
                ? selected.map((v) => (
                    <input key={v} type="hidden" name={name} value={v} />
                ))
                : null}

            {showError ? (
                <p
                    id={errorId}
                    role="alert"
                    className="text-xs text-danger-700 animate-fade-in-soft"
                >
                    {errorMessage}
                </p>
            ) : null}
            {showHint ? (
                <p id={hintId} className="text-xs text-text-secondary">
                    {hint}
                </p>
            ) : null}
        </div>
    );
}
