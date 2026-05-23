import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { requireCliente } from "@/server/auth/guards";
import { upsertReview } from "@/server/reviews";

/**
 * `POST /api/acompanhantes/[slug]/reviews`
 *
 * Cliente autenticado deixa (ou atualiza) sua avaliação para a
 * Acompanhante identificada pelo `slug` (`User.identificador`).
 *
 * Body JSON:
 *   - `rating`: número 1..5 (obrigatório).
 *   - `comment`: string até 2000 chars, ou `null`/omitido.
 *
 * Respostas:
 *   - 200: `{ ok: true }`. Trigger SQL já recalculou agregados.
 *   - 400: `{ ok: false, reason: "VALIDACAO" }` (rating fora de range,
 *     comentário muito longo).
 *   - 401: `{ ok: false, reason: "NAO_AUTENTICADO" }`.
 *   - 403: `{ ok: false, reason: "TIPO_INVALIDO" }` (Acompanhante
 *     tentando avaliar) ou `"AUTO_AVALIACAO"` (mesmo userId).
 *   - 404: `{ ok: false, reason: "TARGET_NAO_ENCONTRADO" }`.
 */
export async function POST(
    request: Request,
    context: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
    const auth = await requireCliente();
    if (!auth.ok) return auth.response;

    const { slug } = await context.params;
    const slugNorm = slug.trim().toLowerCase();

    let body: { rating?: unknown; comment?: unknown };
    try {
        const parsed = await request.json();
        if (parsed === null || typeof parsed !== "object") {
            throw new Error("body inválido");
        }
        body = parsed as { rating?: unknown; comment?: unknown };
    } catch {
        return NextResponse.json(
            { ok: false, reason: "VALIDACAO" },
            { status: 400 },
        );
    }

    const rating = body.rating;
    const commentRaw = body.comment;

    if (
        typeof rating !== "number" ||
        !Number.isInteger(rating) ||
        rating < 1 ||
        rating > 5
    ) {
        return NextResponse.json(
            {
                ok: false,
                reason: "VALIDACAO",
                detalhes: { rating: "Nota deve ser de 1 a 5." },
            },
            { status: 400 },
        );
    }

    let comment: string | null;
    if (commentRaw === undefined || commentRaw === null) {
        comment = null;
    } else if (typeof commentRaw !== "string") {
        return NextResponse.json(
            {
                ok: false,
                reason: "VALIDACAO",
                detalhes: { comment: "Comentário inválido." },
            },
            { status: 400 },
        );
    } else {
        const trimmed = commentRaw.trim();
        if (trimmed.length > 2000) {
            return NextResponse.json(
                {
                    ok: false,
                    reason: "VALIDACAO",
                    detalhes: {
                        comment: "Comentário deve ter até 2000 caracteres.",
                    },
                },
                { status: 400 },
            );
        }
        comment = trimmed.length > 0 ? trimmed : null;
    }

    // Resolve `slug → targetUserId`. Filtramos por `type =
    // ACOMPANHANTE` pra rejeitar identificadores de Cliente.
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
        rating,
        comment,
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
 * Cliente autenticado remove a própria avaliação. Idempotente — se
 * não havia avaliação, retorna 200 mesmo assim.
 */
export async function DELETE(
    _request: Request,
    context: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
    const auth = await requireCliente();
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
