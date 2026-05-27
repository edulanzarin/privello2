import { NextResponse } from "next/server";
import { z } from "zod";

import { clearSessionCookieHeader } from "@/server/auth/logout";
import { excluirConta } from "@/server/auth/excluirConta";
import { requireSession } from "@/server/auth/guards";

/**
 * `DELETE /api/conta` — exclui a conta do usuário autenticado
 * (LGPD).
 *
 * Body JSON:
 *   - `password`: senha atual (reautenticação obrigatória).
 *
 * Comportamento:
 *   - Apaga `User` (Cascade leva ClientProfile/AcompanhanteProfile,
 *     Sessions, Media, MediaLike, MediaComment, StoryView,
 *     Reviews, Questions, BoostPayment).
 *   - Best-effort apaga arquivos do R2 (foto, capa, áudio, galeria,
 *     stories).
 *   - Limpa cookie de sessão na resposta.
 *
 * Respostas:
 *   - 200: `{ ok: true, deletedFiles, failedFiles }` + cookie limpo.
 *   - 400: `{ ok: false, reason: "VALIDACAO" }`.
 *   - 401: `{ ok: false, reason: "NAO_AUTENTICADO" }`.
 *   - 401: `{ ok: false, reason: "SENHA_INCORRETA" }`.
 *   - 500: `{ ok: false, reason: "PERSISTENCIA" }`.
 */
const bodySchema = z.object({
    password: z.string().min(1),
});

export async function DELETE(request: Request): Promise<NextResponse> {
    const auth = await requireSession(request);
    if (!auth.ok) return auth.response;

    let raw: unknown;
    try {
        raw = await request.json();
    } catch {
        return NextResponse.json(
            { ok: false, reason: "VALIDACAO" },
            { status: 400 },
        );
    }

    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
        return NextResponse.json(
            { ok: false, reason: "VALIDACAO" },
            { status: 400 },
        );
    }

    const result = await excluirConta(auth.userId, parsed.data.password);

    if (!result.ok) {
        const status =
            result.reason === "SENHA_INCORRETA"
                ? 401
                : result.reason === "USUARIO_NAO_ENCONTRADO"
                    ? 404
                    : 500;
        return NextResponse.json(
            { ok: false, reason: result.reason },
            { status },
        );
    }

    const response = NextResponse.json(
        {
            ok: true,
            deletedFiles: result.deletedFiles,
            failedFiles: result.failedFiles,
        },
        { status: 200 },
    );
    response.headers.append("Set-Cookie", clearSessionCookieHeader());
    return response;
}
