import { NextResponse } from "next/server";

import { requireAcompanhante } from "@/server/auth/guards";
import { reordenarGaleria } from "@/server/storage/galleryMedia";

export const runtime = "nodejs";

/**
 * `PATCH /api/acompanhante/midias/order` — reordena a galeria.
 *
 * Body: `{ ids: string[] }` — a sequência completa (ou subset) das
 * mídias na ordem desejada. Posição 0 vem primeiro. Service valida
 * que todos os ids pertencem ao caller, têm `role=GALLERY` e
 * `status=COMMITTED` antes de tocar em qualquer linha.
 *
 * Mapeamento:
 * - `200`: `{ ok: true, total: N }`.
 * - `400`: `{ ok: false, reason: "INPUT_INVALIDO" }` — body
 *   malformado, ids vazios ou duplicados.
 * - `401`: `{ ok: false, reason: "NAO_AUTENTICADO" }`.
 * - `403`: `{ ok: false, reason: "TIPO_INVALIDO" }`.
 * - `404`: `{ ok: false, reason: "ALVO_INVALIDO" }` — algum id não
 *   pertence ao caller ou não existe na galeria.
 * - `500`: `{ ok: false, reason: "PERSISTENCIA" }`.
 */
export async function PATCH(request: Request): Promise<NextResponse> {
    const auth = await requireAcompanhante(request);
    if (!auth.ok) return auth.response;

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json(
            { ok: false, reason: "INPUT_INVALIDO" },
            { status: 400 },
        );
    }

    if (
        !body ||
        typeof body !== "object" ||
        !Array.isArray((body as { ids?: unknown }).ids)
    ) {
        return NextResponse.json(
            { ok: false, reason: "INPUT_INVALIDO" },
            { status: 400 },
        );
    }

    const idsRaw = (body as { ids: unknown[] }).ids;
    if (!idsRaw.every((x): x is string => typeof x === "string")) {
        return NextResponse.json(
            { ok: false, reason: "INPUT_INVALIDO" },
            { status: 400 },
        );
    }

    const result = await reordenarGaleria({
        userId: auth.userId,
        ids: idsRaw,
    });

    if (result.ok) {
        return NextResponse.json(result, { status: 200 });
    }
    if (result.reason === "INPUT_INVALIDO") {
        return NextResponse.json(result, { status: 400 });
    }
    if (result.reason === "ALVO_INVALIDO") {
        return NextResponse.json(result, { status: 404 });
    }
    return NextResponse.json(result, { status: 500 });
}
