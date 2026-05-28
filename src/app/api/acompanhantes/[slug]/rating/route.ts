import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { requireClienteFan } from "@/server/auth/guards";
import { obterNotaGeral } from "@/server/reviews";

/**
 * `GET /api/acompanhantes/[slug]/rating` — nota geral agregada.
 *
 * Resposta:
 *
 * ```json
 * {
 *   "ok": true,
 *   "totalComNota": 8,
 *   "media": 4.5,
 *   "distribuicao": { "1": 0, "2": 0, "3": 1, "4": 2, "5": 5 }
 * }
 * ```
 *
 * Gated: apenas Cliente Fan ativo (ou Acompanhante) pode consumir.
 * Anônimo / Cliente Grátis recebe 402 — UI mostra paywall.
 */
export async function GET(
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

    const resumo = await obterNotaGeral(target.id);

    return NextResponse.json({
        ok: true,
        totalComNota: resumo.totalComNota,
        media: resumo.media,
        distribuicao: resumo.distribuicao,
    });
}
