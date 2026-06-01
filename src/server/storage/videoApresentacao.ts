/**
 * Vídeo de apresentação (T08).
 *
 * Vídeo curto (≤60s) que a Acompanhante grava/sobe para o perfil
 * público — opcionalmente em vez do áudio. Slot único no
 * `acompanhante_profiles.video_apresentacao_id`. Substituição
 * marca o anterior como DELETED (não acumula).
 *
 * # Diferença pros REEL e galeria
 *
 * - **REEL**: feed lateral, N por dono, ≤90s, comentários.
 * - **Galeria**: vídeo no grid principal, com curtidas/comentários,
 *   role=GALLERY.
 * - **VIDEO_PRESENTATION** (este): único, ≤60s, papel "card de
 *   destaque" no perfil público (player + poster).
 *
 * # Quem pode usar
 *
 * Apenas Acompanhante com `permiteAudio = true` (Premium). Mesmo
 * gate do áudio de apresentação — o vídeo é uma alternativa visual.
 *
 * # Pipeline
 *
 *  1. Validação (MIME ∈ vídeos da galeria + tamanho).
 *  2. Watermark "Privello" via FFmpeg (mesmo asset do
 *     `applyGalleryWatermark`).
 *  3. Poster extraído via `extractVideoPoster` (frame ~0.5s).
 *  4. Stage em R2 → transação atômica que marca o antigo como
 *     DELETED + cria novo + atualiza o slot do profile.
 *  5. Commit em R2 (best-effort; falha cai em PENDING_REPAIR).
 *
 * # Limite de duração
 *
 * Validação canônica de duração não é feita server-side hoje (mesmo
 * pattern do REEL inicial). Front controla via input file e exibe
 * erro se passar de 60s. Quando o pipeline server-side de FFmpeg
 * permitir leitura barata da duração, podemos endurecer aqui.
 */

import { randomUUID } from "node:crypto";

import {
    classificarMidia,
    GALERIA_MIME_VIDEOS,
    type GaleriaMimeVideo,
} from "@/domain/validation";
import { db } from "@/lib/db";

import { extractVideoPoster } from "./extractVideoPoster";
import {
    cleanupStaged,
    commitProfilePhoto,
} from "./profileMedia";
import { applyGalleryWatermark } from "./watermark";
import { createR2Client, type R2Client } from "@/lib/storage/r2";

// ---------------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------------

export type PublicarVideoApresentacaoInput = {
    userId: string;
    mimeType: string;
    bytes: Uint8Array | Buffer;
    durationSeconds: number;
};

export type PublicarVideoApresentacaoResult =
    | {
        ok: true;
        mediaId: string;
        storageKey: string;
        posterStorageKey: string | null;
    }
    | {
        ok: false;
        reason:
        | "VIDEO_INVALIDO"
        | "DURACAO_INVALIDA"
        | "PERFIL_NAO_ENCONTRADO"
        | "PERSISTENCIA";
    };

export type ExcluirVideoApresentacaoResult =
    | { ok: true }
    | {
        ok: false;
        reason:
        | "VIDEO_NAO_ENCONTRADO"
        | "PERFIL_NAO_ENCONTRADO"
        | "PERSISTENCIA";
    };

// ---------------------------------------------------------------------------
// Limites
// ---------------------------------------------------------------------------

/** Limite máximo (segundos). Mesmo do áudio. */
export const VIDEO_APRESENTACAO_DURACAO_MAXIMA_S = 60;
/** Limite mínimo (segundos). */
export const VIDEO_APRESENTACAO_DURACAO_MINIMA_S = 5;
/** Limite de bytes — reusa o limite da galeria (vídeos). */
import { LIMITE_VIDEO_BYTES } from "@/domain/limites";
export const VIDEO_APRESENTACAO_TAMANHO_MAXIMO_BYTES = LIMITE_VIDEO_BYTES;

// ---------------------------------------------------------------------------
// Estado interno
// ---------------------------------------------------------------------------

let r2ClientSingleton: R2Client | null = null;

function getR2Client(): R2Client {
    if (!r2ClientSingleton) {
        r2ClientSingleton = createR2Client();
    }
    return r2ClientSingleton;
}

/** Test seam. */
export function __setR2ClientForVideoApresentacaoTests(
    client: R2Client | null,
): void {
    r2ClientSingleton = client;
}

const MIME_TO_EXT: Readonly<Record<GaleriaMimeVideo, string>> = {
    "video/mp4": "mp4",
    "video/webm": "webm",
    "video/quicktime": "mov",
};

function buildVideoKey(userId: string, mimeType: GaleriaMimeVideo): string {
    return `committed/${userId}/video-apresentacao/${randomUUID()}.${MIME_TO_EXT[mimeType]}`;
}

function buildPosterKey(userId: string): string {
    return `committed/${userId}/video-apresentacao/${randomUUID()}.jpg`;
}

// ---------------------------------------------------------------------------
// Publicar (substitui o anterior, se houver)
// ---------------------------------------------------------------------------

export async function publicarVideoApresentacao(
    input: PublicarVideoApresentacaoInput,
): Promise<PublicarVideoApresentacaoResult> {
    // 1. Validação canônica.
    if (
        typeof input.durationSeconds !== "number" ||
        !Number.isFinite(input.durationSeconds) ||
        input.durationSeconds < VIDEO_APRESENTACAO_DURACAO_MINIMA_S ||
        input.durationSeconds > VIDEO_APRESENTACAO_DURACAO_MAXIMA_S
    ) {
        return { ok: false, reason: "DURACAO_INVALIDA" };
    }

    const sizeBytes = input.bytes.byteLength;
    if (sizeBytes <= 0 || sizeBytes > VIDEO_APRESENTACAO_TAMANHO_MAXIMO_BYTES) {
        return { ok: false, reason: "VIDEO_INVALIDO" };
    }

    const tipo = classificarMidia(input.mimeType);
    if (tipo !== "VIDEO") {
        return { ok: false, reason: "VIDEO_INVALIDO" };
    }
    if (
        !(GALERIA_MIME_VIDEOS as readonly string[]).includes(input.mimeType)
    ) {
        return { ok: false, reason: "VIDEO_INVALIDO" };
    }
    const mimeType = input.mimeType as GaleriaMimeVideo;

    // 2. Watermark (best-effort).
    const watermarked = await applyGalleryWatermark({
        bytes: input.bytes,
        mimeType,
        tipo: "VIDEO",
        ownerId: input.userId,
    });
    const finalSize = watermarked.byteLength;

    // 3. Poster (best-effort).
    const posterBuffer = await extractVideoPoster(watermarked, mimeType);

    // 4. Stage em R2 do vídeo + (opcional) poster.
    const stagedVideoKey = `staged/${randomUUID()}`;
    const stagedPosterKey =
        posterBuffer !== null ? `staged/${randomUUID()}` : null;

    try {
        await getR2Client().putStaged(stagedVideoKey, watermarked, mimeType);
        if (posterBuffer !== null && stagedPosterKey !== null) {
            await getR2Client().putStaged(
                stagedPosterKey,
                posterBuffer,
                "image/jpeg",
            );
        }
    } catch {
        await cleanupStaged(stagedVideoKey);
        if (stagedPosterKey !== null) {
            await cleanupStaged(stagedPosterKey);
        }
        return { ok: false, reason: "PERSISTENCIA" };
    }

    const finalVideoKey = buildVideoKey(input.userId, mimeType);
    const finalPosterKey =
        posterBuffer !== null ? buildPosterKey(input.userId) : null;

    // 5. Transação atômica: marca antigo como DELETED, cria novo,
    //    atualiza slot.
    let newMediaId: string | null = null;
    let oldMediaId: string | null = null;
    try {
        const result = await db.$transaction(async (tx) => {
            const profile = await tx.acompanhanteProfile.findUnique({
                where: { userId: input.userId },
                select: { videoApresentacaoId: true },
            });
            if (!profile) {
                throw new VideoPerfilNaoEncontradoError();
            }
            const _oldMediaId = profile.videoApresentacaoId;

            const novo = await tx.media.create({
                data: {
                    ownerId: input.userId,
                    storageKey: finalVideoKey,
                    posterStorageKey: finalPosterKey,
                    mimeType,
                    sizeBytes: finalSize,
                    status: "COMMITTED",
                    kind: "VIDEO",
                    role: "VIDEO_PRESENTATION",
                    durationSeconds: Math.round(input.durationSeconds),
                    isProfilePhoto: false,
                },
                select: { id: true },
            });

            await tx.acompanhanteProfile.update({
                where: { userId: input.userId },
                data: { videoApresentacaoId: novo.id },
            });

            if (_oldMediaId !== null) {
                await tx.media.update({
                    where: { id: _oldMediaId },
                    data: { status: "DELETED" },
                });
            }

            return { newId: novo.id, oldId: _oldMediaId };
        });
        newMediaId = result.newId;
        oldMediaId = result.oldId;
    } catch (e) {
        await cleanupStaged(stagedVideoKey);
        if (stagedPosterKey !== null) await cleanupStaged(stagedPosterKey);
        if (e instanceof VideoPerfilNaoEncontradoError) {
            return { ok: false, reason: "PERFIL_NAO_ENCONTRADO" };
        }
        return { ok: false, reason: "PERSISTENCIA" };
    }

    if (newMediaId === null) {
        await cleanupStaged(stagedVideoKey);
        if (stagedPosterKey !== null) await cleanupStaged(stagedPosterKey);
        return { ok: false, reason: "PERSISTENCIA" };
    }

    // 6. Commit do vídeo + poster em R2 (best-effort).
    await commitProfilePhoto({
        stagedKey: stagedVideoKey,
        finalKey: finalVideoKey,
        mediaId: newMediaId,
    });
    if (stagedPosterKey !== null && finalPosterKey !== null) {
        // Poster não tem media-id próprio — o storageKey vive na
        // mesma row. Reusamos o mediaId do vídeo só pra logging.
        await commitProfilePhoto({
            stagedKey: stagedPosterKey,
            finalKey: finalPosterKey,
            mediaId: newMediaId,
        });
    }

    // Best-effort: silencia o id antigo (não usado depois).
    void oldMediaId;

    return {
        ok: true,
        mediaId: newMediaId,
        storageKey: finalVideoKey,
        posterStorageKey: finalPosterKey,
    };
}

class VideoPerfilNaoEncontradoError extends Error {
    constructor() {
        super("PERFIL_NAO_ENCONTRADO");
        this.name = "VideoPerfilNaoEncontradoError";
    }
}

// ---------------------------------------------------------------------------
// Excluir
// ---------------------------------------------------------------------------

export async function excluirVideoApresentacao(
    userId: string,
): Promise<ExcluirVideoApresentacaoResult> {
    try {
        return await db.$transaction(async (tx) => {
            const profile = await tx.acompanhanteProfile.findUnique({
                where: { userId },
                select: { videoApresentacaoId: true },
            });
            if (!profile) {
                return {
                    ok: false as const,
                    reason: "PERFIL_NAO_ENCONTRADO" as const,
                };
            }
            if (profile.videoApresentacaoId === null) {
                return {
                    ok: false as const,
                    reason: "VIDEO_NAO_ENCONTRADO" as const,
                };
            }

            const oldId = profile.videoApresentacaoId;
            await tx.acompanhanteProfile.update({
                where: { userId },
                data: { videoApresentacaoId: null },
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

export async function obterVideoApresentacao(
    userId: string,
): Promise<{
    id: string;
    storageKey: string;
    posterStorageKey: string | null;
    mimeType: string;
    durationSeconds: number | null;
} | null> {
    const profile = await db.acompanhanteProfile.findUnique({
        where: { userId },
        select: {
            videoApresentacao: {
                select: {
                    id: true,
                    storageKey: true,
                    posterStorageKey: true,
                    mimeType: true,
                    durationSeconds: true,
                    status: true,
                },
            },
        },
    });
    if (!profile?.videoApresentacao) return null;
    if (profile.videoApresentacao.status !== "COMMITTED") return null;
    return {
        id: profile.videoApresentacao.id,
        storageKey: profile.videoApresentacao.storageKey,
        posterStorageKey: profile.videoApresentacao.posterStorageKey,
        mimeType: profile.videoApresentacao.mimeType,
        durationSeconds: profile.videoApresentacao.durationSeconds,
    };
}
