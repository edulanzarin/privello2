import { NextResponse } from "next/server";

import { requireAcompanhante } from "@/server/auth/guards";
import { excluirReel } from "@/server/storage/reelMedia";

/**
 * `DELETE /api/acompanhante/reels/[id]` — exclui um Reel próprio.
 *
 * Soft-delete (status=DELETED). O arquivo no R2 é apagado pelo GC
 * noturno. Idempotente — apagar um Reel já apagado retorna 200.
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

    const result = await excluirReel(auth.userId, id);

    if (result.ok) {
        return NextResponse.json({ ok: true }, { status: 200 });
    }
    if (result.reason === "NAO_ENCONTRADO") {
        return NextResponse.json(result, { status: 404 });
    }
    return NextResponse.json(result, { status: 500 });
}
