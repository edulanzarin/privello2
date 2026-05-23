/**
 * Áudio_de_Apresentação ("Ouça minha voz") da Acompanhante.
 *
 * Recurso exclusivo do `Plano_Premium`. A Acompanhante grava direto
 * no navegador (10s a 60s, validado pelo MediaRecorder) e o blob
 * resultante chega aqui para validação canônica e persistência.
 *
 * O fluxo de troca é o mesmo padrão dos outros slots únicos
 * (foto/capa) e delega para
 * {@link import("./replaceUserMediaSlot").replaceUserMediaSlot}.
 * A exclusão fica neste módulo porque é específica de áudio (não
 * existe "remover foto de perfil" como operação isolada — sempre
 * é troca por outra).
 */

import { randomUUID } from "node:crypto";

import {
    audioApresentacaoExt,
    validarAudioApresentacao,
} from "@/domain/validation";
import { db } from "@/lib/db";

import {
    replaceUserMediaSlot,
    type MediaSlot,
} from "./replaceUserMediaSlot";

// ---------------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------------

export type PublicarAudioInput = {
    userId: string;
    mimeType: string;
    bytes: Uint8Array | Buffer;
};

export type PublicarAudioResult =
    | { ok: true; mediaId: string; storageKey: string }
    | {
        ok: false;
        reason: "AUDIO_INVALIDO" | "PERFIL_NAO_ENCONTRADO" | "PERSISTENCIA";
    };

export type ExcluirAudioResult =
    | { ok: true }
    | {
        ok: false;
        reason:
        | "AUDIO_NAO_ENCONTRADO"
        | "PERFIL_NAO_ENCONTRADO"
        | "PERSISTENCIA";
    };

// ---------------------------------------------------------------------------
// Publicar (substitui o áudio anterior, se houver)
// ---------------------------------------------------------------------------

/**
 * Publica um novo Áudio_de_Apresentação para a Acompanhante,
 * substituindo o anterior se existir.
 *
 * Fluxo: validação canônica → `replaceUserMediaSlot` com slot
 * `audioApresentacaoId`. Em qualquer falha, retorna `reason`
 * discriminado.
 */
export async function publicarAudioApresentacao(
    input: PublicarAudioInput,
): Promise<PublicarAudioResult> {
    const sizeBytes = input.bytes.byteLength;
    if (
        !validarAudioApresentacao({
            mimeType: input.mimeType,
            sizeBytes,
        })
    ) {
        return { ok: false, reason: "AUDIO_INVALIDO" };
    }

    const ext = audioApresentacaoExt(input.mimeType);
    if (ext === null) {
        // `validarAudioApresentacao` já rejeitaria — defesa em profundidade.
        return { ok: false, reason: "AUDIO_INVALIDO" };
    }

    return replaceUserMediaSlot({
        userId: input.userId,
        mimeType: input.mimeType,
        bytes: input.bytes,
        slot: ACOMPANHANTE_AUDIO_SLOT,
        buildKey: (uid) => `committed/${uid}/audio/${randomUUID()}.${ext}`,
        mediaData: { kind: "AUDIO", role: "AUDIO" },
    });
}

const ACOMPANHANTE_AUDIO_SLOT: MediaSlot = {
    async read(userId, tx) {
        const profile = await tx.acompanhanteProfile.findUnique({
            where: { userId },
            select: { audioApresentacaoId: true },
        });
        if (!profile) return null;
        return { oldMediaId: profile.audioApresentacaoId };
    },
    async write(userId, mediaId, tx) {
        await tx.acompanhanteProfile.update({
            where: { userId },
            data: { audioApresentacaoId: mediaId },
        });
    },
};

// ---------------------------------------------------------------------------
// Excluir
// ---------------------------------------------------------------------------

/**
 * Remove o Áudio_de_Apresentação do perfil. A Media correspondente
 * vira `DELETED` (a varredura limpa o R2). Não derruba o registro
 * porque queremos preservar histórico de auditoria.
 */
export async function excluirAudioApresentacao(
    userId: string,
): Promise<ExcluirAudioResult> {
    try {
        return await db.$transaction(async (tx) => {
            const profile = await tx.acompanhanteProfile.findUnique({
                where: { userId },
                select: { audioApresentacaoId: true },
            });
            if (!profile) {
                return {
                    ok: false as const,
                    reason: "PERFIL_NAO_ENCONTRADO" as const,
                };
            }
            if (profile.audioApresentacaoId === null) {
                return {
                    ok: false as const,
                    reason: "AUDIO_NAO_ENCONTRADO" as const,
                };
            }

            const oldId = profile.audioApresentacaoId;
            await tx.acompanhanteProfile.update({
                where: { userId },
                data: { audioApresentacaoId: null },
            });
            await tx.media.update({
                where: { id: oldId },
                data: { status: "DELETED" },
            });

            return { ok: true as const };
        });
    } catch {
        return { ok: false, reason: "PERSISTENCIA" };
    }
}

// ---------------------------------------------------------------------------
// Obter
// ---------------------------------------------------------------------------

/**
 * Retorna a `storageKey` do Áudio_de_Apresentação ativo, ou `null`
 * quando ainda não há um. Lê só o necessário pra montar a URL pública.
 */
export async function obterAudioApresentacao(
    userId: string,
): Promise<{ id: string; storageKey: string; mimeType: string } | null> {
    const profile = await db.acompanhanteProfile.findUnique({
        where: { userId },
        select: {
            audioApresentacao: {
                select: {
                    id: true,
                    storageKey: true,
                    mimeType: true,
                    status: true,
                },
            },
        },
    });
    if (!profile?.audioApresentacao) return null;
    if (profile.audioApresentacao.status !== "COMMITTED") return null;
    return {
        id: profile.audioApresentacao.id,
        storageKey: profile.audioApresentacao.storageKey,
        mimeType: profile.audioApresentacao.mimeType,
    };
}
