import { NextResponse } from "next/server";

import { requireAdmin } from "@/server/auth/guards";
import { aprovarVerificacao } from "@/server/verification";

export const runtime = "nodejs";

/**
 * `POST /api/admin/verificacoes/[id]/aprovar`
 *
 * Mapeamento:
 * - `200`: `{ ok: true }`.
 * - `401`: `NAO_AUTENTICADO`.
 * - `403`: `NAO_ADMIN`.
 * - `404`: `NAO_ENCONTRADA`.
 * - `500`: `PERSISTENCIA`.
 */
export async function POST(
    request: Request,
    context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const { id } = await context.params;
    const result = await aprovarVerificacao({
        verificationId: id,
        adminUserId: auth.userId,
    });

    if (result.ok) return NextResponse.json(result, { status: 200 });
    if (result.reason === "NAO_ENCONTRADA") {
        return NextResponse.json(result, { status: 404 });
    }
    return NextResponse.json(result, { status: 500 });
}
