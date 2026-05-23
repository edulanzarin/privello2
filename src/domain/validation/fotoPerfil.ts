/**
 * Validação da Foto_de_Perfil (Requirement 3.10).
 *
 * Regras:
 *   - `mimeType` ∈ {"image/jpeg", "image/png", "image/webp"}.
 *   - `sizeBytes` ≤ {@link LIMITE_FOTO_BYTES} (8 MiB).
 *
 * O conjunto de MIME types aceitos é exportado como constante para que
 * outras camadas (UI, schemas, política de upload) compartilhem a mesma
 * fonte de verdade.
 */

import { LIMITE_FOTO_BYTES } from "@/domain/limites";

/**
 * MIME types aceitos para a Foto_de_Perfil. A tupla `as const` produz o
 * tipo literal {@link FotoPerfilMime}.
 */
export const MIME_TYPES_PERMITIDOS = [
    "image/jpeg",
    "image/png",
    "image/webp",
] as const;

/** Um dos MIME types aceitos para a Foto_de_Perfil. */
export type FotoPerfilMime = (typeof MIME_TYPES_PERMITIDOS)[number];

/**
 * Tamanho máximo em bytes. Re-exportado a partir de
 * {@link LIMITE_FOTO_BYTES} pra preservar consumidores antigos.
 */
export const TAMANHO_MAXIMO_BYTES = LIMITE_FOTO_BYTES;

/** Entrada esperada por {@link validarFotoPerfil}. */
export type FotoPerfilInput = {
    /** MIME type informado pelo cliente HTTP no upload. */
    mimeType: string;
    /** Tamanho do arquivo em bytes. */
    sizeBytes: number;
};

function isMimePermitido(mime: string): mime is FotoPerfilMime {
    return (MIME_TYPES_PERMITIDOS as readonly string[]).includes(mime);
}

/**
 * Retorna `true` se e somente se o MIME type pertence a
 * {@link MIME_TYPES_PERMITIDOS} e `sizeBytes` é um inteiro positivo
 * menor ou igual a {@link TAMANHO_MAXIMO_BYTES}.
 *
 * @param input Metadados do arquivo (MIME type e tamanho em bytes).
 */
export function validarFotoPerfil(input: FotoPerfilInput): boolean {
    if (input == null || typeof input !== "object") return false;
    const { mimeType, sizeBytes } = input;
    if (typeof mimeType !== "string") return false;
    if (typeof sizeBytes !== "number" || !Number.isFinite(sizeBytes)) return false;
    if (!Number.isInteger(sizeBytes)) return false;
    if (sizeBytes <= 0 || sizeBytes > TAMANHO_MAXIMO_BYTES) return false;
    return isMimePermitido(mimeType);
}
