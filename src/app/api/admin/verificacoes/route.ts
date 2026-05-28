import { NextResponse } from "next/server";

import { requireAdmin } from "@/server/auth/guards";
import { listarFilaVerificacoes } from "@/server/verification";

export const runtime = "nodejs";

/**
 * `GET /api/admin/verificacoes?status=PENDENTE&limit=50`
 *
 * Lista a fila de verificações pra triagem do admin.
 *
 * Query:
 * - `status` (opcional): `PENDENTE | APROVADA | REJEITADA`.
 *   Default `PENDENTE`.
 * - `limit` (opcional): 1-200, default 50.
 *
 * Mapeamento:
 * - `200`: `{ ok: true, fila: VerificacaoFila[] }`.
 * - `401`: `NAO_AUTENTICADO`.
 * - `403`: `NAO_ADMIN`.
 */
export async function GET(request: Request): Promise<NextResponse> {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const url = new URL(request.url);
    const statusParam = url.searchParams.get("status");
    const limitParam = url.searchParams.get("limit");

    const status =
        statusParam === "APROVADA" ||
            statusParam === "REJEITADA" ||
            statusParam === "PENDENTE"
            ? statusParam
            : "PENDENTE";

    const limit = limitParam ? Number.parseInt(limitParam, 10) : 50;

    const fila = await listarFilaVerificacoes({
        status,
        limit: Number.isFinite(limit) ? limit : 50,
    });

    return NextResponse.json({ ok: true, fila }, { status: 200 });
}
