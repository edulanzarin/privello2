"use client";

import * as React from "react";

import { ArrowRightIcon } from "../icons";

/**
 * Props do {@link SearchInput}.
 *
 * Input de busca proeminente com ícone leading, botão de submit
 * integrado à direita e sombra suave. Visualmente destaca-se de
 * `Input` padrão por ser o "convite" central de uma página de
 * descoberta — fica grande, com borda generosa e foco amplo.
 *
 * O componente é controlado: pai mantém `value`, recebe atualizações
 * via `onChange` e submissão final via `onSubmit`. `onSubmit` é
 * disparado tanto pelo botão quanto por `Enter` no input.
 *
 * Nenhuma prop carrega nomes de entidades de domínio (Property 29).
 */
export interface SearchInputProps {
    value: string;
    onChange: (next: string) => void;
    /**
     * Disparado ao submeter (botão de seta ou tecla Enter). Recebe
     * o `value` atual já trimmed para conveniência.
     */
    onSubmit?: (value: string) => void;
    /** Placeholder do input. Padrão: `"Buscar"`. */
    placeholder?: string;
    /** Ícone leading. Quando ausente, sem ícone. */
    icon?: React.ReactNode;
    /** Rótulo acessível do input. Não é exibido visualmente. */
    "aria-label"?: string;
    /** Rótulo acessível do botão de submit. Padrão: `"Buscar"`. */
    submitLabel?: string;
    /** Quando `true`, desabilita input e botão. */
    disabled?: boolean;
    /** Classes extras aplicadas ao container externo. */
    className?: string;
    /** Quando `true`, oculta o botão de submit (atalho só por Enter). */
    hideSubmit?: boolean;
}

/**
 * SearchInput — campo de busca grande com botão integrado.
 *
 * Visual: pill com `rounded-full`, padding generoso, borda fina e
 * sombra suave que ganha destaque no focus-within. Botão circular à
 * direita com ícone de seta, levemente menor que o pill.
 */
export function SearchInput({
    value,
    onChange,
    onSubmit,
    placeholder = "Buscar",
    icon,
    "aria-label": ariaLabel,
    submitLabel = "Buscar",
    disabled = false,
    className,
    hideSubmit = false,
}: SearchInputProps): React.ReactElement {
    const inputRef = React.useRef<HTMLInputElement>(null);

    function handleSubmit(): void {
        if (disabled) return;
        onSubmit?.(value.trim());
    }

    function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
        if (e.key === "Enter") {
            e.preventDefault();
            handleSubmit();
        }
    }

    return (
        <div
            className={[
                "group relative flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 transition-all duration-200",
                "focus-within:border-primary-400 focus-within:ring-2 focus-within:ring-primary-100",
                disabled ? "opacity-60 pointer-events-none" : "",
                className ?? "",
            ]
                .filter(Boolean)
                .join(" ")}
        >
            {icon != null ? (
                <span
                    aria-hidden="true"
                    className="flex h-5 w-5 flex-none items-center justify-center text-text-secondary"
                >
                    {icon}
                </span>
            ) : null}
            <input
                ref={inputRef}
                type="search"
                inputMode="search"
                autoComplete="off"
                aria-label={ariaLabel ?? placeholder}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                disabled={disabled}
                className="min-w-0 flex-1 bg-transparent text-base text-text-primary placeholder:text-text-disabled focus:outline-none"
            />
            {!hideSubmit ? (
                <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={disabled}
                    aria-label={submitLabel}
                    className="inline-flex h-9 w-9 flex-none items-center justify-center rounded-full bg-primary-500 text-white transition-colors hover:bg-primary-600 disabled:bg-neutral-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
                >
                    <ArrowRightIcon size={16} />
                </button>
            ) : null}
        </div>
    );
}
