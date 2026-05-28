import { NextResponse } from "next/server";

import { getCurrentSession } from "@/server/auth/currentSession";
import { enforceCsrf } from "@/server/auth/csrf";
import { obterPerfilCliente } from "@/server/cliente-profile";
import { marcarReelComoVisto } from "@/server/storage/reelMedia";

/**
 * `POST /api/reels/[id]/view` — registra visualização de um Reel.
 *
 * Anônimos: NÃO chamam este endpoint (contagem é feita só
 * client-side via cookie pra eles, sem persistência). Frontend
 * decide.
 *
 * Cliente / Acompanhante autenticados: persiste em `reel_views`.
 * Idempotente — visualizar de novo não duplica.
 *
 * Resposta:
 *   - `200 { ok: true, quotaEstourada: false }` — visualização contada.
 *   - `200 { ok: true, quotaEstourada: true }` — viewer Grátis bateu
 *     na quota de 24h. Frontend deve mostrar paywall.
 *   - `404 { ok: false, reason: "NAO_ENCONTRADO" }` — reel inexistente.
 *   - `401 { ok: false, reason: "NAO_AUTENTICADO" }` — sem sessão.
 */
export async function POST(
    request: Request,
    context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
    const csrf = enforceCsrf(request);
    if (csrf) return csrf;

    const session = await getCurrentSession();
    if (!session) {
        return NextResponse.json(
            { ok: false, reason: "NAO_AUTENTICADO" },
            { status: 401 },
        );
    }

    const { id } = await context.params;
    if (!id) {
        return NextResponse.json(
            { ok: false, reason: "VALIDACAO" },
            { status: 400 },
        );
    }

    // Resolve plano do Cliente pra calcular quota corretamente.
    let clientePlano: "GRATIS" | "FAN" | null = null;
    if (session.userType === "CLIENTE") {
        const profile = await obterPerfilCliente(session.userId);
        clientePlano = profile?.planoVigente ?? null;
    }

    const result = await marcarReelComoVisto(id, session.userId, {
        viewerType: session.userType,
        clientePlano,
    });

    if (!result.ok) {
        return NextResponse.json(result, { status: 404 });
    }

    return NextResponse.json({
        ok: true,
        quotaEstourada: result.quotaEstourada,
    });
}
