"use client";

import * as React from "react";

import { Avatar } from "./Avatar";
import type { MediaComment } from "./MediaTypes";

/**
 * Props do {@link Comment}.
 *
 * Renderiza um comentário em layout denso: avatar pequeno + bloco de
 * texto (autor, identificador, hora, corpo). Pensado para listagens
 * em galerias e modais de carrossel, mas reutilizável em qualquer
 * contexto que precise exibir uma "linha de comentário".
 *
 * Nenhuma prop carrega nomes de entidades de domínio (Property 29).
 */
export interface CommentProps {
    /** Dados do comentário no formato compartilhado pelos primitivos. */
    comment: MediaComment;
    /** Classes extras aplicadas ao container. */
    className?: string;
}

/**
 * Comment — linha de comentário densa.
 *
 * Visual: avatar 32px (`size="sm"`), header inline com nome e
 * identificador em peso medium + tempo relativo em texto disabled,
 * texto do comentário em `text-sm` com leading levemente folgado.
 */
export function Comment({
    comment,
    className,
}: CommentProps): React.ReactElement {
    return (
        <div
            className={[
                "flex items-start gap-2.5",
                className ?? "",
            ]
                .filter(Boolean)
                .join(" ")}
        >
            <Avatar
                src={comment.authorPhotoUrl}
                name={comment.authorName}
                size="sm"
            />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <div className="flex items-baseline gap-1.5">
                    <span className="truncate text-xs font-semibold tracking-tight text-text-primary">
                        {comment.authorName}
                    </span>
                    <span className="truncate text-xs text-text-disabled">
                        @{comment.authorIdentifier} · {comment.timeAgo}
                    </span>
                </div>
                <p className="whitespace-pre-line break-words text-sm leading-relaxed text-text-primary">
                    {comment.text}
                </p>
            </div>
        </div>
    );
}

/**
 * Props do {@link CommentInput}.
 *
 * Campo de envio de comentário. Componente controlado: o consumidor
 * mantém `value` e recebe `onChange` + `onSubmit` (chamado quando o
 * usuário aperta Enter ou clica no botão de enviar).
 *
 * Mantém-se simples por design — sem mentions, emojis ou anexos por
 * enquanto. Adicionar essas features depois é uma extensão deste
 * primitivo.
 */
export interface CommentInputProps {
    /** Valor atual do campo. */
    value: string;
    /** Callback ao alterar o texto. */
    onChange: (next: string) => void;
    /**
     * Callback ao confirmar (Enter ou botão "Enviar"). Recebe o
     * valor atual; o consumidor é responsável por limpar via
     * `onChange("")` após persistir.
     */
    onSubmit: (text: string) => void;
    /** Quando `true`, desabilita o campo e o botão. */
    disabled?: boolean;
    /** Texto do placeholder. Padrão: `"Adicione um comentário..."`. */
    placeholder?: string;
    /**
     * Avatar do usuário que está comentando, exibido à esquerda do
     * campo. Quando ausente, o input ocupa toda a largura.
     */
    authorPhotoUrl?: string | null;
    /** Nome do autor para o fallback do Avatar. */
    authorName?: string;
    /** Classes extras aplicadas ao container. */
    className?: string;
}

/**
 * CommentInput — campo de envio de comentário.
 *
 * Visual: avatar pequeno + textarea auto-resize de 1 linha + botão
 * "Enviar" sólido em primary, alinhados em uma única faixa. Em
 * mobile, o botão se torna ícone-só pra economizar espaço.
 */
export function CommentInput({
    value,
    onChange,
    onSubmit,
    disabled = false,
    placeholder = "Adicione um comentário…",
    authorPhotoUrl,
    authorName,
    className,
}: CommentInputProps): React.ReactElement {
    const trimmed = value.trim();
    const canSubmit = !disabled && trimmed.length > 0;

    function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>): void {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if (canSubmit) onSubmit(trimmed);
        }
    }

    function handleSubmit(): void {
        if (canSubmit) onSubmit(trimmed);
    }

    return (
        <form
            onSubmit={(e) => {
                e.preventDefault();
                handleSubmit();
            }}
            className={[
                "flex items-start gap-2",
                className ?? "",
            ]
                .filter(Boolean)
                .join(" ")}
        >
            {authorPhotoUrl !== undefined ? (
                <Avatar
                    src={authorPhotoUrl}
                    name={authorName}
                    size="sm"
                    className="mt-1"
                />
            ) : null}
            <div className="flex min-w-0 flex-1 items-end gap-2 rounded-full border border-neutral-200 bg-surface px-3 py-1.5 focus-within:border-primary-300 focus-within:ring-2 focus-within:ring-primary-500/30">
                <textarea
                    rows={1}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={disabled}
                    placeholder={placeholder}
                    aria-label="Comentário"
                    className="min-w-0 flex-1 resize-none bg-transparent text-sm text-text-primary placeholder:text-text-disabled focus:outline-none disabled:opacity-60"
                />
                <button
                    type="submit"
                    disabled={!canSubmit}
                    className="flex-none rounded-full bg-primary-600 px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 disabled:cursor-not-allowed disabled:opacity-40"
                >
                    Enviar
                </button>
            </div>
        </form>
    );
}
