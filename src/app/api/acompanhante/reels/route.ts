import { NextResponse } from "next/server";

import {
    requireAcompanhanteWithPlano,
    requireFile,
} from "@/server/auth/guards";
import { enforceRateLimit, LIMITS } from "@/server/auth/rateLimitGuard";
import { publicarReel } from "@/server/storage/reelMedia";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * `POST /api/acompanhante/reels` — publica um Reel.
 *
 * Aceita `multipart/form-data` com:
 *   - `video` (`File`): vídeo MP4/WebM/MOV.
 *   - `duration` (`string`): duração em segundos (5-90).
 *   - `caption` (`string`, opcional): legenda até 200 chars.
 *   - `poster` (`File`, opcional): imagem JPG/PNG do primeiro frame.
 *
 * Exige Acompanhante com plano que permite Reels (Básico até 20
 * publicados, Premium ilimitado).
 *
 * Respostas:
 *
 * - `200`: `{ ok: true, media: { id, storageKey, createdAt } }`.
 * - `400`: `{ ok: false, reason: "MIDIA_INVALIDA" | "DURACAO_INVALIDA"
 *           | "CAPTION_INVALIDA" | "VALIDACAO" }`.
 * - `403`: `{ ok: false, reason: "TIPO_INVALIDO" | "PLANO_INVALIDO"
 *           | "PLANO_NAO_PERMITE" }`.
 * - `409`: `{ ok: false, reason: "LIMITE_ATIVOS" | "SEM_PLANO" }`.
 * - `500`: `{ ok: false, reason: "PERSISTENCIA" }`.
 */
export async function POST(request: Request): Promise<NextResponse> {
    const auth = await requireAcompanhanteWithPlano({}, request);
    if (!auth.ok) return auth.response;

    const rl = enforceRateLimit("reels", auth.userId, LIMITS.reels);
    if (rl) return rl;

    const fileGuard = await requireFile(request, "video");
    if (!fileGuard.ok) return fileGuard.response;

    const formData = fileGuard.formData;

    const durationRaw = formData.get("duration");
    if (typeof durationRaw !== "string") {
        return NextResponse.json(
            { ok: false, reason: "VALIDACAO" },
            { status: 400 },
        );
    }
    const duration = Number.parseFloat(durationRaw);

    const captionRaw = formData.get("caption");
    const caption = typeof captionRaw === "string" ? captionRaw : null;

    const posterFile = formData.get("poster");
    let posterBytes: Buffer | undefined;
    let posterMimeType: string | undefined;
    if (posterFile instanceof File && posterFile.size > 0) {
        posterBytes = Buffer.from(await posterFile.arrayBuffer());
        posterMimeType = posterFile.type;
    }

    const buffer = Buffer.from(await fileGuard.file.arrayBuffer());

    const result = await publicarReel({
        userId: auth.userId,
        plano: auth.plano.tipo,
        mimeType: fileGuard.file.type,
        bytes: buffer,
        durationSeconds: duration,
        posterBytes,
        posterMimeType,
        caption,
    });

    if (result.ok) {
        return NextResponse.json(result, { status: 200 });
    }
    if (
        result.reason === "MIDIA_INVALIDA" ||
        result.reason === "DURACAO_INVALIDA" ||
        result.reason === "CAPTION_INVALIDA"
    ) {
        return NextResponse.json(result, { status: 400 });
    }
    if (result.reason === "PLANO_NAO_PERMITE") {
        return NextResponse.json(result, { status: 403 });
    }
    if (result.reason === "LIMITE_ATIVOS") {
        return NextResponse.json(result, { status: 409 });
    }
    return NextResponse.json(result, { status: 500 });
}
