import { NextResponse } from "next/server";

import {
    requireAcompanhanteWithPlano,
    requireFile,
} from "@/server/auth/guards";
import {
    excluirAudioApresentacao,
    publicarAudioApresentacao,
} from "@/server/storage/audioApresentacao";

/**
 * Endpoints do Áudio_de_Apresentação ("Ouça minha voz") da
 * Acompanhante.
 *
 * - `POST`: aceita `multipart/form-data` com o campo `audio` (`File`).
 *   Substitui o áudio anterior se existir. Restrito a sessão de
 *   `ACOMPANHANTE` em `Plano_Premium` (Requirement 5.3).
 * - `DELETE`: remove o áudio atual.
 *
 * Mapeamento de respostas:
 *
 * - `200`: `{ ok: true, ... }`.
 * - `401`: `{ ok: false, reason: "NAO_AUTENTICADO" }`.
 * - `403`: `{ ok: false, reason: "TIPO_INVALIDO" }`.
 * - `403`: `{ ok: false, reason: "PLANO_INVALIDO" }`.
 * - `409`: `{ ok: false, reason: "SEM_PLANO" }`.
 * - `400`: `{ ok: false, reason: "VALIDACAO" | "AUDIO_INVALIDO" }`.
 * - `404`: `{ ok: false, reason: "AUDIO_NAO_ENCONTRADO" | "PERFIL_NAO_ENCONTRADO" }`.
 * - `500`: `{ ok: false, reason: "PERSISTENCIA" }`.
 */

export async function POST(request: Request): Promise<NextResponse> {
    const auth = await requireAcompanhanteWithPlano({ permiteAudio: true }, request);
    if (!auth.ok) return auth.response;

    const fileGuard = await requireFile(request, "audio");
    if (!fileGuard.ok) return fileGuard.response;

    const buffer = Buffer.from(await fileGuard.file.arrayBuffer());

    const result = await publicarAudioApresentacao({
        userId: auth.userId,
        mimeType: fileGuard.file.type,
        bytes: buffer,
    });

    if (result.ok) {
        return NextResponse.json(result, { status: 200 });
    }
    if (result.reason === "AUDIO_INVALIDO") {
        return NextResponse.json(result, { status: 400 });
    }
    if (result.reason === "PERFIL_NAO_ENCONTRADO") {
        return NextResponse.json(result, { status: 404 });
    }
    return NextResponse.json(result, { status: 500 });
}

export async function DELETE(request: Request): Promise<NextResponse> {
    const auth = await requireAcompanhanteWithPlano({ permiteAudio: true }, request);
    if (!auth.ok) return auth.response;

    const result = await excluirAudioApresentacao(auth.userId);
    if (result.ok) {
        return NextResponse.json(result, { status: 200 });
    }
    if (
        result.reason === "AUDIO_NAO_ENCONTRADO" ||
        result.reason === "PERFIL_NAO_ENCONTRADO"
    ) {
        return NextResponse.json(result, { status: 404 });
    }
    return NextResponse.json(result, { status: 500 });
}
