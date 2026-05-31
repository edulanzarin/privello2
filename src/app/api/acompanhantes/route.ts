import { NextResponse } from "next/server";

import {
    buscar,
    type BuscaFiltros,
    type BuscaOrdenacao,
} from "@/server/acompanhante-profile/buscar";

/**
 * `GET /api/acompanhantes` — busca paginada de Acompanhantes.
 *
 * Espelha a query string aceita por `/acompanhantes` (página). Usado
 * pelo client da `BuscaView` para carregar páginas adicionais via
 * scroll infinito sem recarregar a rota.
 *
 * Query string:
 *   - `q`, `cidade`, `uf`, `genero`, `etnia`, `cor_olhos`,
 *     `estilo_cabelo`, `tamanho_cabelo`
 *   - `idiomas`, `pagamento`, `dias`, `atende`, `praticas` (CSV)
 *   - `preco_min`, `preco_max`
 *   - `audio=1`, `boost=1`, `verificada=1`
 *   - `ordenar`: relevancia | recentes | preco_asc | preco_desc | popular
 *   - `pagina`: 1-based
 *
 * Resposta: `{ items, total, page, perPage, pages }`.
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

function parseOrdenar(value: string | null): BuscaOrdenacao {
    if (
        value === "recentes" ||
        value === "preco_asc" ||
        value === "preco_desc" ||
        value === "popular"
    ) {
        return value;
    }
    return "relevancia";
}

export async function GET(request: Request): Promise<NextResponse> {
    const url = new URL(request.url);
    const sp = url.searchParams;

    const filtros: BuscaFiltros = {
        q: sp.get("q") ?? undefined,
        cidadeNome: sp.get("cidade") ?? undefined,
        estadoSigla: sp.get("uf") ?? undefined,
        bairroNome: sp.get("bairro") ?? undefined,
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

    const ordenar = parseOrdenar(sp.get("ordenar"));
    const page = Math.max(1, parseNumber(sp.get("pagina")) ?? 1);
    const perPage = Math.max(
        1,
        Math.min(60, parseNumber(sp.get("per_page")) ?? 24),
    );

    try {
        const resultado = await buscar({ filtros, ordenar, page, perPage });
        return NextResponse.json({ ok: true, ...resultado }, { status: 200 });
    } catch {
        return NextResponse.json(
            {
                ok: false,
                items: [],
                total: 0,
                page,
                perPage,
                pages: 1,
            },
            { status: 500 },
        );
    }
}
