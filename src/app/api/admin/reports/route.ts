import { NextResponse } from "next/server";

import { requireAdmin } from "@/server/auth/guards";
import { listarFilaReports, type ReportStatus } from "@/server/reports";

export const runtime = "nodejs";

/**
 * `GET /api/admin/reports?status=PENDENTE&limit=50&offset=0`
 *
 * Lista a fila de denúncias.
 *
 * Mapeamento:
 * - `200`: `{ ok: true, fila: ReportFila[] }`.
 * - `401`: `NAO_AUTENTICADO`.
 * - `403`: `NAO_ADMIN`.
 */
export async function GET(request: Request): Promise<NextResponse> {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const url = new URL(request.url);
    const statusParam = url.searchParams.get("status");
    const limitParam = url.searchParams.get("limit");
    const offsetParam = url.searchParams.get("offset");

    const status: ReportStatus =
        statusParam === "RESOLVIDA" ||
            statusParam === "DESCARTADA" ||
            statusParam === "PENDENTE"
            ? statusParam
            : "PENDENTE";

    const limit = limitParam ? Number.parseInt(limitParam, 10) : 50;
    const offset = offsetParam ? Number.parseInt(offsetParam, 10) : 0;

    const fila = await listarFilaReports({
        status,
        limit: Number.isFinite(limit) ? limit : 50,
        offset: Number.isFinite(offset) ? offset : 0,
    });

    return NextResponse.json({ ok: true, fila }, { status: 200 });
}
