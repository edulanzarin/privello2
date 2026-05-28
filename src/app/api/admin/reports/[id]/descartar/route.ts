import { NextResponse } from "next/server";

import { requireAdmin } from "@/server/auth/guards";
import { descartarReport } from "@/server/reports";

export const runtime = "nodejs";

/**
 * `POST /api/admin/reports/[id]/descartar`
 *
 * Body: `{ resolucao?: string }` (opcional, ≤ 500).
 */
export async function POST(
    request: Request,
    context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const { id } = await context.params;

    let body: unknown = {};
    try {
        body = await request.json();
    } catch {
        // body opcional — se vier malformado, tratamos como vazio.
    }
    const resolucao =
        body && typeof body === "object" &&
            typeof (body as { resolucao?: unknown }).resolucao === "string"
            ? (body as { resolucao: string }).resolucao
            : null;

    const result = await descartarReport({
        reportId: id,
        adminUserId: auth.userId,
        resolucao,
    });

    if (result.ok) return NextResponse.json(result, { status: 200 });
    if (result.reason === "NAO_ENCONTRADA") {
        return NextResponse.json(result, { status: 404 });
    }
    if (result.reason === "RESOLUCAO_INVALIDA") {
        return NextResponse.json(result, { status: 400 });
    }
    return NextResponse.json(result, { status: 500 });
}
