import { NextResponse } from "next/server";

import { requireAcompanhante } from "@/server/auth/guards";
import { obterStatusVerificacao } from "@/server/verification";

export const runtime = "nodejs";

/**
 * `GET /api/verificacao/me` — Acompanhante lê o status do próprio
 * pedido de verificação.
 *
 * Mapeamento:
 * - `200`: `{ ok: true, status: VerificacaoStatus | null }`.
 * - `401`: `NAO_AUTENTICADO`.
 * - `403`: `TIPO_INVALIDO`.
 */
export async function GET(request: Request): Promise<NextResponse> {
    const auth = await requireAcompanhante(request);
    if (!auth.ok) return auth.response;

    const status = await obterStatusVerificacao(auth.userId);
    return NextResponse.json({ ok: true, status }, { status: 200 });
}
