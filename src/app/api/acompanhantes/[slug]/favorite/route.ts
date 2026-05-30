import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { requireCliente } from "@/server/auth/guards";
import { enforceRateLimit } from "@/server/auth/rateLimitGuard";
import { toggleFavorito } from "@/server/favorites";

export const runtime = "nodejs";

/**
 * `POST /api/acompanhantes/[slug]/favorite` — toggle do favorito.
 *
 * Cliente logado marca/desmarca uma Acompanhante como favorita.
 * Idempotente: chamar 2x volta ao estado anterior.
 *
 * Mapeamento:
 * - `200`: `{ ok: true, favorito: boolean }`.
 * - `401`: `NAO_AUTENTICADO`.
 * - `403`: `TIPO_INVALIDO` (Acompanhante tentando favoritar).
 * - `404`: `ALVO_INVALIDO` (slug inexistente).
 * - `400`: `AUTO_FAVORITAR` (não deveria acontecer com guard
 *   `requireCliente`, mas defensivo).
 * - `429`: `RATE_LIMITED`.
 * - `500`: `PERSISTENCIA`.
 */
export async function POST(
    request: Request,
    context: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
    const auth = await requireCliente(request);
    if (!auth.ok) return auth.response;

    const rl = enforceRateLimit("favorites", auth.userId, {
        max: 60,
        windowMs: 60_000,
    });
    if (rl) return rl;

    const { slug } = await context.params;
    const slugNorm = slug.trim().toLowerCase();
    if (slugNorm.length === 0) {
        return NextResponse.json(
            { ok: false, reason: "ALVO_INVALIDO" },
            { status: 404 },
        );
    }

    const target = await db.user.findFirst({
        where: { identificador: slugNorm, type: "ACOMPANHANTE" },
        select: { id: true },
    });
    if (!target) {
        return NextResponse.json(
            { ok: false, reason: "ALVO_INVALIDO" },
            { status: 404 },
        );
    }

    const result = await toggleFavorito({
        clientUserId: auth.userId,
        acompanhanteUserId: target.id,
    });

    if (result.ok) {
        return NextResponse.json(result, { status: 200 });
    }
    if (result.reason === "ALVO_INVALIDO") {
        return NextResponse.json(result, { status: 404 });
    }
    if (result.reason === "AUTO_FAVORITAR") {
        return NextResponse.json(result, { status: 400 });
    }
    return NextResponse.json(result, { status: 500 });
}
