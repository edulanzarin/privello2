/**
 * `GET /api/localidades/bairros?uf=<UF>&cidade=<NOME>` — handler do
 * `Sistema_de_Localidades` para listar bairros de uma cidade brasileira.
 *
 * Os dados vêm da Overpass API (OpenStreetMap) com cache na mesma tabela
 * `IbgeCacheEntry` usada para estados/cidades (chaves prefixadas com
 * `bairros:`).
 *
 * Mapeamento HTTP:
 * - `uf` ausente/inválido: `400` com `{ ok: false, reason: "INVALID_UF" }`.
 * - `cidade` ausente: `400` com `{ ok: false, reason: "INVALID_CIDADE" }`.
 * - **Sucesso**: `200` com `{ bairros }`. Quando o resultado vem de cache
 *   stale (Overpass indisponível mas cache existe), adiciona o header
 *   `X-OSM-Stale: true`. Lista vazia (cidade sem bairros mapeados no OSM)
 *   é tratada como sucesso normal (a UI cai em campo livre opcional).
 * - **Falha total** (Overpass indisponível e nenhum cache): `503` com
 *   `{ ok: false, reason: "OSM_UNAVAILABLE" }`.
 */

import { NextResponse, type NextRequest } from "next/server";

import { defaultBairrosService } from "@/server/localidades";

const UF_PATTERN = /^[A-Za-z]{2}$/;
const CIDADE_MAX_LEN = 120;

export async function GET(request: NextRequest): Promise<NextResponse> {
    const ufRaw = request.nextUrl.searchParams.get("uf");
    const cidadeRaw = request.nextUrl.searchParams.get("cidade");

    if (ufRaw === null || !UF_PATTERN.test(ufRaw)) {
        return NextResponse.json(
            { ok: false, reason: "INVALID_UF" },
            { status: 400 },
        );
    }

    const cidade = (cidadeRaw ?? "").trim();
    if (cidade.length === 0 || cidade.length > CIDADE_MAX_LEN) {
        return NextResponse.json(
            { ok: false, reason: "INVALID_CIDADE" },
            { status: 400 },
        );
    }

    const uf = ufRaw.toUpperCase();
    const result = await defaultBairrosService.listarBairros(uf, cidade);

    if (!result.ok) {
        return NextResponse.json(
            { ok: false, reason: "OSM_UNAVAILABLE" },
            { status: 503 },
        );
    }

    const headers: Record<string, string> = {};
    if (result.stale === true) {
        headers["X-OSM-Stale"] = "true";
    }

    return NextResponse.json(
        { bairros: result.bairros },
        { status: 200, headers },
    );
}
