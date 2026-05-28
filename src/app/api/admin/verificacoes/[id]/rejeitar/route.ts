import { NextResponse } from "next/server";

import { requireAdmin } from "@/server/auth/guards";
import { rejeitarVerificacao } from "@/server/verification";

export const runtime = "nodejs";

/**
 * `POST /api/admin/verificacoes/[id]/rejeitar`
 *
 * Body: `{ motivo: string }` (≤ 500 chars).
 *
 * Mapeamento:
 * - `200`: `{ ok: true }`.
 * - `400`: `MOTIVO_INVALIDO | VALIDACAO`.
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

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json(
            { ok: false, reason: "VALIDACAO" },
            { status: 400 },
        );
    }
    const motivo =
        body && typeof body === "object" &&
            typeof (body as { motivo?: unknown }).motivo === "string"
            ? (body as { motivo: string }).motivo
            : "";

    const result = await rejeitarVerificacao({
        verificationId: id,
        adminUserId: auth.userId,
        motivo,
    });

    if (result.ok) return NextResponse.json(result, { status: 200 });
    if (result.reason === "NAO_ENCONTRADA") {
        return NextResponse.json(result, { status: 404 });
    }
    if (result.reason === "MOTIVO_INVALIDO") {
        return NextResponse.json(result, { status: 400 });
    }
    return NextResponse.json(result, { status: 500 });
}
