"use client";

import * as React from "react";

import { MapPinIcon, MicIcon, StarIcon } from "../icons";

/**
 * Variante visual do {@link ProfileFeedCard}.
 *
 * - `"overlay"`: foto preenche todo o card, gradiente warm na base
 *   com nome/identificador/local sobrepostos. Bom pra fileiras
 *   horizontais densas onde a leitura precisa ser rápida.
 * - `"split"` (padrão): foto 3:4 no topo + área branca embaixo com
 *   nome, idade-like (placeholder), localização, áudio inline (se
 *   houver) e preço destacado. Mais "completinho", inspirado em
 *   listagens de produto.
 */
export type ProfileFeedCardVariant = "overlay" | "split";

/**
 * Props do {@link ProfileFeedCard}.
 *
 * Card de listagem clicável. Inteiramente coberto por um `<a>`
 * (sem botões internos pra evitar conflito de hit-area). Suporta
 * duas variantes visuais (`split`/`overlay`) que partilham o mesmo
 * contrato.
 *
 * Nenhuma prop carrega nomes de entidades de domínio (Property 29).
 */
export interface ProfileFeedCardProps {
    /** Destino do link. */
    href: string;
    /** Nome de exibição. */
    name: string;
    /** Handle público (sem o `@`). */
    identifier: string;
    /** URL da foto principal. Quando ausente, exibe placeholder. */
    photoUrl?: string | null;
    /** Cidade. */
    cityName: string;
    /** Sigla da UF. */
    stateSigla: string;
    /** Bairro opcional. */
    neighborhood?: string | null;
    /**
     * Badge renderizado no topo-esquerdo (sobre a foto). Tipicamente
     * um {@link RankBadge}. Decisão de label/ícone fica com o
     * consumidor para o primitivo não conhecer o vocabulário de
     * domínio.
     */
    badge?: React.ReactNode;
    /** Total de visualizações. Usado em variant `"overlay"`. */
    viewsCount?: number;
    /** Média de avaliação (0..5). Quando 0/ausente, omite. */
    rating?: number;
    /** Total de avaliações pra exibir entre parênteses. */
    ratingCount?: number;
    /**
     * Preço pré-formatado (ex.: `"R$ 350,00"`). Renderizado no
     * rodapé do card em variant `"split"`. Consumidor decide o
     * texto ("a partir de" etc) via {@link priceCaption}.
     */
    priceLabel?: string;
    /** Texto pequeno acima do preço, ex.: "a partir de". */
    priceCaption?: string;
    /**
     * Quando `true`, exibe um chip "Áudio" perto do nome em variant
     * `"split"` indicando que o perfil tem áudio publicado.
     */
    hasAudio?: boolean;
    /** Variante visual. Padrão: `"split"`. */
    variant?: ProfileFeedCardVariant;
    /**
     * Forma do tile de foto. Padrão: `"portrait"` (3:4) — usado em
     * ambos os variants.
     */
    aspect?: "portrait" | "square";
    /** Classes extras aplicadas ao container. */
    className?: string;
}

const ASPECT_CLASSES: Record<
    NonNullable<ProfileFeedCardProps["aspect"]>,
    string
> = {
    portrait: "aspect-[3/4]",
    square: "aspect-square",
};

/**
 * ProfileFeedCard — card poster pra listagens de descoberta.
 *
 * Visual:
 *
 * - **`split`**: container `rounded-3xl border` com foto no topo
 *   (cantos superiores arredondados) + área branca com info densa.
 *   Hover faz a imagem dar zoom suave (`scale-[1.03]`).
 * - **`overlay`**: foto fullbleed com gradiente na base e meta
 *   sobreposta. Pílulas pequenas no topo direito mostram rating e
 *   views. Bom pra carrosséis horizontais.
 */
export function ProfileFeedCard({
    href,
    name,
    identifier,
    photoUrl,
    cityName,
    stateSigla,
    neighborhood,
    badge,
    viewsCount,
    rating,
    ratingCount,
    priceLabel,
    priceCaption,
    hasAudio = false,
    variant = "split",
    aspect = "portrait",
    className,
}: ProfileFeedCardProps): React.ReactElement {
    const showRating = typeof rating === "number" && rating > 0;
    const showViews = typeof viewsCount === "number" && viewsCount > 0;

    if (variant === "overlay") {
        const localPrincipal = neighborhood ?? cityName;
        const localSecundario = neighborhood
            ? `${cityName} · ${stateSigla}`
            : stateSigla;

        return (
            <a
                href={href}
                aria-label={`Ver perfil de ${name}`}
                className={[
                    "group relative block overflow-hidden rounded-3xl border border-border bg-surface",
                    "transition-transform duration-200 hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-300",
                    className ?? "",
                ]
                    .filter(Boolean)
                    .join(" ")}
            >
                <div
                    className={[
                        "relative w-full bg-neutral-100",
                        ASPECT_CLASSES[aspect],
                    ].join(" ")}
                >
                    {photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={photoUrl}
                            alt={name}
                            loading="lazy"
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                        />
                    ) : (
                        <PhotoPlaceholder name={name} />
                    )}
                    <span
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/70 via-black/20 to-transparent"
                    />

                    {(showRating || showViews) ? (
                        <div className="pointer-events-none absolute right-2 top-2 flex flex-wrap items-center gap-1.5">
                            {showRating ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[0.7rem] font-semibold text-white backdrop-blur-sm">
                                    <StarIcon size={11} />
                                    {rating!.toFixed(1)}
                                </span>
                            ) : null}
                        </div>
                    ) : null}

                    {badge != null ? (
                        <div className="pointer-events-none absolute left-2 top-2">
                            {badge}
                        </div>
                    ) : null}

                    <div className="absolute inset-x-0 bottom-0 flex flex-col gap-0.5 p-3 text-white">
                        <span className="text-base font-semibold tracking-tight leading-tight">
                            {name}
                        </span>
                        <span className="text-[0.7rem] text-white/80">
                            @{identifier}
                        </span>
                        <span className="mt-1 inline-flex items-center gap-1 text-xs text-white/90">
                            <MapPinIcon size={11} />
                            <span className="truncate">
                                <span className="font-medium">
                                    {localPrincipal}
                                </span>
                                <span className="text-white/70">
                                    {" "}
                                    · {localSecundario}
                                </span>
                            </span>
                        </span>
                    </div>
                </div>
            </a>
        );
    }

    // variant === "split"
    return (
        <a
            href={href}
            aria-label={`Ver perfil de ${name}`}
            className={[
                "group relative flex flex-col overflow-hidden rounded-3xl border border-border bg-surface",
                "transition-all duration-200 hover:-translate-y-0.5 hover:border-primary-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-300",
                className ?? "",
            ]
                .filter(Boolean)
                .join(" ")}
        >
            {/* Foto */}
            <div
                className={[
                    "relative w-full overflow-hidden bg-neutral-100",
                    ASPECT_CLASSES[aspect],
                ].join(" ")}
            >
                {photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={photoUrl}
                        alt={name}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                    />
                ) : (
                    <PhotoPlaceholder name={name} />
                )}

                {badge != null ? (
                    <div className="absolute left-3 top-3">{badge}</div>
                ) : null}
            </div>

            {/* Bloco de info */}
            <div className="flex flex-1 flex-col gap-2 p-4">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-col gap-0.5">
                        <span className="truncate text-base font-semibold leading-tight tracking-tight text-text-primary">
                            {name}
                        </span>
                        <span className="text-[0.7rem] text-text-secondary">
                            @{identifier}
                        </span>
                    </div>
                    {showRating ? (
                        <span className="flex shrink-0 items-center gap-1 text-xs">
                            <StarIcon
                                size={12}
                                className="text-secondary-400"
                            />
                            <span className="font-semibold tabular-nums text-text-primary">
                                {rating!.toFixed(1)}
                            </span>
                            {typeof ratingCount === "number" &&
                                ratingCount > 0 ? (
                                <span className="text-text-secondary">
                                    ({ratingCount})
                                </span>
                            ) : null}
                        </span>
                    ) : null}
                </div>

                <span className="inline-flex items-center gap-1 text-xs text-text-secondary">
                    <MapPinIcon size={12} />
                    <span className="truncate">
                        {neighborhood ? `${neighborhood} · ` : ""}
                        {cityName} · {stateSigla}
                    </span>
                </span>

                {hasAudio ? (
                    <span className="inline-flex w-max items-center gap-1 rounded-full border border-border bg-surface-muted px-2 py-0.5 text-[0.7rem] font-medium text-text-secondary">
                        <MicIcon size={11} />
                        Tem áudio
                    </span>
                ) : null}

                {priceLabel ? (
                    <div className="mt-auto flex items-baseline gap-1.5 border-t border-border pt-3">
                        {priceCaption ? (
                            <span className="text-[0.7rem] text-text-secondary">
                                {priceCaption}
                            </span>
                        ) : null}
                        <span className="text-lg font-semibold tabular-nums text-primary-700">
                            {priceLabel}
                        </span>
                    </div>
                ) : null}
            </div>
        </a>
    );
}

function PhotoPlaceholder({ name }: { name: string }): React.ReactElement {
    return (
        <div
            aria-hidden="true"
            className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary-100 to-secondary-100 text-primary-700"
        >
            <span className="text-3xl font-semibold tracking-tight">
                {name.charAt(0).toUpperCase()}
            </span>
        </div>
    );
}
