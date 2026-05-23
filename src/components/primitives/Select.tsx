"use client";

import * as React from "react";

import { ComboboxDropdown } from "./ComboboxDropdown";
import { ComboboxOption } from "./ComboboxOption";

/**
 * Item exibido por {@link Select}. O tipo de `value` é genérico, de modo
 * que consumidores possam restringir o conjunto de valores permitidos
 * sem que o componente conheça nenhuma entidade de domínio.
 *
 * Convenção: o item com `value === ""` é tratado como placeholder
 * (estado "nada selecionado"). Quando presente, renderiza o `label`
 * dele em cinza e remove o tom de "selecionado" do botão.
 */
export interface SelectOption<TValue extends string = string> {
    value: TValue;
    label: string;
    disabled?: boolean;
}

/**
 * Props do {@link Select}.
 *
 * Componente dropdown completamente customizado (não envolve o
 * `<select>` nativo do HTML). O **gatilho usa exatamente o mesmo
 * shell visual do {@link import("./Input").Input}**: mesmas classes
 * de borda, padding, foco e suporte a `leadingIcon`/`trailingIcon`.
 * Qualquer ajuste visual feito no `Input` propaga automaticamente
 * para o `Select`, mantendo a paridade pixel-a-pixel exigida pelo
 * design system.
 *
 * Acessibilidade:
 * - Botão de gatilho com `role="combobox"` + `aria-haspopup="listbox"`
 *   + `aria-expanded`.
 * - Lista com `role="listbox"` e cada item `role="option"` +
 *   `aria-selected`.
 * - Navegação por teclado: ArrowDown/ArrowUp, Enter/Space, Escape.
 *
 * Nenhuma prop carrega nomes de entidades de domínio (Property 29).
 */
export interface SelectProps<TValue extends string = string> {
    /** Nome do campo no `FormData`. */
    name?: string;
    /** Rótulo visível do campo. */
    label?: React.ReactNode;
    /** Texto auxiliar exibido abaixo do campo. */
    hint?: React.ReactNode;
    /** Quando `true`, marca o campo como inválido. */
    error?: boolean;
    /** Mensagem descritiva exibida quando `error` é truthy. */
    errorMessage?: React.ReactNode;
    /** Conjunto de opções. */
    options: ReadonlyArray<SelectOption<TValue>>;
    /** Valor controlado. */
    value?: TValue;
    /** Valor inicial em modo não controlado. */
    defaultValue?: TValue;
    /** Callback chamado quando o usuário seleciona um valor. */
    onChange?: (value: TValue) => void;
    /**
     * Texto exibido quando nenhuma opção está selecionada. Se
     * `options` já contém um item com `value === ""`, o `label` dele
     * prevalece sobre este `placeholder`.
     */
    placeholder?: string;
    /** Quando `true`, desabilita o campo. */
    disabled?: boolean;
    /** Quando `true`, declara `aria-required`. */
    required?: boolean;
    /**
     * Ícone exibido no início do gatilho (idêntico ao `leadingIcon` do
     * {@link import("./Input").Input}).
     */
    leadingIcon?: React.ReactNode;
}

/**
 * Select primitivo: dropdown estilizado com o mesmo shell visual do
 * `<Input>`. Usado em qualquer formulário que precise de seleção
 * exclusiva de um valor a partir de uma lista finita.
 */
export function Select<TValue extends string = string>({
    name,
    label,
    hint,
    error = false,
    errorMessage,
    options,
    value: valueProp,
    defaultValue,
    onChange,
    placeholder = "Selecione",
    disabled = false,
    required = false,
    leadingIcon,
}: SelectProps<TValue>): React.ReactElement {
    const generatedId = React.useId();
    const triggerId = `privello-select-${generatedId}`;
    const labelId = `${triggerId}-label`;
    const listId = `${triggerId}-list`;
    const errorId = `${triggerId}-error`;
    const hintId = `${triggerId}-hint`;

    const isControlled = valueProp !== undefined;
    const [internal, setInternal] = React.useState<TValue>(
        defaultValue ?? ("" as TValue),
    );
    const value = isControlled ? valueProp : internal;

    const [open, setOpen] = React.useState(false);
    const [activeIndex, setActiveIndex] = React.useState<number>(-1);

    const wrapperRef = React.useRef<HTMLDivElement>(null);
    const listRef = React.useRef<HTMLUListElement>(null);

    const showErrorMessage = Boolean(error) && Boolean(errorMessage);
    const showHint = !showErrorMessage && Boolean(hint);

    const selectedOption = React.useMemo(() => {
        if (value === "") return null;
        return options.find((o) => o.value === value) ?? null;
    }, [options, value]);

    const placeholderLabel = React.useMemo(() => {
        const ph = options.find((o) => o.value === "");
        return ph?.label ?? placeholder;
    }, [options, placeholder]);

    const selectableOptions = React.useMemo(
        () => options.filter((o) => o.value !== "" && !o.disabled),
        [options],
    );

    function commit(next: TValue): void {
        if (!isControlled) setInternal(next);
        onChange?.(next);
    }

    function handleSelect(opt: SelectOption<TValue>): void {
        if (opt.disabled) return;
        commit(opt.value);
        setOpen(false);
        setActiveIndex(-1);
    }

    function openList(): void {
        if (disabled) return;
        setOpen(true);
        const idx = selectableOptions.findIndex((o) => o.value === value);
        setActiveIndex(idx >= 0 ? idx : 0);
    }

    function closeList(): void {
        setOpen(false);
        setActiveIndex(-1);
    }

    function handleKeyDown(e: React.KeyboardEvent<HTMLButtonElement>): void {
        if (disabled) return;
        if (e.key === "ArrowDown") {
            e.preventDefault();
            if (!open) {
                openList();
                return;
            }
            setActiveIndex((prev) =>
                Math.min(prev + 1, selectableOptions.length - 1),
            );
            return;
        }
        if (e.key === "ArrowUp") {
            e.preventDefault();
            if (!open) {
                openList();
                return;
            }
            setActiveIndex((prev) => Math.max(prev - 1, 0));
            return;
        }
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (!open) {
                openList();
                return;
            }
            const opt = selectableOptions[activeIndex];
            if (opt) handleSelect(opt);
            return;
        }
        if (e.key === "Escape") {
            e.preventDefault();
            closeList();
        }
    }

    React.useEffect(() => {
        if (!open) return;
        function handleClickOutside(e: MouseEvent): void {
            const target = e.target as HTMLElement | null;
            if (target?.closest('[data-combobox-dropdown="true"]')) return;
            if (
                wrapperRef.current &&
                !wrapperRef.current.contains(e.target as Node)
            ) {
                closeList();
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () =>
            document.removeEventListener("mousedown", handleClickOutside);
    }, [open]);

    React.useEffect(() => {
        if (!open || activeIndex < 0) return;
        const listEl = listRef.current;
        if (!listEl) return;
        const item = listEl.querySelectorAll<HTMLElement>(
            "[role='option']",
        )[activeIndex];
        item?.scrollIntoView({ block: "nearest" });
    }, [open, activeIndex]);

    // Mesmas classes base do `Input` (verificadas linha-a-linha em
    // `Input.tsx`). Diferença mínima: `text-left` para alinhar o
    // texto da opção quando o `<button>` é renderizado por engine
    // que centraliza por padrão.
    const triggerBase =
        "block w-full rounded-md border bg-surface py-2 text-sm text-text-primary text-left shadow-sm transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-text-disabled";
    const triggerTone = error
        ? "border-danger-400 focus-visible:ring-danger-500/30 focus-visible:border-danger-500"
        : "border-neutral-200 focus-visible:ring-primary-500/30 focus-visible:border-primary-400";
    // `padding-left` igual ao do Input: `pl-3` sem leading icon,
    // `pl-9` com leading icon. `padding-right` sempre `pr-9` para
    // dar espaço ao chevron.
    const triggerPadding = [
        leadingIcon ? "pl-9" : "pl-3",
        "pr-9",
    ].join(" ");
    const triggerColorOverride = selectedOption ? "" : "text-text-disabled";

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

            {/* Hidden input para integração com `<form>` nativo. */}
            {name != null ? (
                <input type="hidden" name={name} value={value} />
            ) : null}

            <div ref={wrapperRef} className="relative">
                {leadingIcon != null ? (
                    <span
                        aria-hidden="true"
                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 flex h-4 w-4 items-center justify-center text-text-secondary"
                    >
                        {leadingIcon}
                    </span>
                ) : null}

                <button
                    id={triggerId}
                    type="button"
                    role="combobox"
                    aria-haspopup="listbox"
                    aria-expanded={open}
                    aria-controls={open ? listId : undefined}
                    aria-labelledby={label != null ? labelId : undefined}
                    aria-invalid={error || undefined}
                    aria-required={required || undefined}
                    aria-describedby={
                        showErrorMessage
                            ? errorId
                            : showHint
                                ? hintId
                                : undefined
                    }
                    disabled={disabled}
                    onClick={() => (open ? closeList() : openList())}
                    onKeyDown={handleKeyDown}
                    className={[
                        triggerBase,
                        triggerTone,
                        triggerPadding,
                        triggerColorOverride,
                    ]
                        .filter(Boolean)
                        .join(" ")}
                >
                    <span className="block truncate">
                        {selectedOption?.label ?? placeholderLabel}
                    </span>
                </button>

                {/* Chevron (idêntico ao slot `trailingIcon` do Input). */}
                <span
                    aria-hidden="true"
                    className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 flex h-4 w-4 items-center justify-center text-text-secondary transition-transform duration-150 ${open ? "rotate-180" : "rotate-0"
                        }`}
                >
                    <svg
                        width="12"
                        height="12"
                        viewBox="0 0 20 20"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                    >
                        <path
                            d="M5 8l5 5 5-5"
                            stroke="currentColor"
                            strokeWidth="1.75"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    </svg>
                </span>

                {open ? (
                    <ComboboxDropdown
                        ref={listRef}
                        id={listId}
                        aria-labelledby={label != null ? labelId : undefined}
                        anchor={wrapperRef}
                    >
                        {selectableOptions.map((opt, idx) => (
                            <ComboboxOption
                                key={opt.value}
                                active={idx === activeIndex}
                                selected={opt.value === value}
                                disabled={opt.disabled}
                                onClick={() => handleSelect(opt)}
                                onMouseEnter={() => setActiveIndex(idx)}
                            >
                                {opt.label}
                            </ComboboxOption>
                        ))}
                    </ComboboxDropdown>
                ) : null}
            </div>

            {showErrorMessage ? (
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
