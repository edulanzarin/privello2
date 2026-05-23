"use client";

import * as React from "react";

/**
 * Props do componente {@link FileUpload}.
 *
 * Componente de upload estilizado que esconde o `<input type="file">`
 * nativo e exibe uma área de drop/clique com ícone, texto e preview
 * do nome do arquivo selecionado. Nenhuma prop carrega nomes de
 * entidades de domínio (Property 29).
 */
export interface FileUploadProps {
    /** Nome do campo no FormData. */
    name: string;
    /** Rótulo visível acima da área de upload. */
    label?: React.ReactNode;
    /** Tipos MIME aceitos (ex: "image/jpeg,image/png,image/webp"). */
    accept?: string;
    /** Quando `true`, marca o campo como inválido. */
    error?: boolean;
    /** Mensagem de erro exibida abaixo. */
    errorMessage?: React.ReactNode;
    /** Texto auxiliar exibido abaixo quando não há erro. */
    hint?: React.ReactNode;
    /** Quando `true`, desabilita a interação. */
    disabled?: boolean;
    /** Quando `true`, campo é obrigatório. */
    required?: boolean;
    /** Callback quando um arquivo é selecionado. */
    onChange?: (file: File | null) => void;
}

/**
 * FileUpload primitivo — área de upload estilizada com drag visual,
 * ícone de câmera e preview do nome do arquivo.
 */
export function FileUpload({
    name,
    label,
    accept,
    error = false,
    errorMessage,
    hint,
    disabled = false,
    required = false,
    onChange,
}: FileUploadProps): React.ReactElement {
    const inputRef = React.useRef<HTMLInputElement>(null);
    const [fileName, setFileName] = React.useState<string | null>(null);
    const generatedId = React.useId();
    const inputId = `privello-file-${generatedId}`;
    const errorId = `${inputId}-error`;
    const hintId = `${inputId}-hint`;

    const showError = Boolean(error) && Boolean(errorMessage);
    const showHint = !showError && Boolean(hint);

    function handleChange(e: React.ChangeEvent<HTMLInputElement>): void {
        const file = e.target.files?.[0] ?? null;
        setFileName(file?.name ?? null);
        onChange?.(file);
    }

    function handleClick(): void {
        if (!disabled) {
            inputRef.current?.click();
        }
    }

    function handleKeyDown(e: React.KeyboardEvent): void {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleClick();
        }
    }

    const borderColor = error
        ? "border-danger-400"
        : fileName
            ? "border-secondary-300"
            : "border-neutral-200 border-dashed";

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

            <div
                role="button"
                tabIndex={disabled ? -1 : 0}
                onClick={handleClick}
                onKeyDown={handleKeyDown}
                aria-disabled={disabled || undefined}
                className={[
                    "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 bg-surface px-4 py-6 text-center transition-colors duration-150",
                    "hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30",
                    disabled && "cursor-not-allowed opacity-50",
                    borderColor,
                ]
                    .filter(Boolean)
                    .join(" ")}
            >
                {/* Ícone de câmera */}
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-neutral-100 text-text-secondary">
                    <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.75"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                    >
                        <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z" />
                        <circle cx="12" cy="13" r="3" />
                    </svg>
                </span>

                {fileName ? (
                    <span className="text-sm font-medium text-text-primary">
                        {fileName}
                    </span>
                ) : (
                    <>
                        <span className="text-sm font-medium text-text-primary">
                            Clique para escolher uma foto
                        </span>
                        <span className="text-xs text-text-secondary">
                            JPEG, PNG ou WEBP · até 10 MB
                        </span>
                    </>
                )}
            </div>

            <input
                ref={inputRef}
                id={inputId}
                type="file"
                name={name}
                accept={accept}
                disabled={disabled}
                required={required}
                onChange={handleChange}
                className="sr-only"
                aria-invalid={error || undefined}
                aria-describedby={
                    showError ? errorId : showHint ? hintId : undefined
                }
            />

            {showError && (
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
