import { NextResponse } from "next/server";

import { requireFile, requireSession } from "@/server/auth/guards";
import { replaceProfilePhoto } from "@/server/storage/replaceProfilePhoto";

/**
 * Endpoint de troca de Foto_de_Perfil para usuário autenticado.
 *
 * Aceita `multipart/form-data` com o campo `foto` (`File`). A sessão
 * é resolvida via cookie HMAC-assinado; o `userType` resolvido
 * decide qual perfil (`ClientProfile` ou `AcompanhanteProfile`) tem
 * `fotoPerfilId` atualizado.
 *
 * Mapeamento de respostas:
 *
 * - `200`: `{ ok: true, mediaId, storageKey }`.
 * - `401`: `{ ok: false, reason: "NAO_AUTENTICADO" }`.
 * - `400`: `{ ok: false, reason: "VALIDACAO" }` (FormData inválido).
 * - `400`: `{ ok: false, reason: "FOTO_INVALIDA" }` (MIME ou tamanho).
 * - `500`: `{ ok: false, reason: "PERSISTENCIA" }`.
 *
 * Endpoint compartilhado por Cliente e Acompanhante porque o fluxo é
 * idêntico — diferenciar via path criaria duplicação desnecessária.
 */
export async function POST(request: Request): Promise<NextResponse> {
    const auth = await requireSession();
    if (!auth.ok) return auth.response;

    const fileGuard = await requireFile(request, "foto");
    if (!fileGuard.ok) return fileGuard.response;

    const buffer = Buffer.from(await fileGuard.file.arrayBuffer());

    const result = await replaceProfilePhoto({
        userId: auth.userId,
        userType: auth.userType,
        mimeType: fileGuard.file.type,
        bytes: buffer,
    });

    if (result.ok) {
        return NextResponse.json(result, { status: 200 });
    }
    if (result.reason === "FOTO_INVALIDA") {
        return NextResponse.json(result, { status: 400 });
    }
    return NextResponse.json(result, { status: 500 });
}
