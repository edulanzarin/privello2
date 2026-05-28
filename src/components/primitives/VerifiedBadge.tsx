"use client";

import * as React from "react";

import { VerifiedBadgeIcon } from "../icons";

/**
 * Tamanhos disponíveis para o {@link VerifiedBadge}.
 *
 * - `"sm"`: 14px — ao lado do nome em cards (feed).
 * - `"md"`: 18px — header de perfil.
 * - `"lg"`: 22px — destaque maior (raro).
 */
export type VerifiedBadgeSize = "sm" | "md" | "lg";

/**
 * Props do {@link VerifiedBadge}.
 *
 * Selo de identidade verificada — mostra um sinal cravado em
 * `primary-500` com o check branco interno. Aparece ao lado do
 * nome em todos os pontos onde o perfil é renderizado: header
 * público, card do feed, header de chat etc.
 *
 * Apenas perfis com identidade aprovada pelo admin recebem o
 * selo. A regra fica no servidor (`AcompanhanteProfile.verificada`),
 * o componente só pinta.
 */
export interface VerifiedBadgeProps
    extends Omit<React.HTMLAttributes<HTMLSpanElement>, "title"> {
    /** Tamanho visual. Padrão: `"md"`. */
    size?: VerifiedBadgeSize;
    /**
     * Texto da tooltip nativa. Padrão: `"Identidade verificada"`.
     * Tornar configurável permite reuso em outros idiomas no futuro.
     */
    title?: string;
}

const SIZE_PX: Record<VerifiedBadgeSize, number> = {
    sm: 14,
    md: 18,
    lg: 22,
};

/**
 * VerifiedBadge — selo "verificado" em formato de roseta com check.
 *
 * Visual: roseta `primary-500` com check branco. Inline-flex pra
 * alinhar com o baseline do texto adjacente. `aria-label` repete
 * o `title` pra leitores de tela.
 */
export function VerifiedBadge({
    size = "md",
    title = "Identidade verificada",
    className,
    ...rest
}: VerifiedBadgeProps): React.ReactElement {
    const composed = [
        "inline-flex flex-none items-center justify-center text-[color:var(--accent)]",
        className ?? "",
    ]
        .filter(Boolean)
        .join(" ");

    return (
        <span
            {...rest}
            className={composed}
            title={title}
            aria-label={title}
            role="img"
        >
            <VerifiedBadgeIcon size={SIZE_PX[size]} />
        </span>
    );
}
