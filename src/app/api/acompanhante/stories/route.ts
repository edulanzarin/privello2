import { NextResponse } from "next/server";

import {
    requireAcompanhanteWithPlano,
    requireFile,
} from "@/server/auth/guards";
import { publicarStory } from "@/server/storage/storyMedia";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * `POST /api/acompanhante/stories` — publica um Story.
 *
 * Aceita `multipart/form-data` com:
 *   - `foto` (`File`): imagem ou vídeo (mesmas regras de
 *     `validarGaleriaMidia`).
 *
 * Exige `Plano_Premium` (que tem `permiteStories === true`).
 *
 * Mapeamento de respostas:
 *
 * - `200`: `{ ok: true, mediaId, storageKey, kind, expiresAt }`.
 * - `401`: `{ ok: false, reason: "NAO_AUTENTICADO" }`.
 * - `403`: `{ ok: false, reason: "TIPO_INVALIDO" | "PLANO_INVALIDO" }`.
 * - `409`: `{ ok: false, reason: "SEM_PLANO" }`.
 * - `400`: `{ ok: false, reason: "MIDIA_INVALIDA" | "VALIDACAO" }`.
 * - `409`: `{ ok: false, reason: "LIMITE_ATIVOS" }`.
 * - `500`: `{ ok: false, reason: "PERSISTENCIA" }`.
 */
export async function POST(request: Request): Promise<NextResponse> {
    const auth = await requireAcompanhanteWithPlano(
        { permiteStories: true },
        request,
    );
    if (!auth.ok) return auth.response;

    const fileGuard = await requireFile(request, "foto");
    if (!fileGuard.ok) return fileGuard.response;

    const captionRaw = fileGuard.formData.get("caption");
    const caption = typeof captionRaw === "string" ? captionRaw : "";

    const buffer = Buffer.from(await fileGuard.file.arrayBuffer());

    const result = await publicarStory({
        userId: auth.userId,
        mimeType: fileGuard.file.type,
        bytes: buffer,
        caption,
    });

    if (result.ok) {
        return NextResponse.json(result, { status: 200 });
    }
    if (
        result.reason === "MIDIA_INVALIDA" ||
        result.reason === "CAPTION_INVALIDA"
    ) {
        return NextResponse.json(result, { status: 400 });
    }
    if (result.reason === "LIMITE_ATIVOS") {
        return NextResponse.json(result, { status: 409 });
    }
    return NextResponse.json(result, { status: 500 });
}
