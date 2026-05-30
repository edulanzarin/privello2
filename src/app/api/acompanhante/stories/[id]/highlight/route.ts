import { NextResponse } from "next/server";

import { requireAcompanhante } from "@/server/auth/guards";
import {
    adicionarAoDestaque,
    removerDoDestaque,
} from "@/server/storage/highlights";

export const runtime = "nodejs";

/**
 * Endpoints pra gerenciar destaques de um Story:
 *
 * - `POST /api/acompanhante/stories/[id]/highlight` — adiciona o
 *   Story (que precisa estar ARCHIVED) ao destaque com `title`.
 *   Body: `{ title: string }`. Title vazio → 400 TITULO_INVALIDO.
 * - `DELETE /api/acompanhante/stories/[id]/highlight` — remove o
 *   Story do destaque atual (zera `highlightTitle`).
 *
 * Mapeamento de status:
 *   - 200: `{ ok: true }`.
 *   - 400: `TITULO_INVALIDO` (POST).
 *   - 401: `NAO_AUTENTICADO`.
 *   - 403: `TIPO_INVALIDO` (não é Acompanhante).
 *   - 404: `STORY_INVALIDO` (não pertence ao caller ou inexistente).
 *   - 409: `STORY_NAO_ARQUIVADO` (POST: ainda ativo, não pode ser
 *     destaque).
 *   - 500: `PERSISTENCIA`.
 */
export async function POST(
    request: Request,
    context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
    const auth = await requireAcompanhante(request);
    if (!auth.ok) return auth.response;

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json(
            { ok: false, reason: "TITULO_INVALIDO" },
            { status: 400 },
        );
    }
    const title =
        body && typeof body === "object" && "title" in body
            ? (body as { title: unknown }).title
            : null;
    if (typeof title !== "string") {
        return NextResponse.json(
            { ok: false, reason: "TITULO_INVALIDO" },
            { status: 400 },
        );
    }

    const { id } = await context.params;
    const result = await adicionarAoDestaque({
        userId: auth.userId,
        storyId: id,
        title,
    });

    if (result.ok) {
        return NextResponse.json(result, { status: 200 });
    }
    if (result.reason === "TITULO_INVALIDO") {
        return NextResponse.json(result, { status: 400 });
    }
    if (result.reason === "STORY_INVALIDO") {
        return NextResponse.json(result, { status: 404 });
    }
    if (result.reason === "STORY_NAO_ARQUIVADO") {
        return NextResponse.json(result, { status: 409 });
    }
    return NextResponse.json(result, { status: 500 });
}

export async function DELETE(
    request: Request,
    context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
    const auth = await requireAcompanhante(request);
    if (!auth.ok) return auth.response;

    const { id } = await context.params;
    const result = await removerDoDestaque({
        userId: auth.userId,
        storyId: id,
    });

    if (result.ok) {
        return NextResponse.json(result, { status: 200 });
    }
    if (result.reason === "STORY_INVALIDO") {
        return NextResponse.json(result, { status: 404 });
    }
    return NextResponse.json(result, { status: 500 });
}
