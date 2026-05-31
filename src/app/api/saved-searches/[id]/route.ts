import { NextResponse } from "next/server";

import { requireCliente } from "@/server/auth/guards";
import { excluirBusca } from "@/server/saved-search";

export const runtime = "nodejs";

/**
 * `DELETE /api/saved-searches/[id]` — exclui uma busca salva do
 * Cliente autenticado (V3). Escopado ao próprio usuário.
 *
 * Mapeamento:
 * - `200`: `{ ok: true }`.
 * - `401`: `NAO_AUTENTICADO`. `403`: `TIPO_INVALIDO`.
 */
export async function DELETE(
    request: Request,
    context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
    const auth = await requireCliente(request);
    if (!auth.ok) return auth.response;

    const { id } = await context.params;
    await excluirBusca({ clientUserId: auth.userId, id });
    return NextResponse.json({ ok: true }, { status: 200 });
}
