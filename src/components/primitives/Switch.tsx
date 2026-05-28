"use client";

import * as React from "react";

/**
 * Props do {@link Switch}.
 *
 * Toggle binário (sim/não) com rótulo. Renderiza um cartão clicável
 * inteiro: a área de toque cobre o label, descrição e o pingo do
 * switch, evitando alvos minúsculos em mobile. Por baixo dos panos
 * usa um `<input type="checkbox">` visualmente oculto para preservar
 * acessibilidade nativa (espaço/enter, integração com `<form>`,
 * leitores de tela).
 *
 * Visual: borda neutra fina por padrão; quando ligado, fundo levemente
 * tingido com `primary-50` + borda `primary-300`. Igual à estética
 * dos cartões/inputs do design system, sem destoar.
 *
 * Nenhuma prop carrega nomes de entidades de domínio (Property 29).
 */
export interface SwitchProps {
    /** Nome do campo no `FormData`. */
    name?: string;
    /** Rótulo principal. */
    label: React.ReactNode;
    /** Texto auxiliar exibido abaixo do rótulo. */
    description?: React.ReactNode;
    /** Estado controlado. */
    checked?: boolean;
    /** Estado inicial não controlado. */
    defaultChecked?: boolean;
    /** Callback quando o estado muda. */
    onChange?: (checked: boolean) => void;
    /** Quando `true`, marca como desabilitado. */
    disabled?: boolean;
    /** Quando `true`, marca como inválido. */
    error?: boolean;
    /** Mensagem de erro abaixo do cartão. */
    errorMessage?: React.ReactNode;
    /** Classes extras aplicadas ao cartão. */
    className?: string;
}

/**
 * Switch — toggle binário acessível em formato de cartão.
 *
 * Acessibilidade:
 * - O `<label>` envolve toda a área visível, então clicar em qualquer
 *   parte do cartão alterna o estado.
 * - Foco visível percorre o cartão via `focus-within` do checkbox
 *   nativo (`sr-only` mas sempre presente).
 * - `aria-invalid` espelha `error`; `aria-describedby` aponta para a
 *   mensagem de erro / descrição quando aplicável.
 */
export function Switch({
    name,
    label,
    description,
    checked,
    defaultChecked,
    onChange,
    disabled = false,
    error = false,
    errorMessage,
    className,
}: SwitchProps): React.ReactElement {
    const generatedId = React.useId();
    const inputId = `privello-switch-${generatedId}`;
    const errorId = `${inputId}-error`;
    const descId = `${inputId}-desc`;

    const isControlled = checked !== undefined;
    const [internal, setInternal] = React.useState<boolean>(
        defaultChecked ?? false,
    );
    const value = isControlled ? checked : internal;

    function handleChange(e: React.ChangeEvent<HTMLInputElement>): void {
        if (!isControlled) {
            setInternal(e.target.checked);
        }
        onChange?.(e.target.checked);
    }

    const showError = Boolean(error) && Boolean(errorMessage);

    const cardBase =
        "flex items-center gap-3 rounded-2xl border bg-surface px-4 py-3 transition-all duration-150 focus-within:ring-2 focus-within:ring-[color:var(--accent)]/30 focus-within:border-[color:var(--accent)]/50";
    const cardTone = error
        ? "border-danger-400"
        : value
            ? "border-[color:var(--accent)]/40 bg-[color:var(--accent-soft)]/40"
            : "border-border hover:border-[color:var(--accent)]/30";
    const cardDisabled = disabled
        ? "cursor-not-allowed opacity-60"
        : "cursor-pointer";

    const trackBase =
        "relative inline-flex h-6 w-11 flex-none items-center rounded-full transition-all duration-200";
    const trackTone = value
        ? "bg-gradient-to-r from-[color:var(--accent)] to-[color:var(--accent-deep)] shadow-[0_4px_12px_-4px_rgba(197,82,58,0.55)]"
        : "bg-neutral-300";

    const thumbBase =
        "inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200";
    const thumbPos = value ? "translate-x-[1.375rem]" : "translate-x-0.5";

    return (
        <div className={["flex flex-col gap-1.5", className ?? ""].filter(Boolean).join(" ")}>
            <label
                htmlFor={inputId}
                className={[cardBase, cardTone, cardDisabled].join(" ")}
            >
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-sm font-medium text-text-primary">
                        {label}
                    </span>
                    {description != null ? (
                        <span id={descId} className="text-xs text-text-secondary">
                            {description}
                        </span>
                    ) : null}
                </span>

                <span className={[trackBase, trackTone].join(" ")}>
                    <span
                        aria-hidden="true"
                        className={`${thumbBase} ${thumbPos}`}
                    />
                    <input
                        type="checkbox"
                        id={inputId}
                        name={name}
                        checked={value}
                        disabled={disabled}
                        onChange={handleChange}
                        aria-invalid={error || undefined}
                        aria-describedby={
                            showError
                                ? errorId
                                : description != null
                                    ? descId
                                    : undefined
                        }
                        className="sr-only"
                    />
                </span>
            </label>

            {showError ? (
                <p
                    id={errorId}
                    role="alert"
                    className="text-xs text-danger-700 animate-fade-in-soft"
                >
                    {errorMessage}
                </p>
            ) : null}
        </div>
    );
}
