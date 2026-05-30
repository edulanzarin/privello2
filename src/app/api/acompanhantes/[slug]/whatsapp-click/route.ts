import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getCurrentSession } from "@/server/auth/currentSession";
import { enforceCsrf } from "@/server/auth/csrf";
import { registrarCliqueWhatsapp } from "@/server/acompanhante-profile/stats";

export const runtime = "nodejs";

/**
 * `POST /api/acompanhantes/[slug]/whatsapp-click`
 *
 * Registra um clique no botão de WhatsApp do perfil público (T10 —
 * métrica de conversão visualização → contato). Fire-and-forget do
 * client: o redirecionamento pro WhatsApp acontece independente da
 * resposta.
 *
 * Não há cooldown — cada clique conta (interesse real). Auto-clique
 * (a própria Acompanhante) é ignorado pra não inflar a conversão.
 *
 * Respostas:
 *   - 200: `{ ok: true, applied }`.
 *   - 404: slug não corresponde a uma Acompanhante.
 */
export async function POST(
    request: Request,
    context: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
    const csrf = enforceCsrf(request);
    if (csrf) return csrf;

    const { slug } = await context.params;
    const slugNorm = slug.trim().toLowerCase();
    if (slugNorm.length === 0) {
        return NextResponse.json(
            { ok: false, reason: "VALIDACAO" },
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

    // Auto-clique não conta.
    const session = await getCurrentSession();
    if (session?.userId === target.id) {
        return NextResponse.json({ ok: true, applied: false });
    }

    await registrarCliqueWhatsapp({ userId: target.id });

    return NextResponse.json({ ok: true, applied: true });
}
