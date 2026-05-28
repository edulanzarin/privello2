"use client";

import * as React from "react";

import { HeartIcon } from "../icons";

/**
 * Tamanhos canônicos do {@link LikeButton}.
 *
 * - `"sm"` (16px ícone): para overlays compactos em thumbnails.
 * - `"md"` (20px ícone): padrão; cabeçalhos de mídia, comentários.
 * - `"lg"` (24px ícone): destaque em galerias/carrossel.
 */
export type LikeButtonSize = "sm" | "md" | "lg";

/**
 * Props do {@link LikeButton}.
 *
 * Botão de "curtir" com ícone de coração que toggle entre estados.
 * Componente controlado: o consumidor mantém `liked` e recebe o
 * `onChange` para persistir a mudança no servidor. O contador
 * `count` é exibido ao lado do ícone (opcional).
 *
 * Animação leve: o ícone faz "pop" no clique. O preenchimento é
 * controlado pelo estado `liked` (rosa cheio quando curtido, traço
 * fino quando não).
 *
 * Nenhuma prop carrega nomes de entidades de domínio (Property 29).
 */
export interface LikeButtonProps {
    /** Estado atual: `true` se o usuário já curtiu. */
    liked: boolean;
    /** Total de curtidas exibido ao lado do ícone. */
    count?: number;
    /**
     * Callback chamado ao clicar. Recebe o **novo** estado (oposto
     * do `liked` atual). O consumidor é responsável por persistir e
     * atualizar a prop `liked` em retorno.
     */
    onChange?: (next: boolean) => void;
    /** Tamanho. Padrão: `"md"`. */
    size?: LikeButtonSize;
    /**
     * Tom do botão. Padrão: `"default"` (cores neutras pra fundos
     * claros). Use `"onDark"` quando o botão fica sobre uma mídia
     * (carrossel/Story) — texto e ícone ficam brancos quando não
     * curtido, e o coração fica salmão quente quando curtido,
     * legível sobre qualquer foto.
     */
    tone?: "default" | "onDark";
    /** Quando `true`, desabilita o botão. */
    disabled?: boolean;
    /** Classes extras aplicadas ao container. */
    className?: string;
    /**
     * Rótulo acessível alternativo. Default: `"Curtir"`/`"Descurtir"`.
     */
    "aria-label"?: string;
}

const SIZE_CLASSES: Record<
    LikeButtonSize,
    { icon: number; text: string; gap: string }
> = {
    sm: { icon: 14, text: "text-xs", gap: "gap-1" },
    md: { icon: 18, text: "text-sm", gap: "gap-1.5" },
    lg: { icon: 22, text: "text-base", gap: "gap-2" },
};

/**
 * LikeButton — toggle de curtir com contador opcional.
 *
 * Visual: ícone `HeartIcon` que muda entre `text-text-secondary`
 * (não curtido) e `text-danger-600` (curtido) com um pequeno bounce
 * no toggle. Ícone preenchido no estado curtido via `currentColor`
 * + `fillOpacity` no SVG.
 */
export function LikeButton({
    liked,
    count,
    onChange,
    size = "md",
    tone = "default",
    disabled = false,
    className,
    "aria-label": ariaLabel,
}: LikeButtonProps): React.ReactElement {
    const dims = SIZE_CLASSES[size];
    const [animKey, setAnimKey] = React.useState(0);

    function handleClick(): void {
        if (disabled) return;
        setAnimKey((k) => k + 1);
        onChange?.(!liked);
    }

    return (
        <button
            type="button"
            onClick={handleClick}
            disabled={disabled}
            aria-pressed={liked}
            aria-label={ariaLabel ?? (liked ? "Descurtir" : "Curtir")}
            className={[
                "inline-flex items-center transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/40 focus-visible:rounded-full disabled:opacity-60 disabled:cursor-not-allowed",
                tone === "onDark"
                    ? [
                        "rounded-full bg-black/55 px-3 py-1.5 backdrop-blur-sm",
                        liked ? "text-rose-400" : "text-white hover:text-rose-300",
                    ].join(" ")
                    : liked
                        ? "text-danger-600"
                        : "text-text-secondary hover:text-danger-600",
                dims.gap,
                className ?? "",
            ]
                .filter(Boolean)
                .join(" ")}
        >
            <span
                key={animKey}
                aria-hidden="true"
                className={liked ? "animate-pop" : undefined}
            >
                <HeartIcon
                    size={dims.icon}
                    style={
                        liked
                            ? { fill: "currentColor", fillOpacity: 0.85 }
                            : undefined
                    }
                />
            </span>
            {count !== undefined ? (
                <span
                    className={[
                        "tabular-nums font-medium",
                        dims.text,
                    ].join(" ")}
                >
                    {count}
                </span>
            ) : null}
        </button>
    );
}
