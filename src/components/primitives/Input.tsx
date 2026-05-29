"use client";

import * as React from "react";

/**
 * Props do componente {@link Input}.
 *
 * Estende as props nativas de `<input>` (omitindo `size`, que conflitaria
 * com props visuais comuns), adicionando rótulo, texto auxiliar, estado
 * de erro acessível e ornamentos opcionais (ícones nas pontas).
 *
 * Nenhuma prop carrega nomes de entidades de domínio (Property 29).
 */
export interface InputProps
    extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
    /** Rótulo visível do campo, ligado via `htmlFor`. */
    label?: React.ReactNode;
    /** Texto auxiliar exibido abaixo do campo (mutuamente exclusivo com erro). */
    hint?: React.ReactNode;
    /** Quando `true`, marca o campo como inválido (`aria-invalid="true"`). */
    error?: boolean;
    /** Mensagem descritiva exibida quando `error` é truthy. */
    errorMessage?: React.ReactNode;
    /**
     * Conteúdo opcional renderizado no início do campo (ícone, prefixo).
     * Usa-se `padding-left` automático para acomodar.
     */
    leadingIcon?: React.ReactNode;
    /**
     * Conteúdo opcional renderizado no fim do campo (ícone, sufixo).
     * Usa-se `padding-right` automático para acomodar.
     */
    trailingIcon?: React.ReactNode;
}

/**
 * Input primitivo — visual Notion-like com paleta neutra, foco com ring
 * sutil e suporte a ornamentos nas pontas. Não conhece nenhuma entidade
 * de domínio.
 */
export function Input({
    id,
    label,
    hint,
    error = false,
    errorMessage,
    leadingIcon,
    trailingIcon,
    className,
    disabled = false,
    "aria-describedby": ariaDescribedBy,
    ...rest
}: InputProps): React.ReactElement {
    const generatedId = React.useId();
    const inputId = id ?? `privello-input-${generatedId}`;
    const errorId = `${inputId}-error`;
    const hintId = `${inputId}-hint`;

    const showErrorMessage = Boolean(error) && Boolean(errorMessage);
    const showHint = !showErrorMessage && Boolean(hint);

    const describedByParts = [
        ariaDescribedBy,
        showErrorMessage ? errorId : null,
        showHint ? hintId : null,
    ].filter((part): part is string => Boolean(part));
    const describedBy =
        describedByParts.length > 0 ? describedByParts.join(" ") : undefined;

    const base =
        "block w-full rounded-2xl border bg-surface py-2.5 text-sm text-text-primary placeholder:text-text-disabled transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-text-disabled";
    const tone = error
        ? "border-danger-400 focus-visible:ring-danger-500/30 focus-visible:border-danger-500"
        : "border-border focus-visible:ring-[#ec7b5b]/30 focus-visible:border-[color:var(--accent)] hover:border-[#ec7b5b]/40";
    const padding = [
        leadingIcon ? "pl-9" : "pl-3",
        trailingIcon ? "pr-9" : "pr-3",
    ].join(" ");

    return (
        <div className="flex flex-col gap-1.5">
            {label != null && (
                <label
                    htmlFor={inputId}
                    className="text-xs font-medium text-text-secondary"
                >
                    {label}
                </label>
            )}
            <div className="relative">
                {leadingIcon != null && (
                    <span
                        aria-hidden="true"
                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 flex h-4 w-4 items-center justify-center text-text-secondary"
                    >
                        {leadingIcon}
                    </span>
                )}
                <input
                    {...rest}
                    id={inputId}
                    disabled={disabled}
                    aria-invalid={error || undefined}
                    aria-describedby={describedBy}
                    className={[base, tone, padding, className ?? ""]
                        .filter(Boolean)
                        .join(" ")}
                />
                {trailingIcon != null && (
                    <span
                        aria-hidden="true"
                        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 flex h-4 w-4 items-center justify-center text-text-secondary"
                    >
                        {trailingIcon}
                    </span>
                )}
            </div>
            {showErrorMessage && (
                <p
                    id={errorId}
                    role="alert"
                    className="text-xs text-danger-700 animate-fade-in-soft"
                >
                    {errorMessage}
                </p>
            )}
            {showHint && (
                <p id={hintId} className="text-xs text-text-secondary">
                    {hint}
                </p>
            )}
        </div>
    );
}
