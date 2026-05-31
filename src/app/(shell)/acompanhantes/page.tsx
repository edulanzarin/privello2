import type { Metadata } from "next";

import { PageSurface } from "@/components";
import { rotularGeneroPlural, isGenero } from "@/domain/genero";
import {
    buscar,
    type BuscaFiltros,
    type BuscaOrdenacao,
} from "@/server/acompanhante-profile/buscar";
import { getCurrentSession } from "@/server/auth/currentSession";
import {
    listarStoriesAgregadosPorCidade,
    type StoryAgregadoItem,
    type StoryOwnerResumo,
} from "@/server/storage/storyMedia";

import { BuscaView } from "./_busca/BuscaView";

interface SearchParamsRaw {
    q?: string;
    cidade?: string;
    uf?: string;
    bairro?: string;
    genero?: string;
    etnia?: string;
    cor_olhos?: string;
    estilo_cabelo?: string;
    tamanho_cabelo?: string;
    idiomas?: string;
    pagamento?: string;
    dias?: string;
    atende?: string;
    praticas?: string;
    preco_min?: string;
    preco_max?: string;
    audio?: string;
    boost?: string;
    verificada?: string;
    ordenar?: string;
    pagina?: string;
}

/**
 * Gera title/description dinâmicos com base nos filtros.
 *
 * O cenário canônico é "Acompanhantes em [Cidade], [UF]". Sem
 * cidade, mostra a entry-page genérica. Como o gênero default é
 * `MULHER`, o título reflete isso só quando não houver filtro
 * explícito.
 */
export async function generateMetadata({
    searchParams,
}: {
    searchParams: Promise<SearchParamsRaw>;
}): Promise<Metadata> {
    const params = await searchParams;
    const cidade = params.cidade?.trim();
    const uf = params.uf?.trim().toUpperCase();
    const q = params.q?.trim();
    const genero = params.genero && isGenero(params.genero)
        ? params.genero
        : "MULHER";
    const generoPlural = rotularGeneroPlural(genero);

    let title: string;
    let description: string;

    if (cidade && uf) {
        title = `Acompanhantes em ${cidade}, ${uf}`;
        description = `Encontre ${generoPlural.toLowerCase()} acompanhantes verificadas em ${cidade}, ${uf}. Perfis com fotos, vídeos, áudio de apresentação e avaliações reais. Filtre por preço, idiomas, dias de atendimento.`;
    } else if (cidade) {
        title = `Acompanhantes em ${cidade}`;
        description = `Acompanhantes verificadas em ${cidade}. Perfis completos, áudio e avaliações.`;
    } else if (q) {
        title = `Busca: ${q}`;
        description = `Resultados para "${q}" — acompanhantes verificadas no Brasil.`;
    } else {
        title = "Acompanhantes verificadas no Brasil";
        description =
            "Plataforma brasileira de acompanhantes. Selecione sua cidade e filtre por preço, gênero, idiomas, dias de atendimento e mais.";
    }

    return {
        title,
        description,
        alternates: { canonical: "/acompanhantes" },
        openGraph: {
            title: `${title} · Privello`,
            description,
            type: "website",
        },
    };
}

/**
 * Lista pública de Acompanhantes (`/acompanhantes`).
 *
 * Busca server-side com filtros via query string. RSC chama o
 * service `buscar()` e passa os resultados para a `BuscaView`
 * (client) que cuida da UI interativa (FilterPanel, ordenação,
 * grid de cards, paginação numerada).
 *
 * Query string aceita:
 *   - `q`: texto livre.
 *   - `cidade`, `uf`: localização exata.
 *   - `genero`, `etnia`, `cor_olhos`, `estilo_cabelo`,
 *     `tamanho_cabelo`: enums.
 *   - `idiomas`, `pagamento`, `dias`, `atende`, `praticas`: listas
 *     comma-separated.
 *   - `preco_min`, `preco_max`: números (centavos).
 *   - `audio=1`, `boost=1`: flags.
 *   - `ordenar`: `relevancia` | `recentes` | `preco_asc` |
 *     `preco_desc` | `avaliacao`.
 *   - `pagina`: número da página (1-based).
 *
 * Cache: revalida a cada 60 segundos. Filtros voltam por SSR pra
 * SEO, mas mudanças de filtro disparam navegação client-side com
 * router.push — o RSC re-roda mais rápido que rodar as queries do
 * zero.
 */
export const revalidate = 60;

function parseList(value: string | undefined): string[] | undefined {
    if (!value) return undefined;
    const items = value
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    return items.length > 0 ? items : undefined;
}

function parseNumber(value: string | undefined): number | undefined {
    if (!value) return undefined;
    const n = Number.parseInt(value, 10);
    return Number.isFinite(n) ? n : undefined;
}

function parseOrdenar(value: string | undefined): BuscaOrdenacao {
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

export default async function AcompanhantesPage({
    searchParams,
}: {
    searchParams: Promise<SearchParamsRaw>;
}) {
    const params = await searchParams;
    const cidade = params.cidade?.trim();
    const uf = params.uf?.trim().toUpperCase();
    const q = params.q?.trim();

    // Bypass do gating de cidade quando o usuário veio de uma
    // navegação intencional com filtros/ordenação na URL — ex.:
    // "Ver todos" da home traz `?ordenar=popular` ou `?boost=1`.
    // Nesse caso, mostramos a listagem nacional sem forçar
    // seleção de cidade.
    const temIntentExplicito = Boolean(
        params.ordenar ||
            params.boost === "1" ||
            params.audio === "1" ||
            params.verificada === "1" ||
            params.genero ||
            params.etnia ||
            params.cor_olhos ||
            params.estilo_cabelo ||
            params.tamanho_cabelo ||
            params.idiomas ||
            params.pagamento ||
            params.dias ||
            params.atende ||
            params.praticas ||
            params.preco_min ||
            params.preco_max,
    );

    // Cidade obrigatória só na entry-page "limpa". Sem `cidade+uf`
    // E sem `q` E sem intent explícito, entramos em modo
    // "selecione sua cidade".
    const cidadeSelecionada = Boolean(cidade && uf);
    const modoBuscaPorTexto = !cidadeSelecionada && Boolean(q);
    const modoListagemAberta =
        !cidadeSelecionada && !modoBuscaPorTexto && temIntentExplicito;

    // Default do gênero: MULHER. Faz a entry-page padrão refletir
    // "procurar mulheres" sem o usuário ter que clicar em nada.
    const generoFiltro =
        params.genero && isGenero(params.genero)
            ? params.genero
            : "MULHER";

    const filtros: BuscaFiltros = {
        q: params.q,
        cidadeNome: params.cidade,
        estadoSigla: params.uf,
        bairroNome: params.bairro,
        genero: generoFiltro,
        etnia: params.etnia,
        corOlhos: params.cor_olhos,
        estiloCabelo: params.estilo_cabelo,
        tamanhoCabelo: params.tamanho_cabelo,
        idiomas: parseList(params.idiomas),
        formasPagamento: parseList(params.pagamento),
        diasAtende: parseList(params.dias),
        atendePublicos: parseList(params.atende),
        praticas: parseList(params.praticas),
        precoMin: parseNumber(params.preco_min),
        precoMax: parseNumber(params.preco_max),
        comAudio: params.audio === "1",
        comBoost: params.boost === "1",
        verificada: params.verificada === "1",
    };

    const ordenar = parseOrdenar(params.ordenar);
    const page = Math.max(1, parseNumber(params.pagina) ?? 1);

    let resultado;
    let storiesOwners: ReadonlyArray<StoryOwnerResumo> = [];
    let storiesItems: ReadonlyArray<StoryAgregadoItem> = [];

    if (cidadeSelecionada || modoBuscaPorTexto || modoListagemAberta) {
        try {
            resultado = await buscar({ filtros, ordenar, page });
        } catch {
            resultado = {
                items: [],
                total: 0,
                page,
                perPage: 24,
                pages: 1,
            };
        }

        // Tira de Stories só faz sentido com cidade definida.
        if (cidadeSelecionada) {
            try {
                const session = await getCurrentSession();
                const agg = await listarStoriesAgregadosPorCidade({
                    cidadeNome: cidade,
                    estadoSigla: uf,
                    viewerUserId: session?.userId ?? null,
                });
                storiesOwners = agg.owners;
                storiesItems = agg.stories;
            } catch {
                storiesOwners = [];
                storiesItems = [];
            }
        }
    } else {
        // Sem cidade: lista vazia. View renderiza tela de seleção.
        resultado = {
            items: [],
            total: 0,
            page,
            perPage: 24,
            pages: 1,
        };
    }

    // O botão "Salvar busca" (V3) só aparece pra Cliente logado.
    const sessaoAtual = await getCurrentSession();
    const podeSalvarBusca = sessaoAtual?.userType === "CLIENTE";

    return (
        <PageSurface width="lg">
            <BuscaView
                filtros={filtros}
                ordenar={ordenar}
                resultado={resultado}
                podeSalvarBusca={podeSalvarBusca}
                storiesOwners={storiesOwners}
                storiesItems={storiesItems.map((s) => ({
                    id: s.id,
                    type: s.kind === "VIDEO" ? "video" : "photo",
                    url: `/api/storage/${s.storageKey}`,
                    description: s.caption,
                    createdAt: s.createdAt,
                    likes: s.likesCount,
                    liked: s.liked,
                    viewed: s.viewed,
                    ownerIdentificador: s.ownerIdentificador,
                    ownerNome: s.ownerNome,
                    ownerFotoUrl: s.ownerFotoUrl,
                }))}
                cidadeSelecionada={cidadeSelecionada}
                modoListagemAberta={modoListagemAberta}
            />
        </PageSurface>
    );
}
