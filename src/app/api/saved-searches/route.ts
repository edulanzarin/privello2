import { NextResponse } from "next/server";

import { requireCliente } from "@/server/auth/guards";
import { enforceRateLimit, LIMITS } from "@/server/auth/rateLimitGuard";
import type { BuscaFiltros } from "@/server/acompanhante-profile/buscar";
import { listarBuscas, salvarBusca } from "@/server/saved-search";

export const runtime = "nodejs";

/**
 * `GET /api/saved-searches` — lista as buscas salvas do Cliente
 * autenticado (V3).
 *
 * Mapeamento:
 * - `200`: `{ ok: true, items: SavedSearchItem[] }`.
 * - `401`: `NAO_AUTENTICADO`.
 * - `403`: `TIPO_INVALIDO`.
 */
export async function GET(request: Request): Promise<NextResponse> {
    const auth = await requireCliente(request);
    if (!auth.ok) return auth.response;

    const items = await listarBuscas(auth.userId);
    return NextResponse.json({ ok: true, items }, { status: 200 });
}

/**
 * `POST /api/saved-searches` — salva uma busca (cidade + filtros).
 *
 * Body JSON: `{ filtros: BuscaFiltros }`.
 *
 * Mapeamento:
 * - `200`: `{ ok: true, id }`.
 * - `400`: `VALIDACAO` | `CIDADE_OBRIGATORIA` | `LIMITE`.
 * - `401`: `NAO_AUTENTICADO`. `403`: `TIPO_INVALIDO`.
 * - `429`: `RATE_LIMITED`. `500`: `PERSISTENCIA`.
 */
export async function POST(request: Request): Promise<NextResponse> {
    const auth = await requireCliente(request);
    if (!auth.ok) return auth.response;

    const rl = enforceRateLimit("savedSearch", auth.userId, LIMITS.savedSearch);
    if (rl) return rl;

    let body: { filtros?: unknown };
    try {
        const parsed = await request.json();
        if (parsed === null || typeof parsed !== "object") throw new Error();
        body = parsed as { filtros?: unknown };
    } catch {
        return NextResponse.json(
            { ok: false, reason: "VALIDACAO" },
            { status: 400 },
        );
    }

    if (body.filtros === null || typeof body.filtros !== "object") {
        return NextResponse.json(
            { ok: false, reason: "VALIDACAO" },
            { status: 400 },
        );
    }

    const result = await salvarBusca({
        clientUserId: auth.userId,
        filtros: body.filtros as BuscaFiltros,
    });

    if (result.ok) {
        return NextResponse.json(result, { status: 200 });
    }
    const status = result.reason === "PERSISTENCIA" ? 500 : 400;
    return NextResponse.json(result, { status });
}
