import { NextResponse } from "next/server";

import {
    listarBairrosParaMapa,
    type BuscaFiltros,
} from "@/server/acompanhante-profile/buscar";

/**
 * `GET /api/acompanhantes/mapa` — agregação por bairro pro mapa
 * da busca (T14).
 *
 * Espelha a query string da busca (`/acompanhantes`) e devolve um
 * agregado por bairro: `{ label, lat, lng, count, cidadeFallback }`.
 * NÃO devolve perfis individuais — o mapa mostra só "quantas
 * atendem em cada bairro". Perfis sem bairro caem no centro da
 * cidade.
 *
 * Resposta: `{ ok: true, bairros }`.
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
        const bairros = await listarBairrosParaMapa({ filtros });
        return NextResponse.json({ ok: true, bairros }, { status: 200 });
    } catch {
        return NextResponse.json(
            { ok: false, bairros: [] },
            { status: 500 },
        );
    }
}
