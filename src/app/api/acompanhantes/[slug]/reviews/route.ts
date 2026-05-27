import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { requireClienteFan } from "@/server/auth/guards";
import { upsertReview } from "@/server/reviews";

/**
 * `POST /api/acompanhantes/[slug]/reviews`
 *
 * Cliente Fan deixa (ou atualiza) sua avaliação para a Acompanhante
 * identificada pelo `slug` (`User.identificador`).
 *
 * Avaliação é apenas texto (sem nota numérica).
 *
 * Body JSON:
 *   - `comment`: string entre 1 e 2000 chars (obrigatório).
 *
 * Respostas:
 *   - 200: `{ ok: true }`. Trigger SQL recalculou `reviewsCount`.
 *   - 400: `{ ok: false, reason: "VALIDACAO" | "COMENTARIO_INVALIDO" }`.
 *   - 401: `{ ok: false, reason: "NAO_AUTENTICADO" }`.
 *   - 402: `{ ok: false, reason: "PLANO_REQUERIDO" }`.
 *   - 403: `{ ok: false, reason: "TIPO_INVALIDO" | "AUTO_AVALIACAO" }`.
 *   - 404: `{ ok: false, reason: "TARGET_NAO_ENCONTRADO" }`.
 */
export async function POST(
    request: Request,
    context: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
    const auth = await requireClienteFan(request);
    if (!auth.ok) return auth.response;

    const { slug } = await context.params;
    const slugNorm = slug.trim().toLowerCase();

    let body: { comment?: unknown };
    try {
        const parsed = await request.json();
        if (parsed === null || typeof parsed !== "object") {
            throw new Error("body inválido");
        }
        body = parsed as { comment?: unknown };
    } catch {
        return NextResponse.json(
            { ok: false, reason: "VALIDACAO" },
            { status: 400 },
        );
    }

    const commentRaw = body.comment;
    if (typeof commentRaw !== "string") {
        return NextResponse.json(
            {
                ok: false,
                reason: "VALIDACAO",
                detalhes: { comment: "Escreva sua avaliação." },
            },
            { status: 400 },
        );
    }

    const target = await db.user.findFirst({
        where: { identificador: slugNorm, type: "ACOMPANHANTE" },
        select: { id: true },
    });
    if (!target) {
        return NextResponse.json(
            { ok: false, reason: "TARGET_NAO_ENCONTRADO" },
            { status: 404 },
        );
    }

    const result = await upsertReview({
        targetUserId: target.id,
        authorUserId: auth.userId,
        comment: commentRaw,
    });

    if (!result.ok) {
        const status =
            result.reason === "AUTO_AVALIACAO"
                ? 403
                : result.reason === "TARGET_NAO_E_ACOMPANHANTE"
                    ? 404
                    : 400;
        return NextResponse.json(
            { ok: false, reason: result.reason },
            { status },
        );
    }

    return NextResponse.json({ ok: true }, { status: 200 });
}

/**
 * `DELETE /api/acompanhantes/[slug]/reviews`
 *
 * Cliente Fan remove a própria avaliação. Idempotente.
 */
export async function DELETE(
    request: Request,
    context: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
    const auth = await requireClienteFan(request);
    if (!auth.ok) return auth.response;

    const { slug } = await context.params;
    const slugNorm = slug.trim().toLowerCase();

    const target = await db.user.findFirst({
        where: { identificador: slugNorm, type: "ACOMPANHANTE" },
        select: { id: true },
    });
    if (!target) {
        return NextResponse.json(
            { ok: false, reason: "TARGET_NAO_ENCONTRADO" },
            { status: 404 },
        );
    }

    await db.acompanhanteReview
        .delete({
            where: {
                targetUserId_authorUserId: {
                    targetUserId: target.id,
                    authorUserId: auth.userId,
                },
            },
        })
        .catch(() => {
            // Idempotente: se não havia review, ignora.
        });

    return NextResponse.json({ ok: true }, { status: 200 });
}
