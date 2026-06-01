"use client";

import * as React from "react";

import { MapPinIcon } from "../icons";

/**
 * Item da {@link CityChips}.
 */
export interface CityChipsItem {
    /** Nome principal (ex.: "São Paulo"). */
    label: string;
    /** Sigla ou subtítulo (ex.: "SP"). Opcional. */
    sublabel?: string;
    /** URL pra navegação ao clicar. */
    href: string;
    /** Imagem opcional de fundo (ex.: foto do perfil mais popular da cidade). */
    photoUrl?: string | null;
    /** Contador opcional renderizado em chip (ex.: "12 perfis"). */
    count?: number;
}

/**
 * Props da {@link CityChips}.
 */
export interface CityChipsProps {
    items: ReadonlyArray<CityChipsItem>;
    /** Classes extras aplicadas ao container. */
    className?: string;
}

/**
 * CityChips — carrossel horizontal de chips destacando cidades.
 *
 * Visual: chips com aspect 16:10, com foto de fundo (quando
 * presente) + gradiente warm e label sobreposta. Scroll
 * horizontal com snap, esconde scrollbar. Hover faz a foto dar
 * zoom suave.
 *
 * Bom pra usar abaixo de heros de pesquisa indicando cidades em
 * destaque ou onde há mais perfis ativos.
 *
 * Genérico — sem nomes de domínio (Property 29). Caller monta
 * a lista e passa.
 */
export function CityChips({
    items,
    className,
}: CityChipsProps): React.ReactElement | null {
    if (items.length === 0) return null;

    return (
        <div
            className={[
                "overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
                className ?? "",
            ]
                .filter(Boolean)
                .join(" ")}
        >
            <ul className="flex items-stretch gap-3 snap-x snap-mandatory">
                {items.map((item) => (
                    <li
                        key={item.href}
                        className="snap-start shrink-0 w-44 sm:w-52"
                    >
                        <a
                            href={item.href}
                            aria-label={item.label}
                            className="group relative flex aspect-[16/10] w-full flex-col justify-end overflow-hidden rounded-2xl bg-gradient-to-br from-accent-soft via-[#ffd1bf] to-accent shadow-[0_12px_24px_-16px_rgba(26,20,16,0.18)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_32px_-18px_rgba(26,20,16,0.25)] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                        >
                            {item.photoUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                    src={item.photoUrl}
                                    alt=""
                                    loading="lazy"
                                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                                />
                            ) : null}
                            <span
                                aria-hidden="true"
                                className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/65 via-black/15 to-transparent"
                            />

                            {item.count !== undefined && item.count > 0 ? (
                                <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-white/85 px-2 py-0.5 text-[0.65rem] font-medium text-text-primary backdrop-blur-md ring-1 ring-white/60">
                                    {item.count} {item.count === 1 ? "perfil" : "perfis"}
                                </span>
                            ) : null}

                            <div className="relative flex flex-col gap-0.5 p-3 text-white">
                                <span className="inline-flex items-center gap-1 text-[0.65rem] font-medium uppercase tracking-wider text-white/85">
                                    <MapPinIcon size={10} />
                                    {item.sublabel ?? "Brasil"}
                                </span>
                                <span className="text-base font-semibold leading-tight tracking-tight">
                                    {item.label}
                                </span>
                            </div>
                        </a>
                    </li>
                ))}
            </ul>
        </div>
    );
}
