"use client";

import * as React from "react";

import { EyeIcon, MapPinIcon, StarIcon } from "../icons";

/**
 * Props do {@link ProfileFeedCard}.
 *
 * Card vertical "tipo poster" usado em listagens de descoberta
 * (home, busca). Foto de proporção 3:4 ocupando o topo, gradiente
 * sutil pra contraste e um bloco de meta-informação sobreposto na
 * base com nome, identificador e localização. Métricas pequenas
 * (rating, views) ficam em pílulas no topo.
 *
 * Inteiramente clicável via `href` — renderiza um `<a>` que cobre
 * toda a área. Sem botões internos pra evitar conflito de hit-area.
 *
 * Nenhuma prop carrega nomes de entidades de domínio (Property 29).
 */
export interface ProfileFeedCardProps {
    /** Destino do link. Tipicamente `/acompanhantes/<slug>`. */
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
    /** Bairro opcional. Quando presente, vira a linha principal de local. */
    neighborhood?: string | null;
    /**
     * Badge renderizado no topo direito (sobre a foto). Tipicamente
     * um {@link RankBadge}. Decisão de label/ícone fica com o
     * consumidor para que o primitivo não precise conhecer o
     * vocabulário de domínio.
     */
    badge?: React.ReactNode;
    /** Total de visualizações para a pílula compacta no canto. */
    viewsCount?: number;
    /** Média de avaliação (0..5). Quando 0/ausente, omite. */
    rating?: number;
    /**
     * Forma do card. Padrão: `"portrait"` (3:4). `"square"` deixa
     * a foto 1:1 — útil pra fileiras horizontais menores.
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
 * - Container `rounded-3xl overflow-hidden` com hairline `border`.
 * - Foto preenche todo o card via `<img object-cover>`.
 * - Gradiente warm na base pra dar contraste à meta.
 * - Meta na base: nome em semibold + `@id` discreto + linha de
 *   localização (bairro · cidade UF).
 * - Pílulas pequenas no topo esquerdo: rating com estrela e views.
 * - Badge slot no topo direito.
 *
 * Sem hover-lift agressivo — apenas leve `scale` da imagem em
 * hover/focus pra dar vida sem destoar do feed editorial.
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
    aspect = "portrait",
    className,
}: ProfileFeedCardProps): React.ReactElement {
    const showRating = typeof rating === "number" && rating > 0;
    const showViews = typeof viewsCount === "number" && viewsCount > 0;
    const localPrincipal = neighborhood ?? cityName;
    const localSecundario = neighborhood ? `${cityName} · ${stateSigla}` : stateSigla;

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
            <div className={["relative w-full bg-neutral-100", ASPECT_CLASSES[aspect]].join(" ")}>
                {photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={photoUrl}
                        alt={name}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                ) : (
                    <div
                        aria-hidden="true"
                        className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary-100 to-secondary-100 text-primary-700"
                    >
                        <span className="text-3xl font-semibold tracking-tight">
                            {name.charAt(0).toUpperCase()}
                        </span>
                    </div>
                )}

                {/* Gradiente warm na base pra contraste do texto */}
                <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/70 via-black/20 to-transparent"
                />

                {/* Pílulas no topo esquerdo: rating + views */}
                {(showRating || showViews) ? (
                    <div className="pointer-events-none absolute left-2 top-2 flex flex-wrap items-center gap-1.5">
                        {showRating ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[0.7rem] font-semibold text-white backdrop-blur-sm">
                                <StarIcon size={11} />
                                {rating!.toFixed(1)}
                            </span>
                        ) : null}
                        {showViews ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[0.7rem] font-semibold text-white backdrop-blur-sm">
                                <EyeIcon size={11} />
                                {formatCompact(viewsCount!)}
                            </span>
                        ) : null}
                    </div>
                ) : null}

                {/* Badge slot no topo direito */}
                {badge != null ? (
                    <div className="pointer-events-none absolute right-2 top-2">
                        {badge}
                    </div>
                ) : null}

                {/* Meta na base: nome + @id + localização */}
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
                            <span className="font-medium">{localPrincipal}</span>
                            <span className="text-white/70"> · {localSecundario}</span>
                        </span>
                    </span>
                </div>
            </div>
        </a>
    );
}

function formatCompact(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
    return String(n);
}
