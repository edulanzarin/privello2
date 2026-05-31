import { NextResponse } from "next/server";

import {
    listarCidadesParaMapa,
    type BuscaFiltros,
} from "@/server/acompanhante-profile/buscar";

/**
 * `GET /api/acompanhantes/mapa-cidades` — agregação por CIDADE pro
 * mapa nacional da busca (mostrado quando nenhuma cidade está
 * selecionada).
 *
 * Aceita os mesmos filtros não-geográficos da busca (gênero, etnia,
 * etc.); ignora `cidade`/`uf`/`bairro`. Devolve um agregado por
 * cidade: `{ cidadeNome, estadoSigla, lat, lng, count }`. Clicar
 * num marcador filtra a busca por aquela cidade.
 *
 * Resposta: `{ ok: true, cidades }`.
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

    // Só filtros não-geográficos importam aqui — o mapa nacional
    // ignora cidade/uf/bairro (o ponto é escolher a cidade).
    const filtros: BuscaFiltros = {
        q: sp.get("q") ?? undefined,
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
        const cidades = await listarCidadesParaMapa({ filtros });
        return NextResponse.json({ ok: true, cidades }, { status: 200 });
    } catch {
        return NextResponse.json({ ok: false, cidades: [] }, { status: 500 });
    }
}
