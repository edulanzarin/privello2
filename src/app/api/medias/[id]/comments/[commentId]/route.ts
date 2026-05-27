import { NextResponse } from "next/server";

import { requireCliente } from "@/server/auth/guards";
import { removerComentario } from "@/server/media-interactions";

/**
 * `DELETE /api/medias/[id]/comments/[commentId]` — Cliente exclui
 * o próprio comentário.
 *
 * Idempotente: se o comentário não existe (já foi removido),
 * retorna 404 mas a UI pode tratar igualmente.
 */
export async function DELETE(
    request: Request,
    context: {
        params: Promise<{ id: string; commentId: string }>;
    },
): Promise<NextResponse> {
    const auth = await requireCliente(request);
    if (!auth.ok) return auth.response;

    const { commentId } = await context.params;
    if (!commentId) {
        return NextResponse.json(
            { ok: false, reason: "VALIDACAO" },
            { status: 400 },
        );
    }

    const result = await removerComentario(commentId, auth.userId);
    if (!result.ok) {
        const status =
            result.reason === "NAO_ENCONTRADO"
                ? 404
                : 403; // NAO_E_AUTOR
        return NextResponse.json(
            { ok: false, reason: result.reason },
            { status },
        );
    }

    return NextResponse.json({
        ok: true,
        commentsCount: result.commentsCount,
    });
}
