import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { requireAcompanhante } from "@/server/auth/guards";

/**
 * Endpoint de toggle de visibilidade do perfil público da
 * Acompanhante.
 *
 * Body JSON:
 *   { "visivel": boolean }
 *
 * Atualiza `acompanhante_profiles.perfil_visivel`. Quando `false`,
 * o perfil some das buscas e o `/acompanhantes/[slug]` mostra a
 * tela "perfil oculto ou desativado". Não afeta o painel privado —
 * a Acompanhante continua vendo tudo dela mesma.
 *
 * Mapeamento de respostas:
 * - `200`: `{ ok: true, visivel }`.
 * - `400`: `{ ok: false, reason: "VALIDACAO" }`.
 * - `401`: `{ ok: false, reason: "NAO_AUTENTICADO" }`.
 * - `403`: `{ ok: false, reason: "TIPO_INVALIDO" }`.
 * - `500`: `{ ok: false, reason: "PERSISTENCIA" }`.
 */
export async function POST(request: Request): Promise<NextResponse> {
    const auth = await requireAcompanhante();
    if (!auth.ok) return auth.response;

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json(
            { ok: false, reason: "VALIDACAO" },
            { status: 400 },
        );
    }

    if (
        body === null ||
        typeof body !== "object" ||
        typeof (body as { visivel?: unknown }).visivel !== "boolean"
    ) {
        return NextResponse.json(
            { ok: false, reason: "VALIDACAO" },
            { status: 400 },
        );
    }

    const visivel = (body as { visivel: boolean }).visivel;

    try {
        await db.acompanhanteProfile.update({
            where: { userId: auth.userId },
            data: { perfilVisivel: visivel },
            select: { userId: true },
        });
    } catch {
        return NextResponse.json(
            { ok: false, reason: "PERSISTENCIA" },
            { status: 500 },
        );
    }

    return NextResponse.json({ ok: true, visivel }, { status: 200 });
}
