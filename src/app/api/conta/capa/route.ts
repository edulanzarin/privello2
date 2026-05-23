import { NextResponse } from "next/server";

import { requireAcompanhante, requireFile } from "@/server/auth/guards";
import { replaceCoverPhoto } from "@/server/storage/replaceCoverPhoto";

/**
 * Endpoint de troca da Capa_de_Perfil (banner) da Acompanhante.
 *
 * Aceita `multipart/form-data` com `foto` (`File`). Recusa quando o
 * usuário não é Acompanhante (Cliente não tem capa).
 *
 * Mapeamento de respostas:
 * - `200`: `{ ok: true, mediaId, storageKey }`.
 * - `401`: `{ ok: false, reason: "NAO_AUTENTICADO" }`.
 * - `403`: `{ ok: false, reason: "TIPO_INVALIDO" }`.
 * - `400`: `{ ok: false, reason: "VALIDACAO" }` (FormData inválido).
 * - `400`: `{ ok: false, reason: "CAPA_INVALIDA" }` (MIME ou tamanho).
 * - `500`: `{ ok: false, reason: "PERSISTENCIA" }`.
 */
export async function POST(request: Request): Promise<NextResponse> {
    const auth = await requireAcompanhante();
    if (!auth.ok) return auth.response;

    const fileGuard = await requireFile(request, "foto");
    if (!fileGuard.ok) return fileGuard.response;

    const buffer = Buffer.from(await fileGuard.file.arrayBuffer());

    const result = await replaceCoverPhoto({
        userId: auth.userId,
        mimeType: fileGuard.file.type,
        bytes: buffer,
    });

    if (result.ok) {
        return NextResponse.json(result, { status: 200 });
    }
    if (result.reason === "CAPA_INVALIDA") {
        return NextResponse.json(result, { status: 400 });
    }
    return NextResponse.json(result, { status: 500 });
}
