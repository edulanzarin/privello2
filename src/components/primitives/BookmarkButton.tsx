"use client";

import * as React from "react";

import { BookmarkIcon } from "../icons";

/**
 * Tamanhos do {@link BookmarkButton}.
 */
export type BookmarkButtonSize = "sm" | "md" | "lg";

/**
 * Tom visual.
 *
 * - `"neutral"` (padrão): fundo `surface` com borda hairline,
 *   ícone outline → fill warm quando marcado. Pra usar em
 *   ProfileHeader e cards.
 * - `"onDark"`: chip translúcido glass (similar ao LikeButton
 *   sobre fotos). Pra overlay em mídia.
 */
export type BookmarkButtonTone = "neutral" | "onDark";

/**
 * Props do {@link BookmarkButton}.
 *
 * Botão de toggle "salvar / desmarcar". Componente controlado:
 * caller mantém `marked` e recebe `onChange` com o novo estado.
 *
 * Visual: ícone bookmark — outline quando off, fill warm quando
 * on. Animação leve "pop" no clique. Quando carrega
 * (`disabled={true}` durante o request), opacidade reduzida.
 *
 * Nenhuma prop carrega nomes de entidades de domínio (Property 29).
 */
export interface BookmarkButtonProps {
    /** Estado atual: `true` se já está marcado. */
    marked: boolean;
    /**
     * Callback ao clicar. Recebe o **novo** estado (oposto do
     * `marked` atual). O caller persiste e atualiza a prop em
     * retorno.
     */
    onChange?: (next: boolean) => void;
    /** Tamanho. Padrão: `"md"`. */
    size?: BookmarkButtonSize;
    /** Tom visual. Padrão: `"neutral"`. */
    tone?: BookmarkButtonTone;
    /** Quando `true`, desabilita o botão. */
    disabled?: boolean;
    /**
     * Rótulo acessível custom. Default: muda conforme `marked`
     * ("Salvar perfil" / "Remover dos salvos").
     */
    "aria-label"?: string;
    /** Classes extras. */
    className?: string;
}

const SIZE_CLASSES: Record<BookmarkButtonSize, { box: string; icon: number }> =
{
    sm: { box: "h-8 w-8", icon: 14 },
    md: { box: "h-10 w-10", icon: 16 },
    lg: { box: "h-11 w-11", icon: 18 },
};

/**
 * BookmarkButton — botão circular de toggle "Salvar".
 *
 * Visual: ícone bookmark animado (outline → fill warm). Hover
 * suave. Clique faz pop scale.
 */
export function BookmarkButton({
    marked,
    onChange,
    size = "md",
    tone = "neutral",
    disabled = false,
    "aria-label": ariaLabel,
    className,
}: BookmarkButtonProps): React.ReactElement {
    const dims = SIZE_CLASSES[size];
    const [animKey, setAnimKey] = React.useState(0);

    function handleClick(): void {
        if (disabled) return;
        setAnimKey((k) => k + 1);
        onChange?.(!marked);
    }

    const labelEffective =
        ariaLabel ?? (marked ? "Remover dos salvos" : "Salvar perfil");

    const composed = [
        "inline-flex flex-none items-center justify-center rounded-full transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:opacity-60 disabled:cursor-not-allowed",
        dims.box,
        tone === "onDark"
            ? marked
                ? "bg-white/15 text-accent ring-1 ring-white/20 backdrop-blur-md"
                : "bg-white/10 text-white ring-1 ring-white/15 backdrop-blur-md hover:bg-white/20"
            : marked
                ? "border border-accent/40 bg-accent-soft text-accent-deep"
                : "border border-border bg-surface text-text-secondary hover:border-accent/35 hover:text-accent-deep",
        className ?? "",
    ]
        .filter(Boolean)
        .join(" ");

    return (
        <button
            type="button"
            onClick={handleClick}
            disabled={disabled}
            aria-pressed={marked}
            aria-label={labelEffective}
            title={labelEffective}
            className={composed}
        >
            <span
                key={animKey}
                aria-hidden="true"
                className={marked ? "animate-pop" : undefined}
            >
                <BookmarkIcon
                    size={dims.icon}
                    style={
                        marked
                            ? { fill: "currentColor", fillOpacity: 0.85 }
                            : undefined
                    }
                />
            </span>
        </button>
    );
}
