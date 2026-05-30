import { NextResponse } from "next/server";

import {
    requireAcompanhanteWithPlano,
    requireFile,
} from "@/server/auth/guards";
import { enforceRateLimit, LIMITS } from "@/server/auth/rateLimitGuard";
import {
    excluirTopicAudio,
    isTopicAudioKind,
    publicarTopicAudio,
} from "@/server/storage/topicAudio";

export const runtime = "nodejs";

/**
 * Endpoints dos TopicAudios — áudios curtos (≤30s) por tópico.
 *
 * - `POST /api/acompanhante/audio/topic/[kind]` — publica/substitui
 *   o áudio do tópico. Body: `multipart/form-data` com campo
 *   `audio` (File). Apenas Acompanhante com `permiteAudio` (Premium).
 * - `DELETE /api/acompanhante/audio/topic/[kind]` — remove o áudio
 *   do tópico (DELETED no DB).
 *
 * Status:
 *   - 200: ok.
 *   - 400: `TOPIC_INVALIDO` | `AUDIO_INVALIDO` | `VALIDACAO`.
 *   - 401: `NAO_AUTENTICADO`.
 *   - 403: `TIPO_INVALIDO` | `PLANO_INVALIDO`.
 *   - 404: `NAO_ENCONTRADO`.
 *   - 409: `SEM_PLANO`.
 *   - 429: `RATE_LIMITED`.
 *   - 500: `PERSISTENCIA`.
 */

export async function POST(
    request: Request,
    context: { params: Promise<{ kind: string }> },
): Promise<NextResponse> {
    const auth = await requireAcompanhanteWithPlano(
        { permiteAudio: true },
        request,
    );
    if (!auth.ok) return auth.response;

    const rl = enforceRateLimit("medias", auth.userId, LIMITS.medias);
    if (rl) return rl;

    const { kind } = await context.params;
    const kindUpper = kind.toUpperCase();
    if (!isTopicAudioKind(kindUpper)) {
        return NextResponse.json(
            { ok: false, reason: "TOPIC_INVALIDO" },
            { status: 400 },
        );
    }

    const fileGuard = await requireFile(request, "audio");
    if (!fileGuard.ok) return fileGuard.response;

    const buffer = Buffer.from(await fileGuard.file.arrayBuffer());

    const result = await publicarTopicAudio({
        userId: auth.userId,
        topicKind: kindUpper,
        mimeType: fileGuard.file.type,
        bytes: buffer,
    });

    if (result.ok) {
        return NextResponse.json(result, { status: 200 });
    }
    if (
        result.reason === "AUDIO_INVALIDO" ||
        result.reason === "TOPIC_INVALIDO"
    ) {
        return NextResponse.json(result, { status: 400 });
    }
    return NextResponse.json(result, { status: 500 });
}

export async function DELETE(
    request: Request,
    context: { params: Promise<{ kind: string }> },
): Promise<NextResponse> {
    const auth = await requireAcompanhanteWithPlano(
        { permiteAudio: true },
        request,
    );
    if (!auth.ok) return auth.response;

    const { kind } = await context.params;
    const kindUpper = kind.toUpperCase();
    if (!isTopicAudioKind(kindUpper)) {
        return NextResponse.json(
            { ok: false, reason: "NAO_ENCONTRADO" },
            { status: 404 },
        );
    }

    const result = await excluirTopicAudio({
        userId: auth.userId,
        topicKind: kindUpper,
    });

    if (result.ok) {
        return NextResponse.json(result, { status: 200 });
    }
    if (result.reason === "NAO_ENCONTRADO") {
        return NextResponse.json(result, { status: 404 });
    }
    return NextResponse.json(result, { status: 500 });
}
