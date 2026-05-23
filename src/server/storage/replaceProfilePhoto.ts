/**
 * Troca da Foto_de_Perfil de um usuário já cadastrado.
 *
 * Delega o fluxo `stage → tx → commit` ao helper genérico
 * {@link import("./replaceUserMediaSlot").replaceUserMediaSlot},
 * declarando aqui apenas o que é específico de Foto_de_Perfil:
 * validação MIME/tamanho (10 MiB, JPEG/PNG/WEBP), seleção do slot
 * dentro do `ClientProfile` ou `AcompanhanteProfile`, e a chave R2
 * final. Cobre o caso de uso de "trocar foto de perfil" no painel
 * privado tanto do Cliente quanto da Acompanhante.
 */

import { randomUUID } from "node:crypto";

import type { UserType } from "@prisma/client";

import {
    InvalidProfilePhotoError,
    MIME_TO_EXT,
    validateProfilePhotoOrThrow,
} from "./profileMedia";
import {
    replaceUserMediaSlot,
    type MediaSlot,
} from "./replaceUserMediaSlot";

import type { FotoPerfilMime } from "@/domain/validation";

export type ReplaceProfilePhotoInput = {
    userId: string;
    userType: UserType;
    /** MIME do arquivo, conforme `validarFotoPerfil`. */
    mimeType: string;
    /** Bytes do arquivo. */
    bytes: Uint8Array | Buffer;
};

export type ReplaceProfilePhotoResult =
    | { ok: true; mediaId: string; storageKey: string }
    | {
        ok: false;
        reason: "FOTO_INVALIDA" | "PERFIL_NAO_ENCONTRADO" | "PERSISTENCIA";
    };

/**
 * Substitui a Foto_de_Perfil do usuário.
 *
 * # Fluxo
 *
 * 1. Valida MIME/tamanho via `validateProfilePhotoOrThrow`.
 * 2. Delega para `replaceUserMediaSlot`, passando o slot adequado
 *    (`fotoPerfilId` em `ClientProfile` ou `AcompanhanteProfile`)
 *    e a chave R2 final com UUID.
 *
 * Em caso de erro de validação, retorna `FOTO_INVALIDA` antes de
 * tocar no R2 ou no banco.
 */
export async function replaceProfilePhoto(
    input: ReplaceProfilePhotoInput,
): Promise<ReplaceProfilePhotoResult> {
    let mimeType: FotoPerfilMime;
    try {
        ({ mimeType } = validateProfilePhotoOrThrow({
            mimeType: input.mimeType,
            bytes: input.bytes,
        }));
    } catch (error) {
        if (error instanceof InvalidProfilePhotoError) {
            return { ok: false, reason: "FOTO_INVALIDA" };
        }
        return { ok: false, reason: "PERSISTENCIA" };
    }

    const slot: MediaSlot =
        input.userType === "CLIENTE"
            ? CLIENT_PROFILE_FOTO_SLOT
            : ACOMPANHANTE_PROFILE_FOTO_SLOT;

    return replaceUserMediaSlot({
        userId: input.userId,
        mimeType,
        bytes: input.bytes,
        slot,
        buildKey: (uid, mime) =>
            `committed/${uid}/profile/${randomUUID()}.${MIME_TO_EXT[mime as FotoPerfilMime]}`,
        mediaData: { kind: "PHOTO", role: "PROFILE" },
    });
}

// ---------------------------------------------------------------------------
// Slots: ponteiros foto_perfil_id em cada profile.
// ---------------------------------------------------------------------------

const CLIENT_PROFILE_FOTO_SLOT: MediaSlot = {
    async read(userId, tx) {
        const profile = await tx.clientProfile.findUnique({
            where: { userId },
            select: { fotoPerfilId: true },
        });
        if (!profile) return null;
        return { oldMediaId: profile.fotoPerfilId };
    },
    async write(userId, mediaId, tx) {
        await tx.clientProfile.update({
            where: { userId },
            data: { fotoPerfilId: mediaId },
        });
    },
};

const ACOMPANHANTE_PROFILE_FOTO_SLOT: MediaSlot = {
    async read(userId, tx) {
        const profile = await tx.acompanhanteProfile.findUnique({
            where: { userId },
            select: { fotoPerfilId: true },
        });
        if (!profile) return null;
        return { oldMediaId: profile.fotoPerfilId };
    },
    async write(userId, mediaId, tx) {
        await tx.acompanhanteProfile.update({
            where: { userId },
            data: { fotoPerfilId: mediaId },
        });
    },
};
