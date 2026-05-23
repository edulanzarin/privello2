import { NextResponse } from "next/server";

import { requireClienteFan, requireSession } from "@/server/auth/guards";
import {
    adicionarComentario,
    listarComentarios,
} from "@/server/media-interactions";

/**
 * `GET /api/medias/[id]/comments` — lista os comentários de uma
 * mídia. Requer sessão autenticada (Cliente ou Acompanhante).
 *
 * Anônimos recebem 401 — a UI do perfil público mostra um gate
 * visual ({@link LockedContent}) e não chama este endpoint para
 * viewers sem sessão.
 *
 * Quando há sessão, marca `isMine` no comentário do próprio viewer
 * para que o front mostre botão de excluir.
 */
export async function GET(
    _request: Request,
    context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
    const { id: mediaId } = await context.params;
    if (!mediaId) {
        return NextResponse.json(
            { ok: false, reason: "VALIDACAO" },
            { status: 400 },
        );
    }

    const auth = await requireSession();
    if (!auth.ok) return auth.response;

    const comments = await listarComentarios(mediaId, auth.userId);
    return NextResponse.json({ ok: true, comments });
}

/**
 * `POST /api/medias/[id]/comments` — Cliente Fan publica um
 * comentário.
 *
 * Body JSON:
 *   - `text: string` — entre 1 e 2000 caracteres após trim.
 *
 * Resposta: `{ ok: true, commentId, commentsCount }`.
 */
export async function POST(
    request: Request,
    context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
    const auth = await requireClienteFan();
    if (!auth.ok) return auth.response;

    const { id: mediaId } = await context.params;
    if (!mediaId) {
        return NextResponse.json(
            { ok: false, reason: "VALIDACAO" },
            { status: 400 },
        );
    }

    let body: { text?: unknown };
    try {
        const parsed = await request.json();
        if (parsed === null || typeof parsed !== "object") {
            throw new Error("body inválido");
        }
        body = parsed as { text?: unknown };
    } catch {
        return NextResponse.json(
            { ok: false, reason: "VALIDACAO" },
            { status: 400 },
        );
    }

    if (typeof body.text !== "string") {
        return NextResponse.json(
            { ok: false, reason: "VALIDACAO" },
            { status: 400 },
        );
    }

    const result = await adicionarComentario({
        mediaId,
        authorUserId: auth.userId,
        text: body.text,
    });

    if (!result.ok) {
        const status = result.reason === "MEDIA_NAO_ENCONTRADA" ? 404 : 400;
        return NextResponse.json(
            { ok: false, reason: result.reason },
            { status },
        );
    }

    return NextResponse.json({
        ok: true,
        commentId: result.commentId,
        commentsCount: result.commentsCount,
    });
}
