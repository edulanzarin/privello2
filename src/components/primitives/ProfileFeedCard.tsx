"use client";

import * as React from "react";

import { ImageIcon, MapPinIcon, MicIcon } from "../icons";

import { VerifiedBadge } from "./VerifiedBadge";

/**
 * Variante visual do {@link ProfileFeedCard}.
 *
 * - `"overlay"`: foto preenche todo o card, gradiente warm na base
 *   com nome/identificador/local sobrepostos. Bom pra fileiras
 *   horizontais densas onde a leitura precisa ser rápida.
 * - `"split"` (padrão): foto 3:4 no topo + área branca embaixo com
 *   nome, localização, descrição preview, áudio inline (slot) e
 *   rodapé com chips de meta + preço destacado.
 */
export type ProfileFeedCardVariant = "overlay" | "split";

/**
 * Props do {@link ProfileFeedCard}.
 *
 * Card de listagem clicável. Inteiramente coberto por um `<a>`
 * (sem botões internos competindo pelo hit-area, exceto pelo slot
 * `audio` que é o único elemento interativo aceito — o consumidor
 * é responsável por chamar `stopPropagation` no `onClick` do
 * player). Suporta duas variantes visuais (`split`/`overlay`) que
 * partilham o mesmo contrato.
 *
 * Decisão de design: o card **não exibe nota agregada nem
 * estrelas**. A leitura comparativa de notas favorece perfis
 * populares e penaliza injustamente perfis novos ou com poucas
 * avaliações. As avaliações detalhadas continuam acessíveis dentro
 * do perfil público — só a nota numérica/estrelas saiu da listagem.
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
     * Texto livre da bio. Renderizado em variant `"split"` com
     * truncamento de 2 linhas. Quando ausente/vazio, omite.
     */
    description?: string | null;
    /**
     * Badge renderizado no topo-esquerdo (sobre a foto). Tipicamente
     * um {@link RankBadge}. Decisão de label/ícone fica com o
     * consumidor para o primitivo não conhecer o vocabulário de
     * domínio.
     */
    badge?: React.ReactNode;
    /**
     * Preço pré-formatado (ex.: `"R$ 350,00"`). Renderizado no
     * rodapé do card em variant `"split"`. Consumidor decide o
     * texto ("a partir de" etc) via {@link priceCaption}.
     */
    priceLabel?: string;
    /** Texto pequeno acima do preço, ex.: "a partir de". */
    priceCaption?: string;
    /**
     * Quantidade de mídias publicadas pra a chip "N mídias". Quando
     * `0`/ausente, omite.
     */
    mediaCount?: number;
    /**
     * Slot opcional para player de áudio inline. Renderizado em
     * variant `"split"` logo após a descrição. Tipicamente um
     * {@link import("./AudioWavePlayer").AudioWavePlayer} com
     * `variant="mini"` e `stopPropagation`. Quando ausente, o
     * primitivo cai num chip estático "Áudio" se {@link hasAudio}
     * for `true`.
     */
    audio?: React.ReactNode;
    /**
     * Quando `true`, exibe um chip "Áudio" no rodapé indicando que
     * o perfil tem áudio publicado (mesmo sem `audio` slot
     * passado). Em variant `"split"`, se `audio` slot estiver
     * presente, este chip é suprimido pra evitar redundância.
     */
    hasAudio?: boolean;
    /** Variante visual. Padrão: `"split"`. */
    variant?: ProfileFeedCardVariant;
    /**
     * Quando `true`, renderiza o {@link VerifiedBadge} ao lado do
     * nome (e em variant `"overlay"`, ao lado do nome sobreposto).
     * Não muda o layout — só pinta o selo discreto.
     */
    verified?: boolean;
    /**
     * Quando `true`, exibe um indicador de "atividade recente"
     * (pontinho verde + label). O significado é definido pelo
     * consumidor via {@link activeLabel}; o primitivo só desenha.
     */
    active?: boolean;
    /** Texto do indicador de atividade. Padrão: `"Ativa hoje"`. */
    activeLabel?: string;
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
 *   (cantos superiores arredondados) + área branca densa embaixo.
 *   Hover faz a imagem dar zoom suave (`scale-[1.03]`). Bloco
 *   branco organizado em colunas:
 *
 *     1. **Header**: nome + `@id`.
 *     2. **Localização**: linha "bairro · cidade · UF".
 *     3. **Descrição**: bio em 2 linhas com `line-clamp-2`.
 *     4. **Áudio**: slot full-width quando consumidor passa.
 *     5. **Footer**: chips de meta (mídias, áudio) à esquerda;
 *        preço à direita, separados por hairline.
 *
 * - **`overlay`**: foto fullbleed com gradiente na base e meta
 *   sobreposta. Mantido pra carrosséis horizontais (futuro).
 */
export function ProfileFeedCard({
    href,
    name,
    identifier,
    photoUrl,
    cityName,
    stateSigla,
    neighborhood,
    description,
    badge,
    priceLabel,
    priceCaption,
    mediaCount,
    audio,
    hasAudio = false,
    variant = "split",
    verified = false,
    active = false,
    activeLabel = "Ativa hoje",
    aspect = "portrait",
    className,
}: ProfileFeedCardProps): React.ReactElement {
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
                    "transition-transform duration-200 hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/30",
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

                    {badge != null ? (
                        <div className="pointer-events-none absolute left-2 top-2">
                            {badge}
                        </div>
                    ) : null}

                    <div className="absolute inset-x-0 bottom-0 flex flex-col gap-0.5 p-3 text-white">
                        <span className="inline-flex items-center gap-1.5 text-base font-semibold tracking-tight leading-tight">
                            <span className="truncate">{name}</span>
                            {verified ? (
                                <VerifiedBadge size="sm" />
                            ) : null}
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
                "group relative flex flex-col overflow-hidden rounded-3xl border border-border bg-surface lift",
                "transition-all duration-300 hover:border-accent/30 hover:shadow-[0_18px_36px_-22px_rgba(26,20,16,0.25)] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
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
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.06]"
                    />
                ) : (
                    <PhotoPlaceholder name={name} />
                )}

                {/* Gradiente sutil base → topo, dá profundidade */}
                <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/40 via-black/0 to-transparent"
                />

                {badge != null ? (
                    <div className="absolute left-3 top-3">{badge}</div>
                ) : null}

                {/* Selo "verificada" no canto superior direito da foto */}
                {verified ? (
                    <div className="absolute right-3 top-3 glass-pill rounded-full px-2 py-1">
                        <VerifiedBadge size="sm" />
                    </div>
                ) : null}

                {/* Pílulas inferiores na foto: localização + nº mídias */}
                <div className="pointer-events-none absolute inset-x-3 bottom-3 flex flex-wrap items-center gap-1.5">
                    <span className="glass-pill inline-flex items-center gap-1 rounded-full px-2 py-1 text-[0.7rem] font-medium text-white">
                        <MapPinIcon size={11} />
                        <span className="truncate">
                            {neighborhood ? `${neighborhood}` : cityName}
                        </span>
                    </span>
                    {typeof mediaCount === "number" && mediaCount > 0 ? (
                        <span className="glass-pill inline-flex items-center gap-1 rounded-full px-2 py-1 text-[0.7rem] font-medium text-white">
                            <ImageIcon size={11} />
                            {mediaCount}
                        </span>
                    ) : null}
                    {hasAudio ? (
                        <span className="glass-pill inline-flex items-center gap-1 rounded-full px-2 py-1 text-[0.7rem] font-medium text-white">
                            <MicIcon size={11} />
                        </span>
                    ) : null}
                    {active ? (
                        <span className="glass-pill inline-flex items-center gap-1 rounded-full px-2 py-1 text-[0.7rem] font-medium text-white">
                            <span
                                aria-hidden="true"
                                className="inline-block h-1.5 w-1.5 rounded-full bg-success-400"
                            />
                            {activeLabel}
                        </span>
                    ) : null}
                </div>
            </div>

            {/* Bloco de info */}
            <div className="flex flex-1 flex-col gap-2.5 p-4">
                {/* Header: nome/@id */}
                <div className="flex flex-col gap-0.5">
                    <span className="inline-flex items-center gap-1.5 text-[1.05rem] font-semibold leading-tight tracking-tight text-text-primary">
                        <span className="truncate">{name}</span>
                    </span>
                    <span className="inline-flex items-center gap-1 text-[0.7rem] uppercase tracking-wider text-text-secondary">
                        @{identifier}
                        <span aria-hidden="true">·</span>
                        <span>{cityName}/{stateSigla}</span>
                    </span>
                </div>

                {/* Descrição */}
                {description ? (
                    <p className="line-clamp-2 text-xs leading-relaxed text-text-secondary">
                        {description}
                    </p>
                ) : null}

                {/* Áudio inline */}
                {audio != null ? <div>{audio}</div> : null}

                {/* Rodapé: preço destacado */}
                {priceLabel ? (
                    <div className="mt-auto flex items-center justify-between gap-3 border-t border-border pt-3">
                        <div className="flex flex-col">
                            {priceCaption ? (
                                <span className="text-[0.65rem] uppercase tracking-wider text-text-secondary">
                                    {priceCaption}
                                </span>
                            ) : null}
                            <span className="text-lg font-semibold tabular-nums text-accent-deep">
                                {priceLabel}
                            </span>
                        </div>
                        <span className="glass-pill-tinted inline-flex items-center gap-1 rounded-full px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-wider">
                            Ver perfil
                            <span aria-hidden="true">→</span>
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
            className="flex h-full w-full items-center justify-center bg-gradient-to-br from-accent-soft to-[#ffd1bf] text-accent-deep"
        >
            <span className="text-3xl font-semibold tracking-tight">
                {name.charAt(0).toUpperCase()}
            </span>
        </div>
    );
}
