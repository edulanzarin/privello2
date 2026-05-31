import { NextResponse } from "next/server";

import { requireSession } from "@/server/auth/guards";
import {
    contarNaoLidas,
    listarNotificacoes,
} from "@/server/notifications";

export const runtime = "nodejs";

/**
 * `GET /api/notifications?limit=30&offset=0` — lista as
 * notificações in-site do usuário autenticado (V2), mais
 * recentes primeiro, junto com a contagem de não lidas.
 *
 * Disponível pra qualquer sessão (hoje só Acompanhantes recebem
 * eventos, mas o endpoint é genérico — Property 29 / sem domain
 * leak na rota).
 *
 * Mapeamento:
 * - `200`: `{ ok: true, items: NotificationItem[], naoLidas: number }`.
 * - `401`: `NAO_AUTENTICADO`.
 */
export async function GET(request: Request): Promise<NextResponse> {
    const auth = await requireSession(request);
    if (!auth.ok) return auth.response;

    const url = new URL(request.url);
    const limitParam = url.searchParams.get("limit");
    const offsetParam = url.searchParams.get("offset");

    const limit = limitParam ? Number.parseInt(limitParam, 10) : 30;
    const offset = offsetParam ? Number.parseInt(offsetParam, 10) : 0;

    const [items, naoLidas] = await Promise.all([
        listarNotificacoes(auth.userId, {
            limit: Number.isFinite(limit) ? limit : 30,
            offset: Number.isFinite(offset) ? offset : 0,
        }),
        contarNaoLidas(auth.userId),
    ]);

    return NextResponse.json({ ok: true, items, naoLidas }, { status: 200 });
}
