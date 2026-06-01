"use client";

import * as React from "react";

import { ChatIcon, HeartIcon, PlayIcon } from "../icons";

import type { MediaItem } from "./MediaTypes";

/**
 * Props do {@link MediaThumbnail}.
 *
 * Tile clicável que representa uma única mídia (foto ou vídeo) numa
 * grade. Mostra:
 *
 * - A imagem (foto) ou poster (vídeo) preenchendo o tile.
 * - Badge `play` no canto quando é vídeo.
 * - Stats overlay (curtidas + comentários) no hover/focus em desktop;
 *   em mobile, sempre visível em pilha sutil no canto inferior.
 *
 * Ao clicar, dispara `onOpen` com o `id` do item — o consumidor
 * normalmente abre o {@link import("./MediaCarousel").MediaCarousel}
 * naquele item.
 *
 * Nenhuma prop carrega nomes de entidades de domínio (Property 29).
 */
export interface MediaThumbnailProps {
    /** Item de mídia a renderizar. */
    item: MediaItem;
    /** Callback chamado ao clicar/ativar o tile. */
    onOpen?: (id: string) => void;
    /**
     * Proporção visual do tile. Padrão: `"square"`. Use `"portrait"`
     * para galerias mais altas (3:4) ou `"video"` para vídeos
     * apresentados horizontalmente.
     */
    aspect?: "square" | "portrait" | "video";
    /** Classes extras aplicadas ao container. */
    className?: string;
}

const ASPECT_CLASSES: Record<
    NonNullable<MediaThumbnailProps["aspect"]>,
    string
> = {
    square: "aspect-square",
    portrait: "aspect-[3/4]",
    video: "aspect-video",
};

/**
 * MediaThumbnail — tile de mídia clicável para grades.
 *
 * Visual: container com `aspect-*`, mídia em `object-cover`, gradiente
 * sutil no rodapé pra dar contraste aos stats overlay. Vídeos
 * ganham um botão `play` central decorativo.
 */
export function MediaThumbnail({
    item,
    onOpen,
    aspect = "square",
    className,
}: MediaThumbnailProps): React.ReactElement {
    const isVideo = item.type === "video";
    // Para vídeos sem `posterUrl`, usamos `<video preload="metadata">`
    // que carrega só os bytes iniciais para mostrar o primeiro frame.
    // Quando há `posterUrl` (futuro `Sistema_de_Midias` que extrai
    // thumb), usamos `<img>` apontando para ele — mais leve.
    const previewSrc = isVideo
        ? item.posterUrl ?? null
        : item.url;

    function handleClick(): void {
        onOpen?.(item.id);
    }

    return (
        <button
            type="button"
            onClick={handleClick}
            aria-label={item.description ?? `Abrir ${isVideo ? "vídeo" : "foto"}`}
            className={[
                "group relative block w-full overflow-hidden rounded-2xl bg-neutral-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
                ASPECT_CLASSES[aspect],
                className ?? "",
            ]
                .filter(Boolean)
                .join(" ")}
        >
            {isVideo && previewSrc === null ? (
                /* Vídeo sem poster: render `<video>` com primeiro
                   frame. `muted` + `playsInline` evita que o navegador
                   bloqueie ou abra fullscreen no autoload do metadata. */
                <video
                    src={item.url}
                    preload="metadata"
                    muted
                    playsInline
                    aria-hidden="true"
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
            ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    src={previewSrc as string}
                    alt={item.description ?? ""}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
            )}

            {/* Vídeo: badge "play" central + indicador no canto. */}
            {isVideo ? (
                <>
                    <span
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 flex items-center justify-center"
                    >
                        <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-black/45 text-white shadow-lg backdrop-blur-sm transition-transform duration-300 group-hover:scale-110">
                            <PlayIcon size={20} />
                        </span>
                    </span>
                </>
            ) : null}

            {/* Stats overlay: gradiente do rodapé + ícones com contagens. */}
            {(item.likes !== undefined || item.comments !== undefined) ? (
                <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/60 via-black/20 to-transparent px-3 pb-2 pt-6 text-xs text-white"
                >
                    <span className="flex items-center gap-1">
                        <HeartIcon size={12} />
                        <span className="tabular-nums font-semibold">
                            {item.likes ?? 0}
                        </span>
                    </span>
                    <span className="flex items-center gap-1">
                        <ChatIcon size={12} />
                        <span className="tabular-nums font-semibold">
                            {item.comments ?? 0}
                        </span>
                    </span>
                </div>
            ) : null}
        </button>
    );
}
