import { NextResponse } from "next/server";

import { requireAdmin } from "@/server/auth/guards";
import { lerImagemVerificacao } from "@/server/verification";

export const runtime = "nodejs";

/**
 * `GET /api/admin/verificacoes/[id]/foto?tipo=selfie|documento`
 *
 * Serve a imagem privada da verificação. Apenas admin.
 *
 * Mapeamento:
 * - `200`: bytes da imagem com `Content-Type` correto.
 * - `400`: `tipo` inválido.
 * - `401`: `NAO_AUTENTICADO`.
 * - `403`: `NAO_ADMIN`.
 * - `404`: imagem não encontrada.
 */
export async function GET(
    request: Request,
    context: { params: Promise<{ id: string }> },
): Promise<Response> {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const { id } = await context.params;

    const url = new URL(request.url);
    const tipo = url.searchParams.get("tipo");
    if (tipo !== "selfie" && tipo !== "documento") {
        return NextResponse.json(
            { ok: false, reason: "VALIDACAO" },
            { status: 400 },
        );
    }

    const result = await lerImagemVerificacao(id, tipo);
    if (!result) {
        return NextResponse.json(
            { ok: false, reason: "NAO_ENCONTRADA" },
            { status: 404 },
        );
    }

    return new Response(new Uint8Array(result.bytes), {
        status: 200,
        headers: {
            "Content-Type": result.mimeType,
            "Cache-Control": "private, no-store",
        },
    });
}
