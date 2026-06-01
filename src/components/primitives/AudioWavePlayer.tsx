"use client";

import * as React from "react";

import { PauseIcon, PlayIcon } from "../icons";

/**
 * Props do {@link AudioWavePlayer}.
 *
 * Player de áudio com visualização em onda. Substitui o
 * `<audio controls>` nativo, que tem cinza pesado e visual
 * inconsistente entre browsers, por um cartão sob medida:
 *
 * - Botão circular de play/pause à esquerda em tom primário.
 * - Trilha de barras verticais (ondinhas decorativas) que reagem
 *   ao progresso — barras à esquerda do cursor ficam saturadas, à
 *   direita ficam discretas. Clique em qualquer ponto das barras
 *   "salta" pro timestamp correspondente.
 * - Tempo decorrido / total à direita.
 *
 * As barras são geradas por uma onda pseudo-aleatória
 * **determinística** (seed estável a partir do `src`), suficiente
 * para comunicar "isso é áudio" sem precisar decodificar o blob —
 * decodificação tem custo alto e abre dor de cabeça com codecs
 * exóticos (Opus em Safari, WebM com `duration: Infinity` do
 * `MediaRecorder` em Chrome).
 *
 * Aceita tanto URL remota (`src`) quanto `Blob` local. Quando o
 * caller já sabe a duração (ex.: `AudioRecorder` que mediu o
 * tempo de gravação), passe `durationOverride` para contornar o
 * bug do WebM blob `duration: Infinity`.
 *
 * Nenhuma prop carrega nomes de entidades de domínio (Property 29).
 */
export interface AudioWavePlayerProps {
    /** Fonte do áudio. URL remota ou `Blob` local. */
    src: string | Blob;
    /**
     * MIME type usado em `<audio src>`. Opcional — apenas dica
     * para o `<audio>` quando `src` é string. `Blob` já carrega
     * o `type` por dentro.
     */
    mimeType?: string;
    /**
     * Duração conhecida em segundos. Quando informada, ignora a
     * duração reportada pelo `<audio>` (que pode vir como
     * `Infinity` para blobs WebM gerados pelo `MediaRecorder`).
     */
    durationOverride?: number;
    /** Quantidade de barras renderizadas. Padrão: 56. */
    barCount?: number;
    /**
     * Variante visual do player. Padrão: `"full"`.
     *
     * - `"full"`: pílula completa com botão grande (h-10 w-10), 56
     *   barras, contador de tempo. Usado em painéis e perfil
     *   público onde o áudio é destaque.
     * - `"mini"`: pílula compacta com botão menor (h-8 w-8), barras
     *   reduzidas e contador discreto. Usado em listagens densas
     *   (cards do feed da home/busca) onde o áudio é apenas um
     *   "recheio" do card.
     */
    variant?: "full" | "mini";
    /**
     * Quando `true`, o player engole `click` events para evitar
     * que cliques no botão de play disparem navegação no `<a>`
     * pai (caso o player esteja dentro de um card linkado).
     * Padrão: `false`.
     */
    stopPropagation?: boolean;
    /** Classes extras aplicadas ao card. */
    className?: string;
    /**
     * Rótulo acessível do botão de play. Padrão: `"Reproduzir áudio"`.
     */
    "aria-label"?: string;
}

export function AudioWavePlayer({
    src,
    mimeType,
    durationOverride,
    barCount,
    variant = "full",
    stopPropagation = false,
    className,
    "aria-label": ariaLabel = "Reproduzir áudio",
}: AudioWavePlayerProps): React.ReactElement {
    const isMini = variant === "mini";
    const effectiveBarCount = barCount ?? (isMini ? 32 : 56);
    const audioRef = React.useRef<HTMLAudioElement>(null);
    const [playing, setPlaying] = React.useState(false);
    const [currentTime, setCurrentTime] = React.useState(0);
    const [intrinsicDuration, setIntrinsicDuration] = React.useState(0);

    // Onda decorativa, calculada uma vez por src.
    const waveform = React.useMemo(
        () =>
            fallbackWaveform(
                effectiveBarCount,
                typeof src === "string" ? src : "blob",
            ),
        [src, effectiveBarCount],
    );

    // Resolve a URL utilizável pelo `<audio>`. Para Blob criamos um
    // objectURL e revogamos no cleanup.
    const audioUrl = React.useMemo(() => {
        if (typeof src === "string") return src;
        return URL.createObjectURL(src);
    }, [src]);

    React.useEffect(() => {
        if (typeof src === "string") return;
        return () => {
            URL.revokeObjectURL(audioUrl);
        };
    }, [audioUrl, src]);

    // Bind dos eventos do `<audio>`.
    React.useEffect(() => {
        const el = audioRef.current;
        if (!el) return;
        const onTime = () => setCurrentTime(el.currentTime);
        const onMeta = () => {
            if (Number.isFinite(el.duration) && el.duration > 0) {
                setIntrinsicDuration(el.duration);
            }
        };
        const onPlay = () => setPlaying(true);
        const onPause = () => setPlaying(false);
        const onEnded = () => {
            setPlaying(false);
            setCurrentTime(0);
        };
        el.addEventListener("timeupdate", onTime);
        el.addEventListener("loadedmetadata", onMeta);
        el.addEventListener("durationchange", onMeta);
        el.addEventListener("play", onPlay);
        el.addEventListener("pause", onPause);
        el.addEventListener("ended", onEnded);
        return () => {
            el.removeEventListener("timeupdate", onTime);
            el.removeEventListener("loadedmetadata", onMeta);
            el.removeEventListener("durationchange", onMeta);
            el.removeEventListener("play", onPlay);
            el.removeEventListener("pause", onPause);
            el.removeEventListener("ended", onEnded);
        };
    }, []);

    // Duração efetiva: prioriza override do caller, cai no que o
    // `<audio>` reportou. Se nenhum dos dois for válido, fica em 0
    // e o display mostra `--:--`.
    const duration =
        typeof durationOverride === "number" &&
            Number.isFinite(durationOverride) &&
            durationOverride > 0
            ? durationOverride
            : intrinsicDuration;

    function toggle(e?: React.MouseEvent<HTMLButtonElement>): void {
        if (stopPropagation && e) {
            e.preventDefault();
            e.stopPropagation();
        }
        const el = audioRef.current;
        if (!el) return;
        if (el.paused) {
            void el.play().catch(() => undefined);
        } else {
            el.pause();
        }
    }

    function seekFromEvent(e: React.MouseEvent<HTMLDivElement>): void {
        if (stopPropagation) {
            e.preventDefault();
            e.stopPropagation();
        }
        const el = audioRef.current;
        if (!el) return;
        if (!Number.isFinite(duration) || duration <= 0) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const ratio = Math.max(
            0,
            Math.min(1, (e.clientX - rect.left) / rect.width),
        );
        try {
            el.currentTime = ratio * duration;
        } catch {
            // Algumas combinações de Chrome + WebM blob lançam quando
            // `duration` é `Infinity` mesmo com nosso override — a
            // tentativa de seek é apenas best-effort.
        }
    }

    const progress = duration > 0 ? currentTime / duration : 0;

    const containerCls = isMini
        ? "flex items-center gap-2 rounded-full border border-border bg-surface px-2 py-1.5"
        : "flex items-center gap-3 rounded-full border border-border bg-surface px-3 py-2 shadow-sm";
    const buttonCls = isMini
        ? "inline-flex h-8 w-8 flex-none items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent-deep text-white shadow-[0_4px_12px_-4px_rgba(197,82,58,0.45)] transition-transform hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
        : "inline-flex h-10 w-10 flex-none items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent-deep text-white shadow-[0_8px_20px_-6px_rgba(197,82,58,0.55)] transition-transform hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40";
    const trackCls = isMini
        ? "flex h-7 min-w-0 flex-1 cursor-pointer items-center gap-[2px] focus:outline-none"
        : "flex h-10 min-w-0 flex-1 cursor-pointer items-center gap-[2px] focus:outline-none";
    const clockCls = isMini
        ? "flex-none font-mono text-[0.65rem] tabular-nums text-text-secondary"
        : "flex-none font-mono text-xs tabular-nums text-text-secondary";
    const iconSize = isMini ? 12 : 16;

    return (
        <div
            className={[containerCls, className ?? ""]
                .filter(Boolean)
                .join(" ")}
        >
            <button
                type="button"
                onClick={toggle}
                aria-label={playing ? "Pausar áudio" : ariaLabel}
                className={buttonCls}
            >
                {playing ? (
                    <PauseIcon size={iconSize} />
                ) : (
                    <PlayIcon size={iconSize} />
                )}
            </button>

            <div
                role="slider"
                aria-label="Progresso do áudio"
                aria-valuemin={0}
                aria-valuemax={duration > 0 ? Math.round(duration) : 0}
                aria-valuenow={Math.round(currentTime)}
                tabIndex={0}
                onClick={seekFromEvent}
                onKeyDown={(e) => {
                    const el = audioRef.current;
                    if (!el || duration <= 0) return;
                    if (e.key === "ArrowRight") {
                        e.preventDefault();
                        try {
                            el.currentTime = Math.min(
                                duration,
                                el.currentTime + 2,
                            );
                        } catch {
                            // best-effort.
                        }
                    }
                    if (e.key === "ArrowLeft") {
                        e.preventDefault();
                        try {
                            el.currentTime = Math.max(0, el.currentTime - 2);
                        } catch {
                            // best-effort.
                        }
                    }
                }}
                className={trackCls}
            >
                {waveform.map((mag, i) => {
                    const filled = i / effectiveBarCount <= progress;
                    // Arredonda para 2 casas — server e client
                    // precisam produzir EXATAMENTE a mesma string
                    // pra evitar hydration mismatch. Float "puro"
                    // tipo `31.104546431313217%` pode ser truncado
                    // pelo browser em alguns casos e diverge do
                    // SSR.
                    const heightPct = (18 + mag * 78).toFixed(2);
                    return (
                        <span
                            key={i}
                            aria-hidden="true"
                            style={{ height: `${heightPct}%` }}
                            className={[
                                "w-[2px] flex-1 rounded-full transition-colors",
                                filled
                                    ? "bg-accent"
                                    : "bg-neutral-300",
                            ].join(" ")}
                        />
                    );
                })}
            </div>

            <span className={clockCls}>
                {formatClock(currentTime)} /{" "}
                {duration > 0 ? formatClock(duration) : "--:--"}
            </span>

            <audio
                ref={audioRef}
                src={audioUrl}
                preload="none"
                className="hidden"
            >
                {mimeType ? <source src={audioUrl} type={mimeType} /> : null}
            </audio>
        </div>
    );
}

/**
 * Pseudo-onda determinística por seed. Usa hash FNV-1a do `src` para
 * que cada áudio tenha sua própria assinatura visual estável.
 */
function fallbackWaveform(count: number, seed: string): ReadonlyArray<number> {
    let h = 2166136261;
    for (let i = 0; i < seed.length; i++) {
        h ^= seed.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    const result: number[] = new Array(count);
    let state = h >>> 0;
    for (let i = 0; i < count; i++) {
        state = (state * 1664525 + 1013904223) >>> 0;
        const v = (state & 0xffff) / 0xffff;
        // Envelope senoidal central para evitar onda totalmente
        // uniforme — barras das pontas ficam mais baixas.
        const env = 0.55 + 0.45 * Math.sin((i / count) * Math.PI);
        result[i] = Math.max(0.15, Math.min(1, v * env));
    }
    return result;
}

function formatClock(totalSeconds: number): string {
    const safe = Number.isFinite(totalSeconds) ? Math.max(0, totalSeconds) : 0;
    const m = Math.floor(safe / 60);
    const s = Math.floor(safe % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
}
