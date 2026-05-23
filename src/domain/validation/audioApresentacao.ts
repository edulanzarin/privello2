/**
 * Validação do Áudio_de_Apresentação ("Ouça minha voz").
 *
 * Recurso exclusivo do `Plano_Premium`: a Acompanhante grava direto
 * pelo navegador via `MediaRecorder` (10s a 60s), revisa a prévia e
 * confirma. O servidor recebe o blob e valida pelos mesmos critérios
 * do upload de mídia: MIME aceito + tamanho.
 *
 * Regras:
 *   - **MIME**: o `MediaRecorder` produz `audio/webm` na maioria dos
 *     navegadores Chromium e `audio/mp4` no Safari. Aceitamos os dois
 *     containers + variações comuns (Opus, Vorbis) sem amarrar a
 *     codec específica — quem dita o que vai ser tocado é o `<audio>`
 *     no consumidor.
 *   - **Tamanho**: até {@link LIMITE_AUDIO_BYTES}. Folga generosa
 *     para 60s mesmo a bitrates altos.
 *
 * **Duração** não é validada no servidor por agora. O front controla
 * via `MediaRecorder` (start/stop com timer). Numa fase posterior,
 * quando o `Sistema_de_Audio_de_Apresentacao` começar a fazer
 * análise por ffmpeg, podemos adicionar verificação real de duração
 * no servidor.
 */

import { LIMITE_AUDIO_BYTES } from "@/domain/limites";

/** MIME types aceitos para o Áudio_de_Apresentação. */
export const AUDIO_APRESENTACAO_MIME_TYPES = [
    "audio/webm",
    "audio/webm;codecs=opus",
    "audio/ogg",
    "audio/ogg;codecs=opus",
    "audio/mp4",
    "audio/mpeg",
    "audio/wav",
] as const;

/** Um dos MIME types aceitos para o Áudio_de_Apresentação. */
export type AudioApresentacaoMime =
    (typeof AUDIO_APRESENTACAO_MIME_TYPES)[number];

/** Tamanho máximo em bytes. Re-exportado a partir do limite global. */
export const AUDIO_APRESENTACAO_TAMANHO_MAXIMO_BYTES = LIMITE_AUDIO_BYTES;

/** Duração mínima em segundos. Validada no front (MediaRecorder). */
export const AUDIO_APRESENTACAO_DURACAO_MINIMA_S = 10;

/** Duração máxima em segundos. */
export const AUDIO_APRESENTACAO_DURACAO_MAXIMA_S = 60;

export type AudioApresentacaoInput = {
    /** MIME type informado pelo cliente HTTP no upload. */
    mimeType: string;
    /** Tamanho do arquivo em bytes. */
    sizeBytes: number;
};

/**
 * Normaliza o MIME aceitando variações com `;codecs=...` que o
 * `MediaRecorder` injeta. A comparação canônica é feita sobre o
 * "tipo principal" (antes do `;`).
 */
function isMimePermitido(mime: string): boolean {
    if (typeof mime !== "string" || mime.length === 0) return false;
    const lower = mime.toLowerCase();
    if (
        (AUDIO_APRESENTACAO_MIME_TYPES as readonly string[]).includes(lower)
    ) {
        return true;
    }
    // Compara só o tipo principal (sem parâmetros) — `audio/webm` ainda
    // entra mesmo que o browser mande `audio/webm;codecs=opus`.
    const main = lower.split(";")[0]?.trim();
    if (main && (AUDIO_APRESENTACAO_MIME_TYPES as readonly string[]).includes(main)) {
        return true;
    }
    return false;
}

/**
 * Retorna `true` se e somente se o MIME pertence à lista canônica e
 * `sizeBytes` é um inteiro positivo dentro do limite.
 */
export function validarAudioApresentacao(
    input: AudioApresentacaoInput,
): boolean {
    if (input == null || typeof input !== "object") return false;
    const { mimeType, sizeBytes } = input;
    if (typeof sizeBytes !== "number" || !Number.isFinite(sizeBytes)) {
        return false;
    }
    if (!Number.isInteger(sizeBytes)) return false;
    if (sizeBytes <= 0 || sizeBytes > AUDIO_APRESENTACAO_TAMANHO_MAXIMO_BYTES) {
        return false;
    }
    return isMimePermitido(mimeType);
}

/**
 * Mapeia o MIME informado para a extensão final usada na chave R2.
 * Retorna `null` se o MIME não for aceito.
 */
export function audioApresentacaoExt(mimeType: string): string | null {
    if (!isMimePermitido(mimeType)) return null;
    const main = mimeType.toLowerCase().split(";")[0]?.trim();
    switch (main) {
        case "audio/webm":
            return "webm";
        case "audio/ogg":
            return "ogg";
        case "audio/mp4":
            return "m4a";
        case "audio/mpeg":
            return "mp3";
        case "audio/wav":
            return "wav";
        default:
            return null;
    }
}
