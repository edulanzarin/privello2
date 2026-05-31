import { NextResponse } from "next/server";

import { requireSession } from "@/server/auth/guards";
import {
    marcarComoLida,
    marcarTodasComoLidas,
} from "@/server/notifications";

export const runtime = "nodejs";

/**
 * `POST /api/notifications/read` — marca notificações como lidas
 * (V2).
 *
 * Body JSON:
 * - `{ id: string }` — marca uma específica como lida.
 * - `{ all: true }` — marca todas as não lidas do usuário.
 *
 * Sempre escopado ao próprio `userId` (ninguém marca a alheia).
 *
 * Mapeamento:
 * - `200`: `{ ok: true }` (ou `{ ok: true, afetadas }` no modo all).
 * - `400`: `VALIDACAO`.
 * - `401`: `NAO_AUTENTICADO`.
 */
export async function POST(request: Request): Promise<NextResponse> {
    const auth = await requireSession(request);
    if (!auth.ok) return auth.response;

    let body: { id?: unknown; all?: unknown };
    try {
        const parsed = await request.json();
        if (parsed === null || typeof parsed !== "object") {
            throw new Error();
        }
        body = parsed as { id?: unknown; all?: unknown };
    } catch {
        return NextResponse.json(
            { ok: false, reason: "VALIDACAO" },
            { status: 400 },
        );
    }

    if (body.all === true) {
        const result = await marcarTodasComoLidas(auth.userId);
        return NextResponse.json(result, { status: 200 });
    }

    if (typeof body.id === "string" && body.id.length > 0) {
        await marcarComoLida({ userId: auth.userId, notificationId: body.id });
        return NextResponse.json({ ok: true }, { status: 200 });
    }

    return NextResponse.json(
        { ok: false, reason: "VALIDACAO" },
        { status: 400 },
    );
}
