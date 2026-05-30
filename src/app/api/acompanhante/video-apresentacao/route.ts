import { NextResponse } from "next/server";

import {
    requireAcompanhanteWithPlano,
    requireFile,
} from "@/server/auth/guards";
import { enforceRateLimit, LIMITS } from "@/server/auth/rateLimitGuard";
import {
    excluirVideoApresentacao,
    publicarVideoApresentacao,
} from "@/server/storage/videoApresentacao";

export const runtime = "nodejs";

/**
 * Endpoints do Vídeo de apresentação (T08).
 *
 * Premium-only — `requireAcompanhanteWithPlano({ permiteAudio: true })`
 * cobre o gate (mesmo critério do áudio).
 *
 * - `PUT /api/acompanhante/video-apresentacao` — publica/substitui.
 *   Body: `multipart/form-data` com `video` (File) +
 *   `durationSeconds` (string com número).
 * - `DELETE` — remove.
 *
 * Status:
 *   - 200: ok.
 *   - 400: `VIDEO_INVALIDO` | `DURACAO_INVALIDA` | `VALIDACAO`.
 *   - 401: `NAO_AUTENTICADO`.
 *   - 403: `TIPO_INVALIDO` | `PLANO_INVALIDO`.
 *   - 404: `VIDEO_NAO_ENCONTRADO` | `PERFIL_NAO_ENCONTRADO`.
 *   - 409: `SEM_PLANO`.
 *   - 429: `RATE_LIMITED`.
 *   - 500: `PERSISTENCIA`.
 */

export async function PUT(request: Request): Promise<NextResponse> {
    const auth = await requireAcompanhanteWithPlano(
        { permiteAudio: true },
        request,
    );
    if (!auth.ok) return auth.response;

    const rl = enforceRateLimit("medias", auth.userId, LIMITS.medias);
    if (rl) return rl;

    const fileGuard = await requireFile(request, "video");
    if (!fileGuard.ok) return fileGuard.response;

    const buffer = Buffer.from(await fileGuard.file.arrayBuffer());

    // duração — `requireFile` consome o body uma vez; lemos
    // duração da query string (`?duration=N`) pra evitar parsear
    // o multipart 2x. Frontend envia ambos.
    const url = new URL(request.url);
    const durationRaw = url.searchParams.get("duration");
    const durationSeconds = durationRaw ? Number.parseFloat(durationRaw) : NaN;

    const result = await publicarVideoApresentacao({
        userId: auth.userId,
        mimeType: fileGuard.file.type,
        bytes: buffer,
        durationSeconds,
    });

    if (result.ok) {
        return NextResponse.json(result, { status: 200 });
    }
    if (
        result.reason === "VIDEO_INVALIDO" ||
        result.reason === "DURACAO_INVALIDA"
    ) {
        return NextResponse.json(result, { status: 400 });
    }
    if (result.reason === "PERFIL_NAO_ENCONTRADO") {
        return NextResponse.json(result, { status: 404 });
    }
    return NextResponse.json(result, { status: 500 });
}

export async function DELETE(request: Request): Promise<NextResponse> {
    const auth = await requireAcompanhanteWithPlano(
        { permiteAudio: true },
        request,
    );
    if (!auth.ok) return auth.response;

    const result = await excluirVideoApresentacao(auth.userId);
    if (result.ok) {
        return NextResponse.json(result, { status: 200 });
    }
    if (
        result.reason === "VIDEO_NAO_ENCONTRADO" ||
        result.reason === "PERFIL_NAO_ENCONTRADO"
    ) {
        return NextResponse.json(result, { status: 404 });
    }
    return NextResponse.json(result, { status: 500 });
}
