import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getCurrentSession } from "@/server/auth/currentSession";
import { enforceCsrf } from "@/server/auth/csrf";
import {
    VIEW_COOLDOWN_SECONDS,
    buildViewCooldownCookieName,
    incrementarVisualizacao,
    viewCooldownAtivo,
} from "@/server/acompanhante-profile/views";

/**
 * `POST /api/acompanhantes/[slug]/view`
 *
 * Registra uma visualização pública do perfil de uma Acompanhante.
 * Idempotente dentro de uma janela de 6h via cookie HTTP-only por
 * viewer (`pv_<userId>`).
 *
 * Por que Route Handler em vez de RSC: o Next 15 proíbe
 * `cookies().set()` durante o render de RSC ("Cookies can only be
 * modified in a Server Action or Route Handler"). A solução é o
 * client da página fazer um `fetch` para este endpoint após mount —
 * o tracker invisível é responsabilidade de
 * {@link import("../../../../(shell)/acompanhantes/[slug]/_perfilPublico/ViewTracker").ViewTracker}.
 *
 * Comportamento:
 *
 *   - 204: visualização contada com sucesso.
 *   - 304: cooldown ativo, nada a fazer (ainda assim retorna 200 vazio).
 *   - 404: slug não corresponde a uma Acompanhante.
 *
 * Falhas de banco não derrubam o caller — sempre retornamos OK do
 * lado da request, e o erro é absorvido por `incrementarVisualizacao`.
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

    // Pula quando o cooldown está ativo. A leitura de cookie em
    // route handler é OK; só a gravação que precisa de Server Action
    // ou Route Handler — estamos nesse último caso, então nada
    // bloqueia.
    if (await viewCooldownAtivo(target.id)) {
        return NextResponse.json({ ok: true, applied: false });
    }

    const session = await getCurrentSession();
    const result = await incrementarVisualizacao(
        target.id,
        session?.userId ?? null,
    );

    if (!result.applied) {
        return NextResponse.json({ ok: true, applied: false });
    }

    // Grava o cookie de cooldown — só agora porque estamos em Route
    // Handler.
    const cookieStore = await cookies();
    cookieStore.set({
        name: buildViewCooldownCookieName(target.id),
        value: "1",
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: VIEW_COOLDOWN_SECONDS,
    });

    return NextResponse.json({ ok: true, applied: true });
}
