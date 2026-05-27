import { NextResponse } from "next/server";

import { requireAcompanhante } from "@/server/auth/guards";
import { excluirMidia } from "@/server/storage/galleryMedia-delete";

/**
 * Endpoint de exclusão de mídia da galeria da Acompanhante.
 *
 * Mapeamento de respostas:
 * - `200`: `{ ok: true }`.
 * - `401`: `{ ok: false, reason: "NAO_AUTENTICADO" }`.
 * - `403`: `{ ok: false, reason: "TIPO_INVALIDO" }`.
 * - `404`: `{ ok: false, reason: "NAO_ENCONTRADA" }`.
 * - `500`: `{ ok: false, reason: "PERSISTENCIA" }`.
 */
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
    const auth = await requireAcompanhante(request);
    if (!auth.ok) return auth.response;

    const { id } = await params;

    const result = await excluirMidia({
        userId: auth.userId,
        mediaId: id,
    });

    if (result.ok) {
        return NextResponse.json(result, { status: 200 });
    }
    if (result.reason === "NAO_ENCONTRADA") {
        return NextResponse.json(result, { status: 404 });
    }
    return NextResponse.json(result, { status: 500 });
}
