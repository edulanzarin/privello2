"use client";

import * as React from "react";

/**
 * Props do componente {@link AvatarUpload}.
 *
 * Upload de foto de perfil com preview circular. Ao selecionar um
 * arquivo, exibe a imagem imediatamente via `URL.createObjectURL`.
 * Aceita uma `initialPreviewUrl` opcional para casos em que o usuário
 * volta a uma tela onde já havia uma foto previamente carregada
 * (ex.: voltar ao step de foto durante o onboarding após upload),
 * exibindo a foto persistida em vez do placeholder vazio.
 *
 * Nenhuma prop carrega nomes de entidades de domínio (Property 29).
 */
export interface AvatarUploadProps {
    /** Nome do campo no FormData. */
    name: string;
    /** Rótulo visível acima do avatar. */
    label?: React.ReactNode;
    /** Tipos MIME aceitos. */
    accept?: string;
    /** Quando `true`, marca como inválido. */
    error?: boolean;
    /** Mensagem de erro. */
    errorMessage?: React.ReactNode;
    /** Texto auxiliar. */
    hint?: React.ReactNode;
    /** Desabilita interação. */
    disabled?: boolean;
    /** Campo obrigatório. */
    required?: boolean;
    /**
     * URL pré-existente exibida quando o componente monta sem que
     * nenhum arquivo tenha sido selecionado nesta sessão. Útil para
     * "voltar a uma tela com foto já enviada".
     */
    initialPreviewUrl?: string | null;
    /** Callback quando arquivo é selecionado. */
    onChange?: (file: File | null) => void;
}

/**
 * AvatarUpload — círculo clicável com preview de imagem. Estilo
 * consistente com o design system (bordas, cores, transições).
 */
export function AvatarUpload({
    name,
    label,
    accept,
    error = false,
    errorMessage,
    hint,
    disabled = false,
    required = false,
    initialPreviewUrl = null,
    onChange,
}: AvatarUploadProps): React.ReactElement {
    const inputRef = React.useRef<HTMLInputElement>(null);
    /**
     * URL gerada localmente (`createObjectURL`) ao escolher um arquivo
     * nesta sessão. `null` enquanto nenhum arquivo foi selecionado;
     * nesse caso caímos em `initialPreviewUrl` (foto persistida).
     */
    const [localPreview, setLocalPreview] = React.useState<string | null>(null);
    const preview = localPreview ?? initialPreviewUrl;
    const generatedId = React.useId();
    const inputId = `privello-avatar-${generatedId}`;
    const errorId = `${inputId}-error`;
    const hintId = `${inputId}-hint`;

    const showError = Boolean(error) && Boolean(errorMessage);
    const showHint = !showError && Boolean(hint);

    function handleChange(e: React.ChangeEvent<HTMLInputElement>): void {
        const file = e.target.files?.[0] ?? null;
        if (file) {
            const url = URL.createObjectURL(file);
            setLocalPreview(url);
        } else {
            setLocalPreview(null);
        }
        onChange?.(file);
    }

    // Cleanup object URL on unmount. Apenas a URL local — a
    // `initialPreviewUrl` é gerenciada pelo chamador.
    React.useEffect(() => {
        return () => {
            if (localPreview) URL.revokeObjectURL(localPreview);
        };
    }, [localPreview]);

    function handleClick(): void {
        if (!disabled) inputRef.current?.click();
    }

    function handleKeyDown(e: React.KeyboardEvent): void {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleClick();
        }
    }

    const ringColor = error
        ? "ring-danger-400"
        : preview
            ? "ring-accent/35"
            : "ring-neutral-200";

    return (
        <div className="flex flex-col items-center gap-3">
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
                aria-label="Escolher foto de perfil"
                className={[
                    "relative flex h-28 w-28 cursor-pointer items-center justify-center overflow-hidden rounded-full ring-2 transition-all duration-150",
                    "hover:ring-accent/50 focus:outline-none focus-visible:ring-4 focus-visible:ring-accent/30",
                    disabled && "cursor-not-allowed opacity-50",
                    ringColor,
                    preview ? "bg-neutral-900" : "bg-neutral-100",
                ]
                    .filter(Boolean)
                    .join(" ")}
            >
                {preview ? (
                    <img
                        src={preview}
                        alt="Preview da foto de perfil"
                        className="h-full w-full object-cover"
                    />
                ) : (
                    <div className="flex flex-col items-center gap-1 text-text-secondary">
                        <svg
                            width="24"
                            height="24"
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
                        <span className="text-[0.65rem]">Adicionar</span>
                    </div>
                )}

                {/* Overlay de hover */}
                {preview && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity hover:opacity-100">
                        <span className="text-xs font-medium text-white">
                            Trocar
                        </span>
                    </div>
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
