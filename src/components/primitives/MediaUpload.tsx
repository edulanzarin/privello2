"use client";

import * as React from "react";

import {
    LIMITE_FOTO_BYTES,
    LIMITE_VIDEO_BYTES,
    formatarLimiteMb,
} from "@/domain/limites";

import { ImageIcon, PlayIcon, XIcon } from "../icons";

/**
 * Resultado da seleção de mídia exposto pelo {@link MediaUpload}.
 *
 * Carrega o `File` original (que o consumidor envia ao servidor) e
 * metadados úteis derivados (tipo discriminado e URL local pra
 * preview). A `previewUrl` é um `blob:` criado via
 * `URL.createObjectURL` e o componente cuida do `revoke` no unmount/
 * substituição para evitar leak.
 */
export type MediaSelection = {
    /** Arquivo nativo selecionado pelo usuário. */
    file: File;
    /** Tipo discriminado: foto ou vídeo. */
    type: "photo" | "video";
    /** URL local (blob:) usável em `<img src>` ou `<video src>`. */
    previewUrl: string;
};

/**
 * Props do {@link MediaUpload}.
 *
 * Área de drop + browse para selecionar um arquivo de mídia (foto
 * ou vídeo). Auto-detecta o tipo a partir do MIME, monta o preview
 * inline e expõe o resultado via `value`/`onChange` (controlado).
 *
 * Pensado pra ser o "input de mídia" universal do produto: galeria
 * de Acompanhante, Reels, troca de Foto_de_Perfil, anexos em
 * comentários futuros — tudo em cima do mesmo primitivo.
 *
 * Diferente do {@link import("./FileUpload").FileUpload}:
 * - Faz preview ao vivo (image/video element).
 * - Auto-detecta tipo (foto/vídeo) e ajusta validação.
 * - Suporta drag-and-drop nativo.
 * - É **controlado** (não interno).
 *
 * Nenhuma prop carrega nomes de entidades de domínio (Property 29).
 */
export interface MediaUploadProps {
    /** Seleção atual. `null` significa "vazio". */
    value: MediaSelection | null;
    /** Callback quando a seleção muda (incluindo limpeza). */
    onChange: (next: MediaSelection | null) => void;
    /**
     * Tipos aceitos:
     * - `"photo"`: apenas imagens.
     * - `"video"`: apenas vídeos.
     * - `"any"` (padrão): aceita ambos.
     */
    accept?: "photo" | "video" | "any";
    /**
     * Tamanho máximo absoluto em bytes. Quando ausente, o limite
     * é derivado do tipo aceito: fotos limitadas por
     * {@link LIMITE_FOTO_BYTES} e vídeos por {@link LIMITE_VIDEO_BYTES}.
     */
    maxBytes?: number;
    /** Quando `true`, desabilita interação. */
    disabled?: boolean;
    /** Texto auxiliar exibido na área vazia. */
    hint?: React.ReactNode;
    /** Classes extras aplicadas ao container. */
    className?: string;
}

const DEFAULT_MAX = LIMITE_VIDEO_BYTES;

const ACCEPT_MIME: Record<NonNullable<MediaUploadProps["accept"]>, string> = {
    photo: "image/*",
    video: "video/*",
    any: "image/*,video/*",
};

/**
 * MediaUpload — área de drop com preview ao vivo.
 *
 * Estados visuais:
 * - **Vazio**: borda tracejada, ícone em pílula tonal, texto
 *   convidativo + dica de tipos aceitos. Container `aspect-video`
 *   (sempre horizontal).
 * - **Drag-over**: borda sólida primary + fundo `primary-50`.
 * - **Preenchido**: preview da mídia com altura limitada (`40vh`,
 *   máximo 400px). A mídia usa `object-contain` para preservar
 *   proporção sem cortar — Stories verticais cabem sem estourar
 *   a viewport.
 * - **Erro**: borda danger, mensagem em vermelho.
 */
export function MediaUpload({
    value,
    onChange,
    accept = "any",
    maxBytes = DEFAULT_MAX,
    disabled = false,
    hint,
    className,
}: MediaUploadProps): React.ReactElement {
    const inputRef = React.useRef<HTMLInputElement>(null);
    const [error, setError] = React.useState<string | null>(null);
    const [dragOver, setDragOver] = React.useState(false);

    // Revoga a URL blob anterior quando a seleção muda ou o
    // componente desmonta. Evita memory leak em uploads sucessivos.
    React.useEffect(() => {
        const url = value?.previewUrl;
        if (!url) return;
        return () => {
            URL.revokeObjectURL(url);
        };
    }, [value?.previewUrl]);

    function detectType(file: File): "photo" | "video" | null {
        if (file.type.startsWith("image/")) return "photo";
        if (file.type.startsWith("video/")) return "video";
        return null;
    }

    function handleSelectFile(file: File | null): void {
        setError(null);
        if (file === null) {
            onChange(null);
            return;
        }

        const type = detectType(file);
        if (type === null) {
            setError("Tipo de arquivo não suportado.");
            return;
        }
        if (accept === "photo" && type !== "photo") {
            setError("Apenas imagens são aceitas aqui.");
            return;
        }
        if (accept === "video" && type !== "video") {
            setError("Apenas vídeos são aceitos aqui.");
            return;
        }
        if (file.size > maxBytes) {
            setError(`Arquivo maior que ${formatarLimiteMb(maxBytes)}.`);
            return;
        }
        // Limite específico por tipo (mesmo quando o caller passa
        // um `maxBytes` mais permissivo). O servidor recusa qualquer
        // foto acima de `LIMITE_FOTO_BYTES` e vídeo acima de
        // `LIMITE_VIDEO_BYTES`, então rejeitamos cedo pra dar
        // mensagem específica.
        if (type === "photo" && file.size > LIMITE_FOTO_BYTES) {
            setError(
                `Foto maior que ${formatarLimiteMb(LIMITE_FOTO_BYTES)}.`,
            );
            return;
        }
        if (type === "video" && file.size > LIMITE_VIDEO_BYTES) {
            setError(
                `Vídeo maior que ${formatarLimiteMb(LIMITE_VIDEO_BYTES)}.`,
            );
            return;
        }

        const previewUrl = URL.createObjectURL(file);
        onChange({ file, type, previewUrl });
    }

    function handleInputChange(e: React.ChangeEvent<HTMLInputElement>): void {
        const file = e.target.files?.[0] ?? null;
        handleSelectFile(file);
        // Permite re-selecionar o mesmo arquivo após limpar.
        e.target.value = "";
    }

    function handleClick(): void {
        if (disabled || value !== null) return;
        inputRef.current?.click();
    }

    function handleClear(e: React.MouseEvent): void {
        e.stopPropagation();
        onChange(null);
    }

    function handleDragOver(e: React.DragEvent): void {
        if (disabled) return;
        e.preventDefault();
        setDragOver(true);
    }

    function handleDragLeave(): void {
        setDragOver(false);
    }

    function handleDrop(e: React.DragEvent): void {
        if (disabled) return;
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files?.[0] ?? null;
        handleSelectFile(file);
    }

    const composed = [
        "relative flex w-full flex-col items-center justify-center overflow-hidden rounded-2xl border-2 transition-all duration-150",
        value !== null
            ? "border-neutral-200 bg-neutral-100"
            : dragOver
                ? "border-[color:var(--accent)]/50 bg-[color:var(--accent-soft)]"
                : error !== null
                    ? "border-danger-300 bg-danger-50/30 border-dashed"
                    : "border-border border-dashed bg-neutral-50 hover:border-[color:var(--accent)]/35 hover:bg-[color:var(--accent-soft)]/40",
        disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer",
        className ?? "",
    ]
        .filter(Boolean)
        .join(" ");

    return (
        <div className="flex flex-col gap-1.5">
            <div
                role="button"
                tabIndex={disabled ? -1 : 0}
                onClick={handleClick}
                onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleClick();
                    }
                }}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                aria-disabled={disabled || undefined}
                className={composed}
            >
                {value !== null ? (
                    <PreviewSurface
                        selection={value}
                        onClear={handleClear}
                        disabled={disabled}
                    />
                ) : (
                    <EmptySurface accept={accept} hint={hint} />
                )}
            </div>

            <input
                ref={inputRef}
                type="file"
                accept={ACCEPT_MIME[accept]}
                onChange={handleInputChange}
                disabled={disabled}
                className="sr-only"
            />

            {error !== null ? (
                <p
                    role="alert"
                    className="text-xs text-danger-700 animate-fade-in-soft"
                >
                    {error}
                </p>
            ) : null}
        </div>
    );
}

function EmptySurface({
    accept,
    hint,
}: {
    accept: NonNullable<MediaUploadProps["accept"]>;
    hint?: React.ReactNode;
}): React.ReactElement {
    const ariaTitle =
        accept === "photo"
            ? "Selecionar foto"
            : accept === "video"
                ? "Selecionar vídeo"
                : "Selecionar foto ou vídeo";
    const defaultHint =
        accept === "photo"
            ? `JPEG, PNG ou WEBP. Até ${formatarLimiteMb(LIMITE_FOTO_BYTES)}.`
            : accept === "video"
                ? `MP4 ou WEBM. Até ${formatarLimiteMb(LIMITE_VIDEO_BYTES)}.`
                : `Foto até ${formatarLimiteMb(LIMITE_FOTO_BYTES)} ou vídeo até ${formatarLimiteMb(LIMITE_VIDEO_BYTES)}.`;

    return (
        <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 px-6 py-8 text-center">
            <span
                aria-hidden="true"
                className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--accent-soft)] text-[color:var(--accent-deep)] ring-4 ring-[color:var(--accent)]/15"
            >
                {accept === "video" ? (
                    <PlayIcon size={22} />
                ) : (
                    <ImageIcon size={22} />
                )}
            </span>
            <span className="text-sm font-semibold text-text-primary">
                {ariaTitle}
            </span>
            <span className="text-xs text-text-secondary">
                Arraste e solte, ou clique para escolher.
            </span>
            <span className="text-[0.7rem] text-text-disabled">
                {hint ?? defaultHint}
            </span>
        </div>
    );
}

function PreviewSurface({
    selection,
    onClear,
    disabled,
}: {
    selection: MediaSelection;
    onClear: (e: React.MouseEvent) => void;
    disabled: boolean;
}): React.ReactElement {
    return (
        // Altura fixa em vh limita verticais (Stories) sem precisar
        // calcular o aspect do arquivo. Mídia centralizada com
        // `object-contain` mantém proporção sem cropar.
        <div className="relative flex h-[40vh] max-h-[400px] min-h-[180px] w-full items-center justify-center bg-black">
            {selection.type === "photo" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    src={selection.previewUrl}
                    alt="Pré-visualização"
                    className="max-h-full max-w-full object-contain"
                />
            ) : (
                <video
                    src={selection.previewUrl}
                    controls
                    playsInline
                    className="max-h-full max-w-full object-contain"
                    aria-label="Pré-visualização do vídeo"
                />
            )}

            {/* Botão limpar */}
            {!disabled ? (
                <button
                    type="button"
                    onClick={onClear}
                    aria-label="Remover seleção"
                    className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm transition-colors hover:bg-black/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                >
                    <XIcon size={14} />
                </button>
            ) : null}

            {/* Badge de tipo */}
            <span
                aria-hidden="true"
                className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-white backdrop-blur-sm"
            >
                {selection.type === "photo" ? (
                    <ImageIcon size={11} />
                ) : (
                    <PlayIcon size={11} />
                )}
                {selection.type === "photo" ? "Foto" : "Vídeo"}
            </span>
        </div>
    );
}
