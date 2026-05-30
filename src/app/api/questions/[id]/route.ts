import { NextResponse } from "next/server";

import {
    requireAcompanhante,
    requireClienteFan,
    requireSession,
} from "@/server/auth/guards";
import { enforceRateLimit, LIMITS } from "@/server/auth/rateLimitGuard";
import {
    excluirPergunta,
    removerResposta,
    responderPergunta,
} from "@/server/questions";

/**
 * `POST /api/questions/[id]` — Acompanhante responde (ou edita
 * resposta) uma pergunta.
 *
 * Body JSON:
 *   - `answer`: string entre 1 e 2000 chars.
 */
export async function POST(
    request: Request,
    context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
    const auth = await requireAcompanhante(request);
    if (!auth.ok) return auth.response;

    const rl = enforceRateLimit(
        "questionAnswers",
        auth.userId,
        LIMITS.questionAnswers,
    );
    if (rl) return rl;

    const { id } = await context.params;
    if (!id) {
        return NextResponse.json(
            { ok: false, reason: "VALIDACAO" },
            { status: 400 },
        );
    }

    let body: { answer?: unknown };
    try {
        const parsed = await request.json();
        if (parsed === null || typeof parsed !== "object") {
            throw new Error("body inválido");
        }
        body = parsed as { answer?: unknown };
    } catch {
        return NextResponse.json(
            { ok: false, reason: "VALIDACAO" },
            { status: 400 },
        );
    }

    if (typeof body.answer !== "string") {
        return NextResponse.json(
            {
                ok: false,
                reason: "VALIDACAO",
                detalhes: { answer: "Escreva sua resposta." },
            },
            { status: 400 },
        );
    }

    const result = await responderPergunta({
        questionId: id,
        targetUserId: auth.userId,
        answer: body.answer,
    });

    if (!result.ok) {
        const status =
            result.reason === "PERGUNTA_NAO_ENCONTRADA"
                ? 404
                : result.reason === "NAO_E_DESTINATARIO"
                    ? 403
                    : 400;
        return NextResponse.json(
            { ok: false, reason: result.reason },
            { status },
        );
    }

    return NextResponse.json({ ok: true }, { status: 200 });
}

/**
 * `DELETE /api/questions/[id]` — duas semânticas, decididas pelo
 * `userType` da sessão:
 *
 *   - **Cliente** (autor): exclui a pergunta inteira (e a resposta
 *     se houver).
 *   - **Acompanhante** (destinatária): remove apenas a resposta,
 *     mantendo a pergunta visível como pendente.
 *
 * Em sucesso, retorna 200. Idempotente.
 */
export async function DELETE(
    request: Request,
    context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
    const auth = await requireSession(request);
    if (!auth.ok) return auth.response;

    const { id } = await context.params;
    if (!id) {
        return NextResponse.json(
            { ok: false, reason: "VALIDACAO" },
            { status: 400 },
        );
    }

    if (auth.userType === "ACOMPANHANTE") {
        const result = await removerResposta({
            questionId: id,
            targetUserId: auth.userId,
        });
        if (!result.ok) {
            const status =
                result.reason === "PERGUNTA_NAO_ENCONTRADA"
                    ? 404
                    : 403;
            return NextResponse.json(
                { ok: false, reason: result.reason },
                { status },
            );
        }
        return NextResponse.json({ ok: true });
    }

    // Cliente exclui a pergunta inteira. Reusa requireClienteFan
    // pra garantir o gating (apenas Fan pode interagir com Q&A).
    const fanAuth = await requireClienteFan(request);
    if (!fanAuth.ok) return fanAuth.response;

    const result = await excluirPergunta(id, fanAuth.userId);
    if (!result.ok) {
        const status = result.reason === "NAO_ENCONTRADA" ? 404 : 403;
        return NextResponse.json(
            { ok: false, reason: result.reason },
            { status },
        );
    }

    return NextResponse.json({ ok: true });
}
