/**
 * Troca da Capa_de_Perfil de uma Acompanhante autenticada.
 *
 * Delega o fluxo `stage → tx → commit` ao helper genérico
 * {@link import("./replaceUserMediaSlot").replaceUserMediaSlot},
 * declarando aqui apenas o que é específico de Capa_de_Perfil:
 * validação MIME/tamanho (15 MiB, JPEG/PNG/WEBP — banner horizontal
 * em alta resolução), seleção do slot `capaPerfilId` dentro do
 * `AcompanhanteProfile`, e a chave R2 final.
 *
 * Cliente não tem Capa_de_Perfil — é exclusiva da Acompanhante.
 */

import { randomUUID } from "node:crypto";

import { validarCapaPerfil, type CapaPerfilMime } from "@/domain/validation";

import {
    replaceUserMediaSlot,
    type MediaSlot,
} from "./replaceUserMediaSlot";

const MIME_TO_EXT: Readonly<Record<CapaPerfilMime, string>> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
};

export type ReplaceCoverPhotoInput = {
    userId: string;
    mimeType: string;
    bytes: Uint8Array | Buffer;
};

export type ReplaceCoverPhotoResult =
    | { ok: true; mediaId: string; storageKey: string }
    | {
        ok: false;
        reason: "CAPA_INVALIDA" | "PERFIL_NAO_ENCONTRADO" | "PERSISTENCIA";
    };

/**
 * Substitui a Capa_de_Perfil da Acompanhante.
 *
 * Fluxo: validação canônica → `replaceUserMediaSlot`. Em caso de
 * erro de validação, retorna `CAPA_INVALIDA` antes de tocar no R2
 * ou no banco.
 */
export async function replaceCoverPhoto(
    input: ReplaceCoverPhotoInput,
): Promise<ReplaceCoverPhotoResult> {
    const sizeBytes = input.bytes.byteLength;
    if (!validarCapaPerfil({ mimeType: input.mimeType, sizeBytes })) {
        return { ok: false, reason: "CAPA_INVALIDA" };
    }

    return replaceUserMediaSlot({
        userId: input.userId,
        mimeType: input.mimeType,
        bytes: input.bytes,
        slot: ACOMPANHANTE_COVER_SLOT,
        buildKey: (uid, mime) =>
            `committed/${uid}/cover/${randomUUID()}.${MIME_TO_EXT[mime as CapaPerfilMime]}`,
        mediaData: { kind: "PHOTO", role: "COVER" },
    });
}

const ACOMPANHANTE_COVER_SLOT: MediaSlot = {
    async read(userId, tx) {
        const profile = await tx.acompanhanteProfile.findUnique({
            where: { userId },
            select: { capaPerfilId: true },
        });
        if (!profile) return null;
        return { oldMediaId: profile.capaPerfilId };
    },
    async write(userId, mediaId, tx) {
        await tx.acompanhanteProfile.update({
            where: { userId },
            data: { capaPerfilId: mediaId },
        });
    },
};
