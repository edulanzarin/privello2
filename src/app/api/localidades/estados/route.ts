/**
 * `GET /api/localidades/estados` — handler do `Sistema_de_Localidades`.
 *
 * Encaminha a chamada para `defaultLocalidadesService.listarEstados()` e
 * traduz o resultado para HTTP conforme o design:
 *
 * - **Sucesso** (`{ ok: true, estados, stale }`): responde `200` com
 *   `{ estados }`. Quando `stale === true` (cache expirado servido como
 *   fallback do IBGE), adiciona o header `X-IBGE-Stale: true`.
 * - **Falha total** (`{ ok: false }`, ou seja, cache ausente + IBGE
 *   indisponível): responde `503` com `{ ok: false, reason: "IBGE_UNAVAILABLE" }`.
 *
 * Requirements: 4.1, 4.2, 4.4.
 */

import { NextResponse } from "next/server";

import { defaultLocalidadesService } from "@/server/localidades";

export async function GET(): Promise<NextResponse> {
    const result = await defaultLocalidadesService.listarEstados();

    if (!result.ok) {
        return NextResponse.json(
            { ok: false, reason: "IBGE_UNAVAILABLE" },
            { status: 503 },
        );
    }

    const headers: Record<string, string> = {};
    if (result.stale === true) {
        headers["X-IBGE-Stale"] = "true";
    }

    return NextResponse.json(
        { estados: result.estados },
        { status: 200, headers },
    );
}
