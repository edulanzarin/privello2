"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";

import {
    AudioWavePlayer,
    Avatar,
    Badge,
    Button,
    Card,
    CityCombobox,
    CrownIcon,
    EmptyState,
    FilterPanel,
    FilterSection,
    FlameIcon,
    InfiniteScrollSentinel,
    Input,
    LinkButton,
    MapPinIcon,
    MediaCarousel,
    ProfileFeedCard,
    RankBadge,
    Select,
    StoriesRail,
    Switch,
    UsersIcon,
    useMediaCarousel,
    type CityComboboxValue,
    type StoriesRailItem,
} from "@/components";

import {
    CORES_OLHOS,
    ESTILOS_CABELO,
    ETNIAS,
    IDIOMAS,
    TAMANHOS_CABELO,
} from "@/domain/aparencia/definitions";
import { ATENDE, PRATICAS } from "@/domain/atendimento";
import {
    DIAS_SEMANA,
    FORMAS_PAGAMENTO,
    formatarValorHora,
} from "@/domain/atendimentoComercial";
import { GENEROS } from "@/domain/genero";
import type {
    BuscaFiltros,
    BuscaOrdenacao,
    BuscaResultado,
} from "@/server/acompanhante-profile/buscar";
import type { FeedItem } from "@/server/acompanhante-profile/feed";
import type { PlanoExibicao } from "@/server/acompanhante-profile";
import type { StoryOwnerResumo } from "@/server/storage/storyMedia";

/**
 * Item de Story já no shape consumido pelo `MediaCarousel` em
 * `storyMode`, com info do dono pra exibir o "header" do viewer
 * (avatar + @nome). Vem do RSC via {@link BuscaViewProps.storiesItems}.
 */
export interface BuscaStoryItem {
    id: string;
    type: "photo" | "video";
    url: string;
    description: string | null;
    createdAt: Date | string;
    likes: number;
    liked: boolean;
    viewed: boolean;
    ownerIdentificador: string;
    ownerNome: string;
    ownerFotoUrl: string | null;
}

/**
 * Chave usada no `sessionStorage` para lembrar a última cidade
 * selecionada. Persiste só durante a aba aberta — sair e voltar
 * em nova aba começa zerado, mas trocar de página dentro da mesma
 * sessão mantém.
 */
const STORAGE_KEY_CIDADE = "privello:ultima-cidade";

/**
 * Forma serializada da cidade lembrada — par cidade/UF.
 */
interface CidadeMemo {
    name: string;
    uf: string;
}

function lerCidadeMemo(): CidadeMemo | null {
    if (typeof window === "undefined") return null;
    try {
        const raw = window.sessionStorage.getItem(STORAGE_KEY_CIDADE);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as Partial<CidadeMemo>;
        if (
            typeof parsed.name === "string" &&
            parsed.name.trim().length > 0 &&
            typeof parsed.uf === "string" &&
            parsed.uf.trim().length === 2
        ) {
            return { name: parsed.name, uf: parsed.uf.toUpperCase() };
        }
    } catch {
        // sessionStorage indisponível ou JSON quebrado — ignora.
    }
    return null;
}

function escreverCidadeMemo(memo: CidadeMemo | null): void {
    if (typeof window === "undefined") return;
    try {
        if (memo === null) {
            window.sessionStorage.removeItem(STORAGE_KEY_CIDADE);
        } else {
            window.sessionStorage.setItem(
                STORAGE_KEY_CIDADE,
                JSON.stringify(memo),
            );
        }
    } catch {
        // sem persistência; segue silencioso.
    }
}

/**
 * Props da {@link BuscaView}.
 *
 * Recebe filtros e resultado já resolvidos pelo RSC. O client tem
 * apenas responsabilidade de ler o estado, controlar o painel mobile
 * e propagar mudanças via `router.push` pra reexecutar o RSC com
 * novos query params.
 */
export interface BuscaViewProps {
    filtros: BuscaFiltros;
    ordenar: BuscaOrdenacao;
    resultado: BuscaResultado;
    /**
     * Lista de Acompanhantes com Stories ativos na cidade
     * selecionada — alimenta a tira de avatares. Vazia quando não
     * há cidade selecionada.
     */
    storiesOwners: ReadonlyArray<StoryOwnerResumo>;
    /**
     * Lista achatada de stories (mesma cidade) já no shape do
     * `MediaCarousel`. Cada item carrega info do dono pra que o
     * viewer mostre avatar + @nome no topo. Concatenação na ordem
     * dos `storiesOwners`.
     */
    storiesItems: ReadonlyArray<BuscaStoryItem>;
    /**
     * `true` quando o RSC recebeu `cidade+uf` na query string.
     * Quando `false` E sem `modoListagemAberta`, a view entra em
     * modo "selecione sua cidade" e tenta restaurar do
     * `sessionStorage`.
     */
    cidadeSelecionada: boolean;
    /**
     * `true` quando o RSC entendeu a navegação como "ver todos"
     * (algum filtro/ordenação intencional na URL). Mesmo sem
     * cidade selecionada, mostra a listagem nacional sem forçar
     * o gating de seleção de cidade.
     */
    modoListagemAberta: boolean;
}

/**
 * Conta filtros ativos (descartando `q`/cidade que aparecem em
 * lugar separado, e o gênero default `MULHER` que nem o usuário
 * escolheu — vem como ponto de partida da busca). Serve pro pill
 * no header do FilterPanel.
 */
function contarAtivos(filtros: BuscaFiltros): number {
    let n = 0;
    if (filtros.genero && filtros.genero !== "MULHER") n++;
    if (filtros.etnia) n++;
    if (filtros.corOlhos) n++;
    if (filtros.estiloCabelo) n++;
    if (filtros.tamanhoCabelo) n++;
    if (filtros.idiomas?.length) n++;
    if (filtros.formasPagamento?.length) n++;
    if (filtros.diasAtende?.length) n++;
    if (filtros.atendePublicos?.length) n++;
    if (filtros.praticas?.length) n++;
    if (filtros.precoMin) n++;
    if (filtros.precoMax) n++;
    if (filtros.comAudio) n++;
    if (filtros.comBoost) n++;
    return n;
}

const ORDENACAO_OPCOES: Array<{ value: BuscaOrdenacao; label: string }> = [
    { value: "relevancia", label: "Relevância" },
    { value: "recentes", label: "Mais recentes" },
    { value: "popular", label: "Mais populares" },
    { value: "preco_asc", label: "Menor preço" },
    { value: "preco_desc", label: "Maior preço" },
];

export function BuscaView({
    filtros,
    ordenar,
    resultado,
    storiesOwners,
    storiesItems,
    cidadeSelecionada,
    modoListagemAberta,
}: BuscaViewProps): React.ReactElement {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [panelOpen, setPanelOpen] = React.useState(false);

    // Modal do viewer de Stories — controla qual story está
    // visível agora. Os stories vêm achatados (todos os ativos
    // da cidade), na ordem boost → premium → básico definida
    // pelo backend.
    const storyCarousel = useMediaCarousel();

    // ─────────────────────────────────────────────────────────────
    // SessionStorage da última cidade
    //
    // Quando o usuário chega em `/acompanhantes` sem `cidade+uf`,
    // tentamos restaurar do sessionStorage e redirecionar com os
    // params certos — preservando outros params já presentes (ex.:
    // `?ordenar=alta` vindo do "Ver todos" da home). Quando o
    // usuário escolhe explicitamente uma cidade pelo CityCombobox,
    // gravamos.
    // ─────────────────────────────────────────────────────────────

    React.useEffect(() => {
        if (cidadeSelecionada) {
            // Confirma o que está na URL como "cidade lembrada".
            if (filtros.cidadeNome && filtros.estadoSigla) {
                escreverCidadeMemo({
                    name: filtros.cidadeNome,
                    uf: filtros.estadoSigla,
                });
            }
            return;
        }
        // Em listagem aberta (ex.: vindo de "Ver todos") respeitamos
        // a intent original — não injetamos cidade automaticamente.
        if (modoListagemAberta) return;

        // Sem cidade na URL: tenta recuperar do storage e
        // redirecionar. Se não tem, fica na tela de seleção.
        const memo = lerCidadeMemo();
        if (memo) {
            // Preserva outros params (ordenar, q, filtros) que o
            // usuário já trouxe na URL — só injeta cidade/uf.
            const params = new URLSearchParams(searchParams.toString());
            params.set("cidade", memo.name);
            params.set("uf", memo.uf);
            router.replace(`/acompanhantes?${params.toString()}`);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cidadeSelecionada, modoListagemAberta]);

    // ─────────────────────────────────────────────────────────────
    // Estado controlado do CityCombobox
    // ─────────────────────────────────────────────────────────────

    // Sincroniza com filtros ao montar e a cada mudança de URL —
    // submit dispara navegação.
    const [cityValue, setCityValue] = React.useState<CityComboboxValue>(() => ({
        query:
            filtros.cidadeNome && filtros.estadoSigla
                ? `${filtros.cidadeNome}, ${filtros.estadoSigla}`
                : "",
        name: filtros.cidadeNome ?? "",
        uf: filtros.estadoSigla ?? "",
    }));
    React.useEffect(() => {
        setCityValue({
            query:
                filtros.cidadeNome && filtros.estadoSigla
                    ? `${filtros.cidadeNome}, ${filtros.estadoSigla}`
                    : "",
            name: filtros.cidadeNome ?? "",
            uf: filtros.estadoSigla ?? "",
        });
    }, [filtros.cidadeNome, filtros.estadoSigla]);

    // Estado local dos filtros — espelha props ao montar e a cada
    // mudança de URL. Edição é local e só vira navegação ao chamar
    // `aplicarFiltros`.
    const [draft, setDraft] = React.useState<BuscaFiltros>(filtros);
    React.useEffect(() => {
        setDraft(filtros);
    }, [filtros]);

    // Estado de scroll infinito. A página inicial vem do RSC
    // (`resultado.items`); páginas subsequentes são carregadas via
    // `GET /api/acompanhantes` e concatenadas. Reset ao mudar
    // filtros ou ordenação.
    const [items, setItems] = React.useState<ReadonlyArray<FeedItem>>(
        resultado.items,
    );
    const [page, setPage] = React.useState(resultado.page);
    const [pages, setPages] = React.useState(resultado.pages);
    const [loading, setLoading] = React.useState(false);

    // Reset quando o RSC retorna com filtros/ordenação novos.
    // Comparamos pela identidade de `resultado` que muda a cada
    // navegação. Page volta a 1.
    React.useEffect(() => {
        setItems(resultado.items);
        setPage(resultado.page);
        setPages(resultado.pages);
    }, [resultado]);

    const hasMore = page < pages;

    /**
     * Carrega a próxima página via `GET /api/acompanhantes` e
     * concatena ao estado local. Sem race-condition: usamos a
     * `page + 1` sempre derivada do estado atual no setItems.
     */
    async function loadMore(): Promise<void> {
        if (loading || !hasMore) return;
        const nextPage = page + 1;
        setLoading(true);
        try {
            const params = buildSearchParams(filtros, ordenar, nextPage);
            const res = await fetch(`/api/acompanhantes?${params.toString()}`);
            if (!res.ok) return;
            const payload = (await res.json().catch(() => null)) as
                | {
                    ok: boolean;
                    items: ReadonlyArray<FeedItem>;
                    page: number;
                    pages: number;
                }
                | null;
            if (payload === null || !payload.ok) return;
            setItems((prev) => [...prev, ...payload.items]);
            setPage(payload.page);
            setPages(payload.pages);
        } catch {
            // best-effort; usuário pode rolar de novo
        } finally {
            setLoading(false);
        }
    }

    function buildSearchParams(
        next: BuscaFiltros,
        nextOrdenar: BuscaOrdenacao = ordenar,
        page = 1,
    ): URLSearchParams {
        const params = new URLSearchParams();
        if (next.q) params.set("q", next.q);
        if (next.cidadeNome) params.set("cidade", next.cidadeNome);
        if (next.estadoSigla) params.set("uf", next.estadoSigla);
        if (next.genero) params.set("genero", next.genero);
        if (next.etnia) params.set("etnia", next.etnia);
        if (next.corOlhos) params.set("cor_olhos", next.corOlhos);
        if (next.estiloCabelo) params.set("estilo_cabelo", next.estiloCabelo);
        if (next.tamanhoCabelo)
            params.set("tamanho_cabelo", next.tamanhoCabelo);
        if (next.idiomas?.length)
            params.set("idiomas", next.idiomas.join(","));
        if (next.formasPagamento?.length)
            params.set("pagamento", next.formasPagamento.join(","));
        if (next.diasAtende?.length)
            params.set("dias", next.diasAtende.join(","));
        if (next.atendePublicos?.length)
            params.set("atende", next.atendePublicos.join(","));
        if (next.praticas?.length)
            params.set("praticas", next.praticas.join(","));
        if (next.precoMin) params.set("preco_min", String(next.precoMin));
        if (next.precoMax) params.set("preco_max", String(next.precoMax));
        if (next.comAudio) params.set("audio", "1");
        if (next.comBoost) params.set("boost", "1");
        if (nextOrdenar !== "relevancia") params.set("ordenar", nextOrdenar);
        if (page > 1) params.set("pagina", String(page));
        return params;
    }

    function navegar(
        next: BuscaFiltros,
        nextOrdenar: BuscaOrdenacao = ordenar,
        page = 1,
    ): void {
        const qs = buildSearchParams(next, nextOrdenar, page).toString();
        router.push(`/acompanhantes${qs ? `?${qs}` : ""}`);
    }

    function aplicarFiltros(): void {
        navegar(draft, ordenar, 1);
        setPanelOpen(false);
    }

    function limparFiltros(): void {
        const cleared: BuscaFiltros = {
            q: filtros.q,
            cidadeNome: filtros.cidadeNome,
            estadoSigla: filtros.estadoSigla,
            // Mantém o default editorial — usuário continua vendo
            // mulheres como ponto de partida.
            genero: "MULHER",
        };
        setDraft(cleared);
        navegar(cleared, ordenar, 1);
        setPanelOpen(false);
    }

    function trocarOrdenacao(value: BuscaOrdenacao): void {
        navegar(filtros, value, 1);
    }

    function buscarPorCidade(value: CityComboboxValue): void {
        if (!(value.name && value.uf)) {
            // Submit sem seleção — não navega.
            return;
        }
        const next: BuscaFiltros = {
            ...filtros,
            cidadeNome: value.name,
            estadoSigla: value.uf,
            q: undefined,
        };
        // Persiste pra próximas navegações dentro da sessão.
        escreverCidadeMemo({ name: value.name, uf: value.uf });
        navegar(next, ordenar, 1);
    }

    /**
     * Limpa cidade lembrada e volta pra tela de seleção.
     * Usado quando o usuário quer "trocar de cidade" do zero.
     */
    function limparCidade(): void {
        escreverCidadeMemo(null);
        router.push("/acompanhantes");
    }

    const ativos = contarAtivos(draft);
    const ativosUrl = contarAtivos(filtros);

    // ─────────────────────────────────────────────────────────────
    // Early return: tela "selecione sua cidade".
    //
    // Aparece quando o usuário chega em `/acompanhantes` sem
    // `cidade+uf` na URL E sem intent de listagem aberta. O efeito
    // de restauração do sessionStorage tenta redirecionar antes —
    // só ficamos nesta tela se for a primeira visita da sessão
    // (sem cidade lembrada) ou se a cidade foi propositalmente
    // limpa.
    // ─────────────────────────────────────────────────────────────
    if (!cidadeSelecionada && !modoListagemAberta) {
        return (
            <SelecionarCidadeView
                cityValue={cityValue}
                onCityChange={setCityValue}
                onCitySubmit={buscarPorCidade}
            />
        );
    }

    // Stories rail items — só monta quando há owners. Clique no
    // avatar abre o `MediaCarousel` no primeiro story do dono
    // selecionado.
    const railItems: StoriesRailItem[] = storiesOwners.map((o) => ({
        id: o.identificador,
        label: o.nome,
        avatarUrl: o.fotoUrl,
        unseen: o.naoVistos,
        total: o.total,
        // `href` não é navegado — `onItemClick` toma precedência.
        href: "#",
    }));

    /**
     * Abre o viewer de Stories no primeiro story do dono clicado.
     * Como o array `storiesItems` já vem flat e ordenado por dono,
     * basta achar o primeiro item daquele identificador.
     */
    /**
     * Owner cujo grupo de stories está sendo visualizado no
     * `MediaCarousel` em `storyMode`. Quando `null`, o carrossel
     * está fechado. A lista de items mostrada e a barra de
     * progresso são derivadas só dos stories desse owner — o
     * comportamento é estilo Instagram: vê todos da Helena, depois
     * passa pra próxima, e só fecha no fim do último owner.
     */
    const [activeOwnerId, setActiveOwnerId] = React.useState<string | null>(
        null,
    );

    /**
     * Stories do owner atualmente em foco. Memoizado pra que o
     * `MediaCarousel` não re-renderize quando outros estados
     * mudam.
     */
    const ownerStoryItems = React.useMemo(() => {
        if (activeOwnerId === null) return [];
        return storiesItems.filter(
            (s) => s.ownerIdentificador === activeOwnerId,
        );
    }, [activeOwnerId, storiesItems]);

    function abrirStoriesDoOwner(identificador: string): void {
        const target = storiesItems.find(
            (s) => s.ownerIdentificador === identificador,
        );
        if (!target) return;
        setActiveOwnerId(identificador);
        storyCarousel.openAt(target.id);
    }

    /**
     * Avança pro próximo owner na ordem definida pelo backend
     * (boost → premium → básico). Quando o owner atual é o último,
     * fecha o carrossel.
     */
    function avancarParaProximoOwner(): void {
        const owners = storiesOwners.map((o) => o.identificador);
        const idx = owners.indexOf(activeOwnerId ?? "");
        const next = owners[idx + 1];
        if (next === undefined) {
            setActiveOwnerId(null);
            storyCarousel.close();
            return;
        }
        const firstStoryNext = storiesItems.find(
            (s) => s.ownerIdentificador === next,
        );
        if (!firstStoryNext) {
            setActiveOwnerId(null);
            storyCarousel.close();
            return;
        }
        setActiveOwnerId(next);
        storyCarousel.openAt(firstStoryNext.id);
    }

    function fecharStories(): void {
        setActiveOwnerId(null);
        storyCarousel.close();
    }

    /**
     * Marca um Story como visto. Disparado quando o `onActiveChange`
     * do carrossel troca para um item ainda não visto. Persiste no
     * backend (best-effort) — anônimos não persistem.
     */
    function handleStoryViewed(storyId: string): void {
        const story = storiesItems.find((s) => s.id === storyId);
        if (!story || story.viewed) return;
        // Atualização otimista do estado local fica fora — a
        // página é re-renderizada pelo Next no router.refresh()
        // implícito, e a UX não depende disso pra avançar. Persiste
        // no backend pra que próximas visitas reflitam.
        void fetch(
            `/api/stories/${encodeURIComponent(storyId)}/view`,
            { method: "POST" },
        ).catch(() => undefined);
    }

    return (
        <div className="flex flex-col gap-6">
            {/* ── Título da página (rola normalmente) ───────── */}
            <div className="flex flex-col gap-1">
                <h1 className="text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">
                    Acompanhantes
                </h1>
                <p className="text-sm text-text-secondary">
                    {resultado.total === 0
                        ? "Nenhum perfil encontrado com esses filtros."
                        : filtros.cidadeNome && filtros.estadoSigla
                            ? `${resultado.total.toLocaleString("pt-BR")} ${resultado.total === 1 ? "perfil" : "perfis"} em ${filtros.cidadeNome}, ${filtros.estadoSigla}`
                            : `${resultado.total.toLocaleString("pt-BR")} ${resultado.total === 1 ? "perfil encontrado" : "perfis encontrados"} no Brasil`}
                </p>
            </div>

            {/* ── Barra fixa só com chip de cidade ──────────────
                Em estado normal (topo), aparece logo após o título.
                Quando rola, sobe pra `top-14` (abaixo da TopBar)
                e fica fixa — usuário sempre tem 1 toque pra trocar
                de cidade.
                
                Filtros e ordenação NÃO ficam sticky — voltam pro
                topo após o chip. Ao trocar de cidade, a navegação
                naturalmente leva o scroll pro topo (router.push). */}
            <div className="sticky top-14 z-40 -mx-4 flex items-center justify-center border-b border-border bg-surface/95 px-4 py-2 backdrop-blur-sm sm:-mx-6 sm:px-6">
                {filtros.cidadeNome && filtros.estadoSigla ? (
                    <button
                        type="button"
                        onClick={limparCidade}
                        className="inline-flex max-w-full items-center gap-2 rounded-full border border-[#ec7b5b]/25 bg-[color:var(--accent-soft)] px-3 py-1.5 text-sm font-semibold text-[color:var(--accent-deep)] transition-colors hover:bg-[color:var(--accent-soft)] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
                    >
                        <MapPinIcon size={14} />
                        <span className="truncate">
                            {filtros.cidadeNome}, {filtros.estadoSigla}
                        </span>
                        <span className="text-xs text-[color:var(--accent-deep)]">
                            trocar
                        </span>
                    </button>
                ) : (
                    <div className="w-full max-w-md">
                        <CityCombobox
                            value={cityValue}
                            onChange={setCityValue}
                            onSubmit={buscarPorCidade}
                            placeholder="Filtrar por cidade"
                        />
                    </div>
                )}
            </div>

            {/* Toolbar de filtros + ordenação — fica no topo,
                NÃO é sticky. Quando o usuário rola, somem da
                viewport e só voltam ao subir. */}
            <div className="flex items-center justify-between gap-2">
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setPanelOpen(true)}
                    className="lg:hidden"
                >
                    Filtros{" "}
                    {ativosUrl > 0 ? (
                        <span className="ml-1.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-[color:var(--accent)] px-1 text-[0.6rem] font-semibold text-white">
                            {ativosUrl}
                        </span>
                    ) : null}
                </Button>

                <div className="ml-auto flex min-w-0 items-center gap-2">
                    <span className="hidden text-xs text-text-secondary sm:inline">
                        Ordenar por:
                    </span>
                    <div className="w-44 sm:w-48">
                        <Select
                            value={ordenar}
                            onChange={(v) =>
                                trocarOrdenacao(v as BuscaOrdenacao)
                            }
                            options={ORDENACAO_OPCOES.map((o) => ({
                                value: o.value,
                                label: o.label,
                            }))}
                        />
                    </div>
                </div>
            </div>

            {/* ── Grid: sidebar (lg+) + resultados ───────────
                `min-w-0` no grid pai e `minmax(0, 1fr)` na coluna
                de resultados garantem que o conteúdo não force
                a largura do grid track. Sem isso, qualquer item
                "rígido" dentro do `<section>` (imagem com
                width intrínseco, texto sem `truncate`) puxa o
                grid pra fora do viewport em mobile. */}
            <div className="grid min-w-0 gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
                <FilterPanel
                    open={panelOpen}
                    onClose={() => setPanelOpen(false)}
                    activeCount={ativos}
                    onClear={limparFiltros}
                    footer={
                        <Button
                            type="button"
                            variant="primary"
                            size="md"
                            onClick={aplicarFiltros}
                            className="w-full"
                        >
                            Ver resultados
                        </Button>
                    }
                >
                    <FilterSection title="Destaques">
                        <div className="flex flex-col gap-2">
                            <Switch
                                label="Em destaque (Boost)"
                                description="Apenas perfis com boost ativo agora."
                                checked={draft.comBoost === true}
                                onChange={(v) =>
                                    setDraft({ ...draft, comBoost: v })
                                }
                            />
                            <Switch
                                label="Com áudio"
                                description="Apenas perfis com Áudio de apresentação."
                                checked={draft.comAudio === true}
                                onChange={(v) =>
                                    setDraft({ ...draft, comAudio: v })
                                }
                            />
                        </div>
                    </FilterSection>

                    <FilterSection title="Faixa de preço (R$ / hora)">
                        <div className="grid grid-cols-2 gap-2">
                            <Input
                                type="number"
                                inputMode="numeric"
                                placeholder="Mín"
                                value={
                                    draft.precoMin
                                        ? String(draft.precoMin / 100)
                                        : ""
                                }
                                onChange={(e) => {
                                    const v = e.target.value;
                                    const cents =
                                        v === ""
                                            ? undefined
                                            : Math.round(
                                                Number.parseFloat(v) * 100,
                                            );
                                    setDraft({
                                        ...draft,
                                        precoMin:
                                            Number.isFinite(cents as number)
                                                ? cents
                                                : undefined,
                                    });
                                }}
                            />
                            <Input
                                type="number"
                                inputMode="numeric"
                                placeholder="Máx"
                                value={
                                    draft.precoMax
                                        ? String(draft.precoMax / 100)
                                        : ""
                                }
                                onChange={(e) => {
                                    const v = e.target.value;
                                    const cents =
                                        v === ""
                                            ? undefined
                                            : Math.round(
                                                Number.parseFloat(v) * 100,
                                            );
                                    setDraft({
                                        ...draft,
                                        precoMax:
                                            Number.isFinite(cents as number)
                                                ? cents
                                                : undefined,
                                    });
                                }}
                            />
                        </div>
                    </FilterSection>

                    <FilterSection title="Identidade">
                        <Select
                            value={draft.genero ?? ""}
                            onChange={(v) =>
                                setDraft({
                                    ...draft,
                                    genero: v === "" ? undefined : v,
                                })
                            }
                            options={[
                                { value: "", label: "Todos" },
                                ...GENEROS.map((o) => ({
                                    value: o.value,
                                    label: o.label,
                                })),
                            ]}
                        />
                    </FilterSection>

                    <FilterSection title="Aparência">
                        <Select
                            label="Etnia"
                            value={draft.etnia ?? ""}
                            onChange={(v) =>
                                setDraft({
                                    ...draft,
                                    etnia: v === "" ? undefined : v,
                                })
                            }
                            options={[
                                { value: "", label: "Qualquer" },
                                ...ETNIAS.map((o) => ({
                                    value: o.value,
                                    label: o.label,
                                })),
                            ]}
                        />
                        <Select
                            label="Cor dos olhos"
                            value={draft.corOlhos ?? ""}
                            onChange={(v) =>
                                setDraft({
                                    ...draft,
                                    corOlhos: v === "" ? undefined : v,
                                })
                            }
                            options={[
                                { value: "", label: "Qualquer" },
                                ...CORES_OLHOS.map((o) => ({
                                    value: o.value,
                                    label: o.label,
                                })),
                            ]}
                        />
                        <Select
                            label="Estilo do cabelo"
                            value={draft.estiloCabelo ?? ""}
                            onChange={(v) =>
                                setDraft({
                                    ...draft,
                                    estiloCabelo: v === "" ? undefined : v,
                                })
                            }
                            options={[
                                { value: "", label: "Qualquer" },
                                ...ESTILOS_CABELO.map((o) => ({
                                    value: o.value,
                                    label: o.label,
                                })),
                            ]}
                        />
                        <Select
                            label="Tamanho do cabelo"
                            value={draft.tamanhoCabelo ?? ""}
                            onChange={(v) =>
                                setDraft({
                                    ...draft,
                                    tamanhoCabelo: v === "" ? undefined : v,
                                })
                            }
                            options={[
                                { value: "", label: "Qualquer" },
                                ...TAMANHOS_CABELO.map((o) => ({
                                    value: o.value,
                                    label: o.label,
                                })),
                            ]}
                        />
                    </FilterSection>

                    <ChipsFilter
                        title="Idiomas"
                        options={IDIOMAS.map((i) => ({
                            value: i.value,
                            label: i.label,
                        }))}
                        value={draft.idiomas ?? []}
                        onChange={(v) => setDraft({ ...draft, idiomas: v })}
                    />

                    <ChipsFilter
                        title="Atende"
                        options={ATENDE.map((i) => ({
                            value: i.value,
                            label: i.label,
                        }))}
                        value={draft.atendePublicos ?? []}
                        onChange={(v) =>
                            setDraft({ ...draft, atendePublicos: v })
                        }
                    />

                    <ChipsFilter
                        title="Práticas"
                        options={PRATICAS.map((i) => ({
                            value: i.value,
                            label: i.label,
                        }))}
                        value={draft.praticas ?? []}
                        onChange={(v) => setDraft({ ...draft, praticas: v })}
                    />

                    <ChipsFilter
                        title="Pagamento"
                        options={FORMAS_PAGAMENTO.map((i) => ({
                            value: i.value,
                            label: i.label,
                        }))}
                        value={draft.formasPagamento ?? []}
                        onChange={(v) =>
                            setDraft({ ...draft, formasPagamento: v })
                        }
                    />

                    <ChipsFilter
                        title="Dias da semana"
                        options={DIAS_SEMANA.map((i) => ({
                            value: i.value,
                            label: i.label,
                        }))}
                        value={draft.diasAtende ?? []}
                        onChange={(v) =>
                            setDraft({ ...draft, diasAtende: v })
                        }
                    />

                    {/* Aplicar / limpar — visível em desktop também
                        (aplicar dispara navegação client). */}
                    <div className="hidden flex-col gap-2 lg:flex">
                        <Button
                            type="button"
                            variant="primary"
                            size="sm"
                            onClick={aplicarFiltros}
                            disabled={
                                JSON.stringify(draft) ===
                                JSON.stringify(filtros)
                            }
                        >
                            Aplicar filtros
                        </Button>
                        {ativos > 0 ? (
                            <LinkButton
                                onClick={limparFiltros}
                                tone="danger"
                            >
                                Limpar tudo
                            </LinkButton>
                        ) : null}
                    </div>
                </FilterPanel>

                {/* Resultados */}
                <section className="flex min-w-0 flex-col gap-5">
                    {/* ── Tira de Stories da cidade ───────────────
                        Aparece entre o painel de filtros e o grid
                        de cards. Depois dos filtros e antes dos
                        perfis. Clique num avatar abre o
                        `MediaCarousel` em `storyMode` posicionado
                        no primeiro story daquele dono — passa por
                        todos da Acompanhante e segue pra próxima
                        automaticamente, porque os items vêm
                        achatados. */}
                    {railItems.length > 0 ? (
                        <StoriesRail
                            items={railItems}
                            onItemClick={abrirStoriesDoOwner}
                        />
                    ) : null}

                    {items.length > 0 ? (
                        <>
                            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                                {items.map((item) => (
                                    <ProfileFeedCard
                                        key={item.identificador}
                                        href={`/acompanhantes/${item.identificador}`}
                                        name={item.nome}
                                        identifier={item.identificador}
                                        photoUrl={item.fotoUrl}
                                        cityName={item.cidadeNome}
                                        stateSigla={item.estadoSigla}
                                        neighborhood={item.bairroNome}
                                        description={item.descricao}
                                        priceLabel={
                                            item.valorHoraCents !== null
                                                ? formatarValorHora(
                                                    item.valorHoraCents,
                                                )
                                                : undefined
                                        }
                                        priceCaption="a partir de"
                                        mediaCount={item.mediasCount}
                                        hasAudio={item.audioUrl !== null}
                                        audio={
                                            item.audioUrl !== null ? (
                                                <AudioWavePlayer
                                                    src={item.audioUrl}
                                                    mimeType={
                                                        item.audioMimeType ??
                                                        undefined
                                                    }
                                                    variant="mini"
                                                    stopPropagation
                                                />
                                            ) : null
                                        }
                                        badge={renderRankBadge(
                                            item.planoExibicao,
                                        )}
                                        verified={item.verificada}
                                    />
                                ))}
                            </div>

                            {/* Sentinela de scroll infinito.
                                Carrega +24 quando entra na viewport
                                (rootMargin de 600px antes do fim
                                pra dar tempo do request retornar
                                antes do usuário ver "vazio"). */}
                            <InfiniteScrollSentinel
                                hasMore={hasMore}
                                loading={loading}
                                onLoadMore={() => void loadMore()}
                                loadingLabel="Carregando mais perfis…"
                            />
                        </>
                    ) : (
                        <EmptyState
                            icon={<UsersIcon size={20} />}
                            title="Nenhum perfil encontrado"
                            description="Tente ajustar os filtros ou ampliar a faixa de preço."
                            action={
                                ativosUrl > 0 ? (
                                    <Button
                                        type="button"
                                        size="sm"
                                        onClick={limparFiltros}
                                    >
                                        Limpar filtros
                                    </Button>
                                ) : undefined
                            }
                        />
                    )}
                </section>
            </div>

            {/* ── Viewer de Stories ──────────────────────────────
                Modal compartilhado pra todos os stories ativos
                da cidade. Ordem: Boost → Premium → Básico → mais
                antigos primeiro dentro de cada dona. Ao terminar,
                fecha automaticamente.
                
                O carrossel reusa o `MediaCarousel storyMode` —
                progress bar segmentada, auto-advance, like (apenas
                Fan persiste no backend), description como caption.
                
                Header customizado mostrando avatar + nome do dono
                fica como overlay sobre a mídia (renderizado
                separadamente fora do MediaCarousel pra não
                desrespeitar a ordem dos primitivos). */}
            {storiesItems.length > 0 ? (
                <>
                    <MediaCarousel
                        items={ownerStoryItems.map((s) => ({
                            id: s.id,
                            type: s.type,
                            url: s.url,
                            description: s.description,
                            createdAt: s.createdAt,
                            likes: s.likes,
                            liked: s.liked,
                        }))}
                        activeId={storyCarousel.activeId}
                        onActiveChange={(id) => {
                            storyCarousel.openAt(id);
                            handleStoryViewed(id);
                        }}
                        open={storyCarousel.open}
                        onClose={fecharStories}
                        onComplete={avancarParaProximoOwner}
                        storyMode
                    />
                    <StoryOwnerOverlay
                        active={ownerStoryItems.find(
                            (s) => s.id === storyCarousel.activeId,
                        ) ?? null}
                        open={storyCarousel.open}
                    />
                </>
            ) : null}
        </div>
    );
}

/**
 * Pequeno overlay com avatar + nome do dono do Story atualmente
 * em foco, fixado no topo do `MediaCarousel`. Renderiza fora da
 * tree do MediaCarousel — usa `position: fixed` pra ficar acima.
 *
 * Mantido como subcomponente local porque é específico da busca
 * (o carrossel da galeria não tem dono trocando entre items). Só
 * aparece quando o viewer está aberto.
 */
function StoryOwnerOverlay({
    active,
    open,
}: {
    active: BuscaStoryItem | null;
    open: boolean;
}): React.ReactElement | null {
    if (!open || !active) return null;
    return (
        <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex justify-center px-4 pt-7 sm:pt-9">
            <a
                href={`/acompanhantes/${active.ownerIdentificador}`}
                className="pointer-events-auto inline-flex max-w-full items-center gap-2 rounded-full bg-black/55 px-3 py-1.5 text-white backdrop-blur-sm transition-colors hover:bg-black/75 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
                <Avatar
                    src={active.ownerFotoUrl}
                    name={active.ownerNome}
                    size="sm"
                />
                <span className="flex flex-col leading-tight">
                    <span className="truncate text-xs font-semibold">
                        {active.ownerNome}
                    </span>
                    <span className="truncate text-[0.65rem] text-white/80">
                        @{active.ownerIdentificador}
                    </span>
                </span>
            </a>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────
// Helpers locais
// ─────────────────────────────────────────────────────────────────────

function renderRankBadge(plano: PlanoExibicao): React.ReactNode {
    if (plano === "BOOST") {
        return (
            <RankBadge tone="hero" icon={<FlameIcon size={10} />}>
                Boost
            </RankBadge>
        );
    }
    if (plano === "PREMIUM") {
        return (
            <RankBadge tone="feature" icon={<CrownIcon size={10} />}>
                Premium
            </RankBadge>
        );
    }
    return null;
}

/**
 * Filtro multi-select baseado em chips simples. Usado dentro do
 * FilterPanel para dimensões com vocabulário fechado.
 */
function ChipsFilter({
    title,
    options,
    value,
    onChange,
}: {
    title: string;
    options: ReadonlyArray<{ value: string; label: string }>;
    value: ReadonlyArray<string>;
    onChange: (next: string[]) => void;
}): React.ReactElement {
    const valueSet = React.useMemo(() => new Set(value), [value]);

    function toggle(opt: string): void {
        if (valueSet.has(opt)) {
            onChange(value.filter((v) => v !== opt));
        } else {
            onChange([...value, opt]);
        }
    }

    return (
        <FilterSection title={title}>
            <div className="flex flex-wrap gap-1.5">
                {options.map((opt) => {
                    const active = valueSet.has(opt.value);
                    return (
                        <button
                            key={opt.value}
                            type="button"
                            onClick={() => toggle(opt.value)}
                            aria-pressed={active}
                            className={[
                                "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                                active
                                    ? "border-primary-600 bg-[color:var(--accent)] text-white"
                                    : "border-neutral-200 bg-surface text-text-secondary hover:border-[#ec7b5b]/40 hover:text-text-primary",
                            ].join(" ")}
                        >
                            {opt.label}
                        </button>
                    );
                })}
            </div>
        </FilterSection>
    );
}

/**
 * Marca como `not used` o componente `Badge` importado mas não
 * referenciado ainda (mantido para extensão futura). Removido na
 * próxima sweep.
 */
const _unused = Badge;
void _unused;

/**
 * Tela de seleção de cidade — renderizada quando o usuário chega em
 * `/acompanhantes` sem `cidade+uf` na URL e sem cidade lembrada
 * no `sessionStorage`.
 *
 * Não mostra nenhuma listagem — força o usuário a escolher um
 * recorte geográfico antes. Visualmente um `Card` central com o
 * {@link CityCombobox} grande.
 */
function SelecionarCidadeView({
    cityValue,
    onCityChange,
    onCitySubmit,
}: {
    cityValue: CityComboboxValue;
    onCityChange: (next: CityComboboxValue) => void;
    onCitySubmit: (value: CityComboboxValue) => void;
}): React.ReactElement {
    return (
        <div className="flex flex-col gap-6">
            <header className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">
                    Acompanhantes
                </h1>
                <p className="text-sm text-text-secondary">
                    Selecione sua cidade pra ver os perfis disponíveis.
                </p>
            </header>
            <CityCombobox
                value={cityValue}
                onChange={onCityChange}
                onSubmit={onCitySubmit}
                placeholder="Em qual cidade você está?"
            />
        </div>
    );
}
