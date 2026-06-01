"use client";

import * as React from "react";

import {
    FullscreenIcon,
    PauseIcon,
    PlayIcon,
    VolumeIcon,
    VolumeMuteIcon,
} from "../icons";

/**
 * Props do {@link VideoPlayer}.
 *
 * Player de vídeo com controles próprios da marca (substitui os
 * controles nativos do browser, que destoam do visual). Mantém a
 * tag `<video>` por baixo — só esconde os `controls` nativos e
 * desenha a barra própria: play/pause, progresso (scrub), tempo,
 * mute e tela cheia.
 *
 * Nenhuma prop carrega nomes de entidades de domínio (Property 29).
 */
export interface VideoPlayerProps {
    /** URL do vídeo. */
    src: string;
    /** MIME type opcional (vira `<source type>`). */
    mimeType?: string;
    /** Poster exibido antes do play. */
    posterUrl?: string | null;
    /** `playsInline` — evita fullscreen automático no iOS. Padrão: true. */
    playsInline?: boolean;
    /** Proporção do quadro. Padrão: `"video"` (16:9). */
    aspect?: "video" | "portrait" | "auto";
    /** Classes extras no container. */
    className?: string;
    /** Rótulo acessível. */
    label?: string;
}

const ASPECT_CLASSES: Record<
    NonNullable<VideoPlayerProps["aspect"]>,
    string
> = {
    video: "aspect-video",
    portrait: "aspect-[9/16]",
    auto: "",
};

/**
 * Formata segundos em `m:ss` (ou `h:mm:ss` quando passa de 1h).
 */
function fmtTime(total: number): string {
    if (!Number.isFinite(total) || total < 0) return "0:00";
    const s = Math.floor(total % 60);
    const m = Math.floor((total / 60) % 60);
    const h = Math.floor(total / 3600);
    const ss = String(s).padStart(2, "0");
    if (h > 0) {
        const mm = String(m).padStart(2, "0");
        return `${h}:${mm}:${ss}`;
    }
    return `${m}:${ss}`;
}

/**
 * VideoPlayer — player com controles da marca Privello.
 *
 * Comportamento:
 * - Clique no vídeo (ou no botão central) alterna play/pause.
 * - Barra inferior com gradiente: play/pause, tempo atual/total,
 *   scrubber (range) com preenchimento warm, mute e fullscreen.
 * - Controles aparecem no hover/touch e somem durante a reprodução
 *   após inatividade; sempre visíveis quando pausado.
 * - Wordmark "privello" discreto no canto (identidade), some em
 *   fullscreen pra não poluir.
 */
export function VideoPlayer({
    src,
    mimeType,
    posterUrl,
    playsInline = true,
    aspect = "video",
    className,
    label = "Vídeo",
}: VideoPlayerProps): React.ReactElement {
    const videoRef = React.useRef<HTMLVideoElement>(null);
    const containerRef = React.useRef<HTMLDivElement>(null);
    const hideTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    const [playing, setPlaying] = React.useState(false);
    const [muted, setMuted] = React.useState(false);
    const [current, setCurrent] = React.useState(0);
    const [duration, setDuration] = React.useState(0);
    const [controlsVisible, setControlsVisible] = React.useState(true);
    const [started, setStarted] = React.useState(false);

    const togglePlay = React.useCallback(() => {
        const v = videoRef.current;
        if (!v) return;
        if (v.paused) {
            void v.play();
        } else {
            v.pause();
        }
    }, []);

    const toggleMute = React.useCallback(() => {
        const v = videoRef.current;
        if (!v) return;
        v.muted = !v.muted;
        setMuted(v.muted);
    }, []);

    const toggleFullscreen = React.useCallback(() => {
        const el = containerRef.current;
        if (!el) return;
        if (document.fullscreenElement) {
            void document.exitFullscreen();
        } else {
            void el.requestFullscreen?.();
        }
    }, []);

    function onScrub(e: React.ChangeEvent<HTMLInputElement>): void {
        const v = videoRef.current;
        if (!v) return;
        const pct = Number(e.target.value) / 1000;
        v.currentTime = pct * (v.duration || 0);
        setCurrent(v.currentTime);
    }

    // Auto-hide dos controles durante a reprodução.
    const revelarControles = React.useCallback(() => {
        setControlsVisible(true);
        if (hideTimer.current) clearTimeout(hideTimer.current);
        hideTimer.current = setTimeout(() => {
            // Só esconde se estiver tocando.
            if (videoRef.current && !videoRef.current.paused) {
                setControlsVisible(false);
            }
        }, 2600);
    }, []);

    React.useEffect(() => {
        return () => {
            if (hideTimer.current) clearTimeout(hideTimer.current);
        };
    }, []);

    const progress = duration > 0 ? (current / duration) * 1000 : 0;
    const progressPct = duration > 0 ? (current / duration) * 100 : 0;

    return (
        <div
            ref={containerRef}
            className={[
                "group relative overflow-hidden rounded-2xl bg-black",
                ASPECT_CLASSES[aspect],
                className ?? "",
            ]
                .filter(Boolean)
                .join(" ")}
            onMouseMove={revelarControles}
            onTouchStart={revelarControles}
        >
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video
                ref={videoRef}
                src={mimeType ? undefined : src}
                poster={posterUrl ?? undefined}
                playsInline={playsInline}
                preload="metadata"
                aria-label={label}
                className="h-full w-full object-contain"
                onClick={togglePlay}
                onPlay={() => {
                    setPlaying(true);
                    setStarted(true);
                    revelarControles();
                }}
                onPause={() => {
                    setPlaying(false);
                    setControlsVisible(true);
                }}
                onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
                onLoadedMetadata={(e) =>
                    setDuration(e.currentTarget.duration || 0)
                }
                onEnded={() => {
                    setPlaying(false);
                    setControlsVisible(true);
                }}
            >
                {mimeType ? <source src={src} type={mimeType} /> : null}
            </video>

            {/* Botão central de play — só quando pausado/não iniciado. */}
            {!playing ? (
                <button
                    type="button"
                    onClick={togglePlay}
                    aria-label="Reproduzir"
                    className="absolute inset-0 z-10 flex items-center justify-center"
                >
                    <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm transition-transform duration-200 hover:scale-105">
                        <span className="ml-1">
                            <PlayIcon size={30} />
                        </span>
                    </span>
                </button>
            ) : null}

            {/* Wordmark discreto — identidade. Some em reprodução
                quando os controles escondem, e em fullscreen. */}
            <span
                aria-hidden="true"
                className={[
                    "pointer-events-none absolute right-3 top-3 z-10 text-sm font-bold tracking-tight text-white/70 transition-opacity duration-200",
                    controlsVisible ? "opacity-100" : "opacity-0",
                ].join(" ")}
            >
                privello<span className="text-[color:var(--accent)]">.</span>
            </span>

            {/* Barra de controles. */}
            <div
                className={[
                    "absolute inset-x-0 bottom-0 z-20 flex flex-col gap-1 bg-gradient-to-t from-black/70 via-black/30 to-transparent px-3 pb-2.5 pt-6 transition-opacity duration-200",
                    controlsVisible ? "opacity-100" : "opacity-0",
                ].join(" ")}
            >
                {/* Scrubber */}
                <input
                    type="range"
                    min={0}
                    max={1000}
                    step={1}
                    value={progress}
                    onChange={onScrub}
                    aria-label="Progresso do vídeo"
                    className="privello-video-range h-1 w-full cursor-pointer appearance-none rounded-full"
                    style={{
                        background: `linear-gradient(to right, var(--accent) 0%, var(--accent) ${progressPct}%, rgba(255,255,255,0.35) ${progressPct}%, rgba(255,255,255,0.35) 100%)`,
                    }}
                />

                {/* Linha de botões */}
                <div className="flex items-center gap-3 text-white">
                    <button
                        type="button"
                        onClick={togglePlay}
                        aria-label={playing ? "Pausar" : "Reproduzir"}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-white/15"
                    >
                        {playing ? (
                            <PauseIcon size={18} />
                        ) : (
                            <PlayIcon size={18} />
                        )}
                    </button>

                    <span className="text-xs font-medium tabular-nums text-white/90">
                        {fmtTime(current)}
                        <span className="text-white/50">
                            {" "}
                            / {fmtTime(duration)}
                        </span>
                    </span>

                    <div className="ml-auto flex items-center gap-1">
                        <button
                            type="button"
                            onClick={toggleMute}
                            aria-label={muted ? "Ativar som" : "Silenciar"}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-white/15"
                        >
                            {muted ? (
                                <VolumeMuteIcon size={18} />
                            ) : (
                                <VolumeIcon size={18} />
                            )}
                        </button>
                        <button
                            type="button"
                            onClick={toggleFullscreen}
                            aria-label="Tela cheia"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-white/15"
                        >
                            <FullscreenIcon size={18} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
