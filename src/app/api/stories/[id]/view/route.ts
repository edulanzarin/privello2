import { NextResponse } from "next/server";

import { enforceCsrf } from "@/server/auth/csrf";
import { getCurrentSession } from "@/server/auth/currentSession";
import { marcarStoryComoVisto } from "@/server/storage/storyMedia";

/**
 * `POST /api/stories/[id]/view` — marca um Story como visto pelo
 * viewer autenticado. Idempotente. Anônimos não geram registro
 * (não há identidade para associar).
 *
 * O dono do Story (Acompanhante) NÃO conta como visualização.
 *
 * Respostas:
 *   - 200: `{ ok: true, applied }` — `applied: false` para anônimo
 *     ou self-view; `true` quando uma nova linha foi criada.
 *   - 404: `{ ok: false, reason: "NAO_ENCONTRADO" }`.
 */
export async function POST(
    request: Request,
    context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
    const csrf = enforceCsrf(request);
    if (csrf) return csrf;

    const { id } = await context.params;
    if (!id) {
        return NextResponse.json(
            { ok: false, reason: "VALIDACAO" },
            { status: 400 },
        );
    }

    const session = await getCurrentSession();
    if (!session) {
        // Anônimo — nada a registrar.
        return NextResponse.json({ ok: true, applied: false });
    }

    const result = await marcarStoryComoVisto(id, session.userId);
    if (!result.ok) {
        return NextResponse.json(
            { ok: false, reason: result.reason },
            { status: 404 },
        );
    }
    return NextResponse.json({ ok: true, applied: true });
}
