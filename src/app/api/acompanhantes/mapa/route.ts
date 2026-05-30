import { NextResponse } from "next/server";

import {
    listarPerfisParaMapa,
    type BuscaFiltros,
} from "@/server/acompanhante-profile/buscar";

/**
 * `GET /api/acompanhantes/mapa` — pins do mapa da busca (T14).
 *
 * Espelha a query string da busca (`/acompanhantes`) e devolve até
 * 500 pins geocodificados (`{ identificador, nome, fotoUrl, lat,
 * lng, planoExibicao, verificada }`). O client (Maplibre) clusteriza
 * e filtra por viewport.
 *
 * Coordenadas já vêm com jitter — nunca endereço exato.
 *
 * Resposta: `{ ok: true, pins }`.
 */
export const dynamic = "force-dynamic";

function parseList(value: string | null): string[] | undefined {
    if (!value) return undefined;
    const items = value
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    return items.length > 0 ? items : undefined;
}

function parseNumber(value: string | null): number | undefined {
    if (!value) return undefined;
    const n = Number.parseInt(value, 10);
    return Number.isFinite(n) ? n : undefined;
}

export async function GET(request: Request): Promise<NextResponse> {
    const sp = new URL(request.url).searchParams;

    const filtros: BuscaFiltros = {
        q: sp.get("q") ?? undefined,
        cidadeNome: sp.get("cidade") ?? undefined,
        estadoSigla: sp.get("uf") ?? undefined,
        genero: sp.get("genero") ?? undefined,
        etnia: sp.get("etnia") ?? undefined,
        corOlhos: sp.get("cor_olhos") ?? undefined,
        estiloCabelo: sp.get("estilo_cabelo") ?? undefined,
        tamanhoCabelo: sp.get("tamanho_cabelo") ?? undefined,
        idiomas: parseList(sp.get("idiomas")),
        formasPagamento: parseList(sp.get("pagamento")),
        diasAtende: parseList(sp.get("dias")),
        atendePublicos: parseList(sp.get("atende")),
        praticas: parseList(sp.get("praticas")),
        precoMin: parseNumber(sp.get("preco_min")),
        precoMax: parseNumber(sp.get("preco_max")),
        comAudio: sp.get("audio") === "1",
        comBoost: sp.get("boost") === "1",
        verificada: sp.get("verificada") === "1",
    };

    try {
        const pins = await listarPerfisParaMapa({ filtros });
        return NextResponse.json({ ok: true, pins }, { status: 200 });
    } catch {
        return NextResponse.json(
            { ok: false, pins: [] },
            { status: 500 },
        );
    }
}
