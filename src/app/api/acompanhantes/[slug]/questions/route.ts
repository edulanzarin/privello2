import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { requireClienteFan } from "@/server/auth/guards";
import { criarPergunta } from "@/server/questions";

/**
 * `POST /api/acompanhantes/[slug]/questions`
 *
 * Cliente Fan envia uma pergunta para uma Acompanhante.
 *
 * Body JSON:
 *   - `question`: string entre 1 e 500 chars (obrigatório).
 *
 * Respostas:
 *   - 200: `{ ok: true, questionId }`.
 *   - 400: `{ ok: false, reason: "VALIDACAO" | "PERGUNTA_INVALIDA" }`.
 *   - 401: `{ ok: false, reason: "NAO_AUTENTICADO" }`.
 *   - 402: `{ ok: false, reason: "PLANO_REQUERIDO" }`.
 *   - 403: `{ ok: false, reason: "TIPO_INVALIDO" | "AUTO_PERGUNTA" }`.
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

    let body: { question?: unknown };
    try {
        const parsed = await request.json();
        if (parsed === null || typeof parsed !== "object") {
            throw new Error("body inválido");
        }
        body = parsed as { question?: unknown };
    } catch {
        return NextResponse.json(
            { ok: false, reason: "VALIDACAO" },
            { status: 400 },
        );
    }

    const questionRaw = body.question;
    if (typeof questionRaw !== "string") {
        return NextResponse.json(
            {
                ok: false,
                reason: "VALIDACAO",
                detalhes: { question: "Escreva sua pergunta." },
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

    const result = await criarPergunta({
        targetUserId: target.id,
        authorUserId: auth.userId,
        question: questionRaw,
    });

    if (!result.ok) {
        const status =
            result.reason === "AUTO_PERGUNTA"
                ? 403
                : result.reason === "TARGET_NAO_E_ACOMPANHANTE"
                    ? 404
                    : 400;
        return NextResponse.json(
            { ok: false, reason: result.reason },
            { status },
        );
    }

    return NextResponse.json(
        { ok: true, questionId: result.questionId },
        { status: 200 },
    );
}
