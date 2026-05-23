/**
 * `GET /api/localidades/cidades?uf=<UF>` — handler do `Sistema_de_Localidades`.
 *
 * Lê o parâmetro `uf` da query string, valida que se trata de exatamente duas
 * letras (a-z, case-insensitive) e o normaliza para letras maiúsculas antes
 * de delegar para `defaultLocalidadesService.listarCidades(uf)`.
 *
 * Mapeamento HTTP:
 * - `uf` ausente ou em formato inválido: `400` com
 *   `{ ok: false, reason: "INVALID_UF" }`.
 * - **Sucesso** (`{ ok: true, cidades, stale }`): `200` com `{ cidades }`.
 *   Quando `stale === true` (cache expirado servido como fallback do IBGE),
 *   adiciona o header `X-IBGE-Stale: true`.
 * - **Falha total** (`{ ok: false }`, ou seja, cache ausente + IBGE
 *   indisponível): `503` com `{ ok: false, reason: "IBGE_UNAVAILABLE" }`.
 *
 * Requirements: 4.1, 4.2, 4.4.
 */

import { NextResponse, type NextRequest } from "next/server";

import { defaultLocalidadesService } from "@/server/localidades";

/** Padrão aceito para a sigla da UF: exatamente duas letras a-z (case-insensitive). */
const UF_PATTERN = /^[A-Za-z]{2}$/;

export async function GET(request: NextRequest): Promise<NextResponse> {
    const ufRaw = request.nextUrl.searchParams.get("uf");

    if (ufRaw === null || !UF_PATTERN.test(ufRaw)) {
        return NextResponse.json(
            { ok: false, reason: "INVALID_UF" },
            { status: 400 },
        );
    }

    const uf = ufRaw.toUpperCase();
    const result = await defaultLocalidadesService.listarCidades(uf);

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
        { cidades: result.cidades },
        { status: 200, headers },
    );
}
