import { NextResponse } from "next/server";

import { requireAcompanhante } from "@/server/auth/guards";
import { excluirStory } from "@/server/storage/storyMedia";

/**
 * `DELETE /api/acompanhante/stories/[id]` — remove um Story antes
 * da expiração natural (24h). Idempotente.
 *
 * Mapeamento de respostas:
 *
 * - `200`: `{ ok: true }`.
 * - `401`: `{ ok: false, reason: "NAO_AUTENTICADO" }`.
 * - `403`: `{ ok: false, reason: "TIPO_INVALIDO" }`.
 * - `404`: `{ ok: false, reason: "NAO_ENCONTRADO" }`.
 * - `500`: `{ ok: false, reason: "PERSISTENCIA" }`.
 */
export async function DELETE(
    request: Request,
    context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
    const auth = await requireAcompanhante(request);
    if (!auth.ok) return auth.response;

    const { id } = await context.params;
    if (!id) {
        return NextResponse.json(
            { ok: false, reason: "VALIDACAO" },
            { status: 400 },
        );
    }

    const result = await excluirStory(auth.userId, id);
    if (result.ok) {
        return NextResponse.json(result, { status: 200 });
    }
    if (result.reason === "NAO_ENCONTRADO") {
        return NextResponse.json(result, { status: 404 });
    }
    return NextResponse.json(result, { status: 500 });
}
