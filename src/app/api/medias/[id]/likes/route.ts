import { NextResponse } from "next/server";

import { requireClienteFan } from "@/server/auth/guards";
import { toggleLike } from "@/server/media-interactions";

/**
 * `POST /api/medias/[id]/likes` — liga/desliga curtida.
 *
 * Body JSON:
 *   - `liked: boolean` — estado desejado.
 *
 * Apenas Cliente Fan pode chamar. Cliente Grátis recebe 402
 * (`PLANO_REQUERIDO`) e a UI redireciona pra `/cliente/selecao-plano`.
 *
 * Resposta de sucesso: `{ ok: true, liked, likesCount }`.
 */
export async function POST(
    request: Request,
    context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
    const auth = await requireClienteFan();
    if (!auth.ok) return auth.response;

    const { id: mediaId } = await context.params;
    if (!mediaId || mediaId.length === 0) {
        return NextResponse.json(
            { ok: false, reason: "VALIDACAO" },
            { status: 400 },
        );
    }

    let body: { liked?: unknown };
    try {
        const parsed = await request.json();
        if (parsed === null || typeof parsed !== "object") {
            throw new Error("body inválido");
        }
        body = parsed as { liked?: unknown };
    } catch {
        return NextResponse.json(
            { ok: false, reason: "VALIDACAO" },
            { status: 400 },
        );
    }

    if (typeof body.liked !== "boolean") {
        return NextResponse.json(
            { ok: false, reason: "VALIDACAO" },
            { status: 400 },
        );
    }

    try {
        const result = await toggleLike(mediaId, auth.userId, body.liked);
        return NextResponse.json({ ok: true, ...result });
    } catch (err: unknown) {
        // P2003 (foreign key) significa que a media não existe.
        const code = (err as { code?: string }).code;
        if (code === "P2003") {
            return NextResponse.json(
                { ok: false, reason: "MEDIA_NAO_ENCONTRADA" },
                { status: 404 },
            );
        }
        return NextResponse.json(
            { ok: false, reason: "PERSISTENCIA" },
            { status: 500 },
        );
    }
}
