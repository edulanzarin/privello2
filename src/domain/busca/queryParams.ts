/**
 * Serialização de `BuscaFiltros` → query string da `/acompanhantes`.
 *
 * Extraído pra um módulo de domínio puro (sem React) pra que tanto a
 * `BuscaView` quanto a aba "Buscas salvas" do painel do Cliente (V3)
 * gerem exatamente a mesma URL a partir de um filtro salvo. Fonte
 * única da verdade do mapeamento campo → param.
 */

import type {
    BuscaFiltros,
    BuscaOrdenacao,
} from "@/server/acompanhante-profile/buscar";

/**
 * Constrói os query params canônicos da busca. `cidadeNome` vira
 * `cidade`, `estadoSigla` vira `uf`, e flags booleanas viram `"1"`.
 */
export function buscaFiltrosParaParams(
    filtros: BuscaFiltros,
    ordenar: BuscaOrdenacao = "relevancia",
    page = 1,
): URLSearchParams {
    const params = new URLSearchParams();
    if (filtros.q) params.set("q", filtros.q);
    if (filtros.cidadeNome) params.set("cidade", filtros.cidadeNome);
    if (filtros.estadoSigla) params.set("uf", filtros.estadoSigla);
    if (filtros.bairroNome) params.set("bairro", filtros.bairroNome);
    if (filtros.genero) params.set("genero", filtros.genero);
    if (filtros.etnia) params.set("etnia", filtros.etnia);
    if (filtros.corOlhos) params.set("cor_olhos", filtros.corOlhos);
    if (filtros.estiloCabelo) params.set("estilo_cabelo", filtros.estiloCabelo);
    if (filtros.tamanhoCabelo)
        params.set("tamanho_cabelo", filtros.tamanhoCabelo);
    if (filtros.idiomas?.length) params.set("idiomas", filtros.idiomas.join(","));
    if (filtros.formasPagamento?.length)
        params.set("pagamento", filtros.formasPagamento.join(","));
    if (filtros.diasAtende?.length)
        params.set("dias", filtros.diasAtende.join(","));
    if (filtros.atendePublicos?.length)
        params.set("atende", filtros.atendePublicos.join(","));
    if (filtros.praticas?.length)
        params.set("praticas", filtros.praticas.join(","));
    if (filtros.precoMin) params.set("preco_min", String(filtros.precoMin));
    if (filtros.precoMax) params.set("preco_max", String(filtros.precoMax));
    if (filtros.comAudio) params.set("audio", "1");
    if (filtros.comBoost) params.set("boost", "1");
    if (filtros.verificada) params.set("verificada", "1");
    if (ordenar !== "relevancia") params.set("ordenar", ordenar);
    if (page > 1) params.set("pagina", String(page));
    return params;
}

/**
 * URL completa (`/acompanhantes?...`) pra um filtro salvo.
 */
export function buscaFiltrosParaHref(filtros: BuscaFiltros): string {
    const qs = buscaFiltrosParaParams(filtros).toString();
    return `/acompanhantes${qs ? `?${qs}` : ""}`;
}
