import { NextResponse } from "next/server";

import { requireAcompanhante } from "@/server/auth/guards";
import {
    removerRespostaReview,
    responderReview,
} from "@/server/reviews";

/**
 * `POST /api/reviews/[id]/reply` — Acompanhante responde a uma
 * avaliação recebida.
 *
 * Body JSON: `{ text: string }` (1..2000 chars após trim).
 *
 * Apenas a Acompanhante avaliada pode responder. Outras (mesmo
 * outras Acompanhantes) recebem 403.
 *
 * Quando já tem resposta, sobrescreve. `repliedAt` permanece o
 * instante da primeira resposta.
 */
export async function POST(
    request: Request,
    context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
    const auth = await requireAcompanhante(request);
    if (!auth.ok) return auth.response;

    const { id } = await context.params;

    let body: { text?: unknown };
    try {
        const parsed = await request.json();
        if (parsed === null || typeof parsed !== "object") {
            throw new Error();
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

    const result = await responderReview({
        reviewId: id,
        acompanhanteUserId: auth.userId,
        text: body.text,
    });
    if (!result.ok) {
        const status =
            result.reason === "NAO_ENCONTRADA"
                ? 404
                : result.reason === "NAO_E_DONA"
                    ? 403
                    : 400;
        return NextResponse.json(result, { status });
    }
    return NextResponse.json({ ok: true });
}

/**
 * `DELETE /api/reviews/[id]/reply` — remove a resposta da
 * Acompanhante.
 */
export async function DELETE(
    request: Request,
    context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
    const auth = await requireAcompanhante(request);
    if (!auth.ok) return auth.response;

    const { id } = await context.params;

    const result = await removerRespostaReview({
        reviewId: id,
        acompanhanteUserId: auth.userId,
    });
    if (!result.ok) {
        const status =
            result.reason === "NAO_ENCONTRADA"
                ? 404
                : result.reason === "NAO_E_DONA"
                    ? 403
                    : 400;
        return NextResponse.json(result, { status });
    }
    return NextResponse.json({ ok: true });
}
