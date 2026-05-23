/**
 * Validação da Capa de Perfil (banner horizontal).
 *
 * Aceita os mesmos MIMEs de imagem da Foto_de_Perfil. Limite de
 * tamanho compartilhado via {@link LIMITE_FOTO_BYTES} — banners de
 * celular moderno em 4:1 cabem com folga em 8 MiB.
 */

import { LIMITE_FOTO_BYTES } from "@/domain/limites";

/** MIME types aceitos para a Capa_de_Perfil. */
export const CAPA_MIME_TYPES = [
    "image/jpeg",
    "image/png",
    "image/webp",
] as const;

/** Um dos MIME types aceitos. */
export type CapaPerfilMime = (typeof CAPA_MIME_TYPES)[number];

/**
 * Tamanho máximo em bytes. Re-exportado a partir de
 * {@link LIMITE_FOTO_BYTES} pra preservar consumidores antigos.
 */
export const CAPA_TAMANHO_MAXIMO_BYTES = LIMITE_FOTO_BYTES;

export type CapaPerfilInput = {
    mimeType: string;
    sizeBytes: number;
};

function isMimePermitido(mime: string): mime is CapaPerfilMime {
    return (CAPA_MIME_TYPES as readonly string[]).includes(mime);
}

/**
 * Retorna `true` se e somente se o MIME pertence a
 * {@link CAPA_MIME_TYPES} e `sizeBytes` é um inteiro positivo
 * menor ou igual a {@link CAPA_TAMANHO_MAXIMO_BYTES}.
 */
export function validarCapaPerfil(input: CapaPerfilInput): boolean {
    if (input == null || typeof input !== "object") return false;
    const { mimeType, sizeBytes } = input;
    if (typeof mimeType !== "string") return false;
    if (typeof sizeBytes !== "number" || !Number.isFinite(sizeBytes))
        return false;
    if (!Number.isInteger(sizeBytes)) return false;
    if (sizeBytes <= 0 || sizeBytes > CAPA_TAMANHO_MAXIMO_BYTES) return false;
    return isMimePermitido(mimeType);
}
