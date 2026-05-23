/**
 * Validação de mídias da galeria (fotos + vídeos publicados pela
 * Acompanhante para os Clientes verem).
 *
 * Diferente da Foto_de_Perfil ({@link import("./fotoPerfil").validarFotoPerfil}),
 * que aceita só imagens, a galeria também aceita vídeos curtos.
 *
 * Regras:
 *   - **Foto**: MIME ∈ {jpeg, png, webp}, tamanho ≤ {@link LIMITE_FOTO_BYTES}.
 *   - **Vídeo**: MIME ∈ {mp4, webm, quicktime}, tamanho ≤ {@link LIMITE_VIDEO_BYTES}.
 *
 * Centralizar a validação aqui garante que o endpoint, a server
 * function e o schema Zod usem a mesma fonte de verdade.
 */

import { LIMITE_FOTO_BYTES, LIMITE_VIDEO_BYTES } from "@/domain/limites";

/** MIME types aceitos para fotos da galeria. */
export const GALERIA_MIME_FOTOS = [
    "image/jpeg",
    "image/png",
    "image/webp",
] as const;

/** MIME types aceitos para vídeos da galeria. */
export const GALERIA_MIME_VIDEOS = [
    "video/mp4",
    "video/webm",
    "video/quicktime",
] as const;

/** Tipos literais derivados das tuplas. */
export type GaleriaMimeFoto = (typeof GALERIA_MIME_FOTOS)[number];
export type GaleriaMimeVideo = (typeof GALERIA_MIME_VIDEOS)[number];
export type GaleriaMime = GaleriaMimeFoto | GaleriaMimeVideo;

/** Limite de tamanho de fotos da galeria. */
export const GALERIA_TAMANHO_MAXIMO_FOTO_BYTES = LIMITE_FOTO_BYTES;

/** Limite de tamanho de vídeos da galeria. */
export const GALERIA_TAMANHO_MAXIMO_VIDEO_BYTES = LIMITE_VIDEO_BYTES;

/**
 * Tipo discriminado retornado por {@link classificarMidia} quando a
 * validação passa.
 */
export type GaleriaTipo = "FOTO" | "VIDEO";

export type GaleriaMidiaInput = {
    /** MIME type informado pelo cliente HTTP no upload. */
    mimeType: string;
    /** Tamanho do arquivo em bytes. */
    sizeBytes: number;
};

function isFoto(mime: string): mime is GaleriaMimeFoto {
    return (GALERIA_MIME_FOTOS as readonly string[]).includes(mime);
}

function isVideo(mime: string): mime is GaleriaMimeVideo {
    return (GALERIA_MIME_VIDEOS as readonly string[]).includes(mime);
}

/**
 * Classifica a mídia em `FOTO` ou `VIDEO`. Retorna `null` quando o
 * MIME não pertence a nenhuma das listas aceitas.
 */
export function classificarMidia(mimeType: string): GaleriaTipo | null {
    if (isFoto(mimeType)) return "FOTO";
    if (isVideo(mimeType)) return "VIDEO";
    return null;
}

/**
 * Retorna `true` se e somente se a mídia é aceita: MIME válido para
 * o tipo discriminado e tamanho dentro do limite correspondente.
 */
export function validarGaleriaMidia(input: GaleriaMidiaInput): boolean {
    if (input == null || typeof input !== "object") return false;
    const { mimeType, sizeBytes } = input;
    if (typeof mimeType !== "string") return false;
    if (typeof sizeBytes !== "number" || !Number.isFinite(sizeBytes)) return false;
    if (!Number.isInteger(sizeBytes)) return false;
    if (sizeBytes <= 0) return false;

    if (isFoto(mimeType)) {
        return sizeBytes <= GALERIA_TAMANHO_MAXIMO_FOTO_BYTES;
    }
    if (isVideo(mimeType)) {
        return sizeBytes <= GALERIA_TAMANHO_MAXIMO_VIDEO_BYTES;
    }
    return false;
}

/**
 * Limite máximo de descrição da mídia (em caracteres).
 *
 * Espelha o limite usado pelo `MediaUploadModal` no front. Mantido em
 * domínio para que o schema do servidor valide independente da UI.
 */
export const GALERIA_DESCRICAO_MAX = 50;

/**
 * Valida o texto de descrição. Aceita string vazia (mídia sem
 * descrição) e até {@link GALERIA_DESCRICAO_MAX} caracteres após
 * `trim()`.
 */
export function validarGaleriaDescricao(text: string): boolean {
    if (typeof text !== "string") return false;
    return text.trim().length <= GALERIA_DESCRICAO_MAX;
}
