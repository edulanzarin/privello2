import { NextResponse } from "next/server";

import {
    requireAcompanhanteWithPlano,
    requireFile,
} from "@/server/auth/guards";
import { enforceRateLimit, LIMITS } from "@/server/auth/rateLimitGuard";
import { publicarMidia } from "@/server/storage/galleryMedia";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Endpoint de publicação de mídia na galeria da Acompanhante.
 *
 * Aceita `multipart/form-data` com:
 * - `foto` (`File`): arquivo de imagem ou vídeo.
 * - `description` (`string`, opcional): texto descritivo.
 *
 * Resolve a sessão via cookie HMAC-assinado, recusa quem não é
 * Acompanhante e busca o plano vigente para passar o `limiteDoPlano`
 * para `publicarMidia` (que checa dentro da transação).
 *
 * Mapeamento de respostas:
 *
 * - `200`: `{ ok: true, mediaId, storageKey, kind }`.
 * - `401`: `{ ok: false, reason: "NAO_AUTENTICADO" }`.
 * - `403`: `{ ok: false, reason: "TIPO_INVALIDO" }`.
 * - `409`: `{ ok: false, reason: "SEM_PLANO" }`.
 * - `400`: `{ ok: false, reason: "VALIDACAO" }`.
 * - `400`: `{ ok: false, reason: "MIDIA_INVALIDA" | "DESCRICAO_INVALIDA" }`.
 * - `409`: `{ ok: false, reason: "LIMITE_ATINGIDO" }`.
 * - `500`: `{ ok: false, reason: "PERSISTENCIA" }`.
 */
export async function POST(request: Request): Promise<NextResponse> {
    const auth = await requireAcompanhanteWithPlano({}, request);
    if (!auth.ok) return auth.response;

    const rl = enforceRateLimit("medias", auth.userId, LIMITS.medias);
    if (rl) return rl;

    const fileGuard = await requireFile(request, "foto");
    if (!fileGuard.ok) return fileGuard.response;

    const descriptionRaw = fileGuard.formData.get("description");
    const description =
        typeof descriptionRaw === "string" ? descriptionRaw : "";

    const buffer = Buffer.from(await fileGuard.file.arrayBuffer());

    const result = await publicarMidia({
        userId: auth.userId,
        mimeType: fileGuard.file.type,
        bytes: buffer,
        description,
        limiteDoPlano: auth.plano.limiteMidias,
    });

    if (result.ok) {
        return NextResponse.json(result, { status: 200 });
    }
    if (
        result.reason === "MIDIA_INVALIDA" ||
        result.reason === "DESCRICAO_INVALIDA"
    ) {
        return NextResponse.json(result, { status: 400 });
    }
    if (result.reason === "LIMITE_ATINGIDO") {
        return NextResponse.json(result, { status: 409 });
    }
    return NextResponse.json(result, { status: 500 });
}
