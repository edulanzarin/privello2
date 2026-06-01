"use client";

import * as React from "react";

import { MicIcon, TrashIcon } from "../icons";

import { AudioWavePlayer } from "./AudioWavePlayer";

/**
 * Resultado consolidado da gravação entregue por
 * {@link AudioRecorder} via `onChange`. Quando `null`, ainda não há
 * gravação válida.
 */
export type AudioRecording = {
    /** Blob do áudio (formato escolhido pelo `MediaRecorder`). */
    blob: Blob;
    /** Duração medida em segundos (arredondada). */
    durationSeconds: number;
    /** URL local (blob:) para playback. */
    previewUrl: string;
    /** MIME type efetivo, com codec quando disponível. */
    mimeType: string;
};

type RecorderState = "idle" | "recording" | "ready" | "denied" | "unsupported";

/**
 * Props do {@link AudioRecorder}.
 *
 * Componente controlado: o consumidor mantém o `value` (ou `null`) e
 * recebe novas gravações via `onChange`. O fluxo:
 *
 * 1. **idle** — botão grande de microfone em pílula. Clique pede
 *    permissão de mic e começa a gravar imediatamente.
 * 2. **recording** — barras de onda animadas em tempo real via
 *    `AnalyserNode` (a barra da direita reflete o nível atual; as
 *    da esquerda guardam o histórico). Botão central troca para
 *    "Parar". Não exibe contador digital — quem está falando ja
 *    perdeu o foco se ficar olhando relógio. Auto-stop ao bater
 *    `maxSeconds`.
 * 3. **ready** — {@link AudioWavePlayer} com a onda real e botão
 *    discreto de "Regravar".
 * 4. **denied** — permissão negada. Texto + botão de retry.
 * 5. **unsupported** — navegador sem `MediaRecorder` ou `getUserMedia`.
 *
 * Visual neutro/elegante: sem cores berrantes, sem animação de
 * ping vermelho. A própria onda viva já comunica que está gravando.
 *
 * Nenhuma prop carrega nomes de entidades de domínio (Property 29).
 */
export interface AudioRecorderProps {
    /** Gravação atual. `null` significa "vazio". */
    value: AudioRecording | null;
    /** Callback quando há nova gravação (ou descarte). */
    onChange: (next: AudioRecording | null) => void;
    /** Duração mínima em segundos. Padrão: 10. */
    minSeconds?: number;
    /** Duração máxima em segundos. Padrão: 60. */
    maxSeconds?: number;
    /** Quando `true`, desabilita interação (durante upload). */
    disabled?: boolean;
}

const DEFAULT_MIN = 10;
const DEFAULT_MAX = 60;
const LIVE_BAR_COUNT = 56;

export function AudioRecorder({
    value,
    onChange,
    minSeconds = DEFAULT_MIN,
    maxSeconds = DEFAULT_MAX,
    disabled = false,
}: AudioRecorderProps): React.ReactElement {
    const [state, setState] = React.useState<RecorderState>(
        value !== null ? "ready" : "idle",
    );
    const [bars, setBars] = React.useState<ReadonlyArray<number>>(() =>
        new Array(LIVE_BAR_COUNT).fill(0),
    );
    const [reachedMin, setReachedMin] = React.useState(false);

    const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
    const chunksRef = React.useRef<BlobPart[]>([]);
    const streamRef = React.useRef<MediaStream | null>(null);
    const audioCtxRef = React.useRef<AudioContext | null>(null);
    const analyserRef = React.useRef<AnalyserNode | null>(null);
    const tickerRef = React.useRef<number | null>(null);
    const startedAtRef = React.useRef<number>(0);
    const stopTimeoutRef = React.useRef<number | null>(null);
    const minTimeoutRef = React.useRef<number | null>(null);

    React.useEffect(() => {
        if (value === null && state === "ready") {
            setState("idle");
            setBars(new Array(LIVE_BAR_COUNT).fill(0));
        }
    }, [value, state]);

    React.useEffect(() => {
        return () => {
            cleanupAudio();
            if (stopTimeoutRef.current !== null) {
                window.clearTimeout(stopTimeoutRef.current);
            }
            if (minTimeoutRef.current !== null) {
                window.clearTimeout(minTimeoutRef.current);
            }
            if (value?.previewUrl) {
                URL.revokeObjectURL(value.previewUrl);
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    function cleanupAudio(): void {
        if (tickerRef.current !== null) {
            window.clearInterval(tickerRef.current);
            tickerRef.current = null;
        }
        if (analyserRef.current) {
            try {
                analyserRef.current.disconnect();
            } catch {
                // Ignora.
            }
            analyserRef.current = null;
        }
        if (audioCtxRef.current) {
            void audioCtxRef.current.close().catch(() => undefined);
            audioCtxRef.current = null;
        }
        const stream = streamRef.current;
        if (stream) {
            for (const t of stream.getTracks()) t.stop();
            streamRef.current = null;
        }
    }

    function pickMime(): string | undefined {
        if (typeof MediaRecorder === "undefined") return undefined;
        const candidates = [
            "audio/webm;codecs=opus",
            "audio/webm",
            "audio/mp4",
            "audio/ogg;codecs=opus",
            "audio/ogg",
        ];
        for (const c of candidates) {
            try {
                if (MediaRecorder.isTypeSupported(c)) return c;
            } catch {
                // Ignora.
            }
        }
        return undefined;
    }

    async function startRecording(): Promise<void> {
        if (disabled) return;

        if (
            typeof navigator === "undefined" ||
            !navigator.mediaDevices ||
            typeof MediaRecorder === "undefined"
        ) {
            setState("unsupported");
            return;
        }

        let stream: MediaStream;
        try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch {
            setState("denied");
            return;
        }
        streamRef.current = stream;

        // Pipeline analyser para visualização ao vivo.
        try {
            const Ctor =
                window.AudioContext ||
                (window as typeof window & {
                    webkitAudioContext?: typeof AudioContext;
                }).webkitAudioContext;
            if (Ctor) {
                const ctx = new Ctor();
                audioCtxRef.current = ctx;
                const source = ctx.createMediaStreamSource(stream);
                const analyser = ctx.createAnalyser();
                analyser.fftSize = 1024;
                analyser.smoothingTimeConstant = 0.6;
                source.connect(analyser);
                analyserRef.current = analyser;
            }
        } catch {
            // Sem analyser; barras ficam paradas. Recording continua.
        }

        const mimeType = pickMime();
        let recorder: MediaRecorder;
        try {
            recorder = mimeType
                ? new MediaRecorder(stream, { mimeType })
                : new MediaRecorder(stream);
        } catch {
            cleanupAudio();
            setState("unsupported");
            return;
        }
        mediaRecorderRef.current = recorder;
        chunksRef.current = [];

        recorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) {
                chunksRef.current.push(e.data);
            }
        };
        recorder.onstop = () => {
            const effectiveMime = recorder.mimeType || mimeType || "audio/webm";
            const blob = new Blob(chunksRef.current, { type: effectiveMime });
            chunksRef.current = [];

            const durationSeconds = Math.max(
                1,
                Math.round((Date.now() - startedAtRef.current) / 1000),
            );

            cleanupAudio();

            if (durationSeconds < minSeconds) {
                // Cancelamento manual (botão "Parar" só fica liberado
                // após `minSeconds`; abaixo disso só descartamos).
                setState("idle");
                setBars(new Array(LIVE_BAR_COUNT).fill(0));
                return;
            }

            const previewUrl = URL.createObjectURL(blob);
            onChange({
                blob,
                durationSeconds,
                previewUrl,
                mimeType: effectiveMime,
            });
            setState("ready");
        };

        recorder.start(250);
        startedAtRef.current = Date.now();
        setReachedMin(false);
        setState("recording");
        setBars(new Array(LIVE_BAR_COUNT).fill(0));

        // Loop de visualização throttled (~12fps). RAF chamava
        // setState 60x/s e travava o main thread em máquinas modestas.
        const data = new Uint8Array(
            analyserRef.current?.frequencyBinCount ?? 0,
        );
        tickerRef.current = window.setInterval(() => {
            const analyser = analyserRef.current;
            if (!analyser || data.length === 0) return;
            analyser.getByteTimeDomainData(data);
            let sum = 0;
            for (let i = 0; i < data.length; i++) {
                const v = (data[i]! - 128) / 128;
                sum += v * v;
            }
            const rms = Math.sqrt(sum / data.length);
            const mag = Math.min(1, rms * 2.6);
            setBars((prev) => {
                const next = prev.slice(1);
                next.push(mag);
                return next;
            });
        }, 80);

        // Habilita botão "Parar" depois do mínimo.
        minTimeoutRef.current = window.setTimeout(() => {
            setReachedMin(true);
        }, minSeconds * 1000);

        // Auto-stop ao bater máximo.
        stopTimeoutRef.current = window.setTimeout(() => {
            stopRecording();
        }, maxSeconds * 1000 + 50);
    }

    function stopRecording(): void {
        if (stopTimeoutRef.current !== null) {
            window.clearTimeout(stopTimeoutRef.current);
            stopTimeoutRef.current = null;
        }
        if (minTimeoutRef.current !== null) {
            window.clearTimeout(minTimeoutRef.current);
            minTimeoutRef.current = null;
        }
        const recorder = mediaRecorderRef.current;
        if (recorder && recorder.state !== "inactive") {
            recorder.stop();
        }
    }

    function discardReady(): void {
        if (value?.previewUrl) {
            URL.revokeObjectURL(value.previewUrl);
        }
        onChange(null);
        setState("idle");
        setBars(new Array(LIVE_BAR_COUNT).fill(0));
    }

    if (state === "unsupported") {
        return (
            <div className="rounded-md border border-danger-200 bg-danger-50/40 px-4 py-3 text-sm text-danger-800">
                Seu navegador não suporta gravação de áudio. Tente o Chrome,
                Edge, Firefox ou Safari atualizados.
            </div>
        );
    }

    if (state === "denied") {
        return (
            <div className="flex flex-col gap-3 rounded-md border border-danger-200 bg-danger-50/40 px-4 py-3 text-sm text-danger-800">
                <p>
                    Permissão de microfone negada. Habilite o acesso nas
                    configurações do navegador e tente novamente.
                </p>
                <button
                    type="button"
                    onClick={() => setState("idle")}
                    className="self-start rounded-md border border-danger-300 px-3 py-1.5 text-xs font-medium text-danger-800 transition-colors hover:bg-danger-100"
                >
                    Tentar de novo
                </button>
            </div>
        );
    }

    if (state === "recording") {
        return (
            <div className="flex flex-col items-center gap-5 rounded-2xl border border-border bg-gradient-to-br from-accent-soft/70 via-surface to-surface px-4 py-6">
                <LiveWave bars={bars} />
                <button
                    type="button"
                    onClick={stopRecording}
                    disabled={!reachedMin}
                    aria-label={
                        reachedMin
                            ? "Parar gravação"
                            : `Aguarde o mínimo de ${minSeconds} segundos`
                    }
                    className={[
                        "inline-flex h-16 w-16 items-center justify-center rounded-full shadow-md transition-all",
                        reachedMin
                            ? "bg-gradient-to-br from-accent to-accent-deep text-white hover:scale-105"
                            : "bg-neutral-200 text-neutral-400 cursor-not-allowed",
                    ].join(" ")}
                >
                    <span
                        className={[
                            "block h-5 w-5 rounded-sm transition-colors",
                            reachedMin ? "bg-white" : "bg-neutral-400",
                        ].join(" ")}
                    />
                </button>
            </div>
        );
    }

    if (state === "ready" && value !== null) {
        return (
            <div className="flex flex-col gap-3">
                <AudioWavePlayer
                    src={value.blob}
                    mimeType={value.mimeType}
                    durationOverride={value.durationSeconds}
                    aria-label="Reproduzir gravação"
                />
                <button
                    type="button"
                    onClick={discardReady}
                    disabled={disabled}
                    className="inline-flex self-end items-center gap-1.5 rounded-full border border-neutral-200 bg-surface px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    <TrashIcon size={12} />
                    Regravar
                </button>
            </div>
        );
    }

    // idle
    return (
        <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-neutral-200 bg-neutral-50/60 px-4 py-8 text-center">
            <button
                type="button"
                onClick={() => void startRecording()}
                disabled={disabled}
                aria-label="Iniciar gravação"
                className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent-deep text-white shadow-[0_8px_24px_-8px_rgba(197,82,58,0.55)] transition-all hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50"
            >
                <MicIcon size={26} />
            </button>
            <p className="text-sm font-medium text-text-primary">
                Toque para começar
            </p>
        </div>
    );
}

/**
 * Onda viva: barras se deslocam para a esquerda, novas amplitudes
 * entram pela direita. Espelhada no centro pra dar simetria visual.
 */
function LiveWave({ bars }: { bars: ReadonlyArray<number> }): React.ReactElement {
    return (
        <div className="flex h-16 w-full items-center justify-center gap-[2px]">
            {bars.map((mag, i) => {
                const heightPct = 12 + Math.min(1, mag) * 86;
                return (
                    <span
                        key={i}
                        aria-hidden="true"
                        style={{ height: `${heightPct}%` }}
                        className="w-[3px] flex-1 rounded-full bg-accent/85"
                    />
                );
            })}
        </div>
    );
}
