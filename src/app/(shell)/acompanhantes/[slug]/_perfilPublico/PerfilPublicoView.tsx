"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
    AttributeTile,
    AudioWavePlayer,
    BanknoteIcon,
    BookmarkButton,
    Button,
    Card,
    CashIcon,
    ChatIcon,
    CreditCardIcon,
    CrownIcon,
    EyeIcon,
    FlameIcon,
    FootprintIcon,
    GlobeIcon,
    HeartIcon,
    IconSegmented,
    ImageIcon,
    MapPinIcon,
    MediaCarousel,
    MediaGrid,
    Paginator,
    PixIcon,
    PlayIcon,
    ProfileHeader,
    RankBadge,
    ReportButton,
    ReportDialog,
    RulerIcon,
    ScissorsIcon,
    SectionHeader,
    SparklesIcon,
    StatCard,
    TagChip,
    VerifiedBadge,
    WeekCalendar,
    WeightIcon,
    WhatsappIcon,
    useMediaCarousel,
    useModal,
    type IconSegmentedOption,
    type MediaComment,
    type MediaItem,
    type WeekDay,
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
    type FormaPagamento,
} from "@/domain/atendimentoComercial";
import { buildAuthUrl } from "@/domain/redirect";

import type {
    PerfilAcompanhantePublico,
    PlanoExibicao,
} from "@/server/acompanhante-profile";
import type { QuestionPublica } from "@/server/questions";
import type { ReviewPublico } from "@/server/reviews";

import { AvaliacoesSection } from "./AvaliacoesSection";
import { PerguntasSection } from "./PerguntasSection";

/**
 * "Tipo de viewer" — quem está abrindo o perfil. Determina UX:
 *
 * - `"anonimo"`: usuário não logado. Vê tudo, mas não pode avaliar.
 * - `"cliente"`: Cliente autenticado. Pode avaliar.
 * - `"acompanhante"`: outra Acompanhante. Pode visitar mas não avalia.
 */
export type ViewerKind = "anonimo" | "cliente" | "acompanhante";

/**
 * Renderização completa do perfil público. Aceita o
 * {@link PerfilAcompanhantePublico} (sem PII) e a galeria já mapeada
 * pra `MediaItem`.
 *
 * Visual mais "vitrine" do que "ficha de cadastro":
 *
 * 1. Header com avatar + nome + plano discriminado.
 * 2. Meta-row compacta com localização e visualizações.
 * 3. CTA grande do WhatsApp.
 * 4. Áudio (se houver).
 * 5. Bio.
 * 6. Galeria com filtro (Tudo/Fotos/Vídeos) e paginação.
 * 7. **Valor da hora**: {@link StatHighlight} hero com gradiente.
 * 8. **Pagamentos**: chips chunky com ícones grandes.
 * 9. **Disponibilidade semanal**: {@link WeekCalendar} visual.
 * 10. **Aparência**: grid de {@link AttributeTile} com ícones autorais
 *     (peso/altura/pé/etnia/olhos/cabelo).
 * 11. **Características**: hashtags só pros booleanos `true`.
 * 12. **Quem atendo** + práticas + idiomas em chips.
 *
 * Mobile-first sempre. Sem botões de like/delete (sistemas
 * correspondentes ainda não existem).
 */
export interface PerfilPublicoViewProps {
    /** `User.identificador` da Acompanhante (slug). Usado nos calls
     *  de avaliação. */
    slug: string;
    /**
     * `User.id` da Acompanhante. Necessário pra disparar denúncias
     * via {@link import("@/components").ReportButton} (a API exige
     * UUID, não slug).
     */
    profileUserId: string;
    perfil: PerfilAcompanhantePublico;
    galeriaItems: ReadonlyArray<MediaItem>;
    /** Avaliações públicas mais recentes (apenas texto). */
    reviews: ReadonlyArray<ReviewPublico>;
    /** Perguntas e respostas públicas. */
    perguntas: ReadonlyArray<QuestionPublica>;
    /** Total real de perguntas (count completo no banco) — usado
     *  pelo gate "+ X perguntas". A lista `perguntas` pode vir
     *  truncada pra anônimo/Grátis, mas o count permanece exato. */
    perguntasCount: number;
    /** Total de curtidas (foto perfil + galeria + stories ativos). */
    likesTotal: number;
    /** Stories ativos para exibição no carrossel. */
    storiesAtivos: ReadonlyArray<MediaItem & { viewed: boolean }>;
    /**
     * Estado do anel de Story ao redor do avatar:
     *
     * - `"unseen"`: há story ativo que o viewer não viu (anel
     *   colorido).
     * - `"seen"`: tem stories ativos mas todos já vistos (anel
     *   cinza).
     * - `"none"`: nenhum story ativo (sem anel).
     */
    storyRing: "unseen" | "seen" | "none";
    /** Tipo de viewer — alimenta UI condicional do bloco de
     *  avaliação. */
    viewerKind: ViewerKind;
    /** `true` quando o viewer é a própria dona do perfil. */
    viewerIsOwner: boolean;
    /**
     * `true` quando o viewer é Cliente Fan — pode curtir e comentar.
     * Cliente Grátis e anônimo veem os botões mas são redirecionados
     * pra upgrade ao tentar interagir.
     */
    viewerIsFan: boolean;
    /** Identificador (`@`) do viewer autenticado, ou `null`. */
    viewerNome: string | null;
    /** URL da foto do viewer Cliente, pra avatar no `CommentInput`. */
    viewerFotoUrl: string | null;
    /**
     * Avaliação (apenas texto) que o Cliente autenticado já deixou
     * (ou `null`). Usado pra pré-popular o textarea "Sua avaliação".
     */
    minhaReview: { comment: string; rating: number | null } | null;
    /**
     * Estado inicial do bookmark (Cliente logado já salvou este
     * perfil?). `null` quando não-Cliente — botão não aparece.
     */
    favoritoInicial: boolean | null;
    /**
     * Stories Highlights (destaques permanentes) agrupados por
     * título. Lista vazia OK — rail simplesmente não renderiza.
     */
    destaques: ReadonlyArray<{
        title: string;
        total: number;
        coverUrl: string;
        coverKind: "PHOTO" | "VIDEO";
        coverMediaId: string;
        /** Stories do destaque, em ordem. */
        stories: ReadonlyArray<MediaItem>;
    }>;
    /**
     * TopicAudios públicos da Acompanhante — FAQ sonora. Lista vazia
     * OK (a maioria dos perfis ainda não tem).
     */
    topicAudios: ReadonlyArray<{
        topicKind: string;
        url: string;
        mimeType: string;
    }>;
}

const FORMA_PAGAMENTO_ICONS: Record<FormaPagamento, React.ReactElement> = {
    DINHEIRO: <CashIcon size={20} />,
    PIX: <PixIcon size={20} />,
    CARTAO_CREDITO: <CreditCardIcon size={20} />,
    CARTAO_DEBITO: <CreditCardIcon size={20} />,
    TRANSFERENCIA: <BanknoteIcon size={20} />,
};

/**
 * Mapa visual dos 7 dias da semana. Mantemos a ordem pt-BR canônica
 * (SEG → DOM). Os labels longos são lidos por screen readers via o
 * `WeekCalendar`.
 */
const WEEK_DAYS_VIEW: ReadonlyArray<WeekDay> = DIAS_SEMANA.map((d) => ({
    value: d.value,
    shortLabel: d.label,
    longLabel: d.longLabel,
}));

/** Rótulo visível pra cada `topicKind` na FAQ sonora pública. */
const TOPIC_AUDIO_PUBLIC_LABELS: Record<string, string> = {
    PRECO: "Preço",
    CASAL: "Atende casal?",
    DISPONIBILIDADE: "Disponibilidade",
    LOCAL: "Local de atendimento",
    PRATICAS: "Práticas",
    PAGAMENTO: "Pagamento",
};

type FiltroGaleria = "tudo" | "fotos" | "videos";

export function PerfilPublicoView({
    slug,
    profileUserId,
    perfil,
    galeriaItems: galeriaItemsProp,
    reviews,
    perguntas,
    perguntasCount,
    likesTotal,
    storiesAtivos,
    storyRing,
    viewerKind,
    viewerIsOwner,
    viewerIsFan,
    viewerNome,
    viewerFotoUrl,
    minhaReview,
    favoritoInicial,
    destaques,
    topicAudios,
}: PerfilPublicoViewProps): React.ReactElement {
    const router = useRouter();
    const pathname = usePathname();
    const carousel = useMediaCarousel();
    const storyCarousel = useMediaCarousel();
    const [filtroGaleria, setFiltroGaleria] =
        React.useState<FiltroGaleria>("tudo");

    // Stories ativos do dono — estado local pra refletir mudanças
    // de `viewed` e `liked` sem reload completo.
    const [storiesState, setStoriesState] = React.useState(storiesAtivos);
    React.useEffect(() => {
        setStoriesState(storiesAtivos);
    }, [storiesAtivos]);

    const [storyRingState, setStoryRingState] = React.useState(storyRing);
    React.useEffect(() => {
        setStoryRingState(storyRing);
    }, [storyRing]);

    // Estado do viewer de Highlights — qual destaque está aberto.
    // Quando `null`, viewer fechado. Quando string, abrimos o
    // MediaCarousel com os stories daquele título.
    const [highlightAtivo, setHighlightAtivo] = React.useState<string | null>(
        null,
    );
    const highlightCarousel = useMediaCarousel();
    const storiesDoHighlight = React.useMemo<ReadonlyArray<MediaItem>>(() => {
        if (highlightAtivo === null) return [];
        const grupo = destaques.find((d) => d.title === highlightAtivo);
        return grupo?.stories ?? [];
    }, [highlightAtivo, destaques]);

    // Estado do bookmark — só inicializa pra Cliente logado. Owner /
    // Acompanhante / anônimo recebem `null` e o botão não aparece.
    const [favorito, setFavorito] = React.useState<boolean>(
        favoritoInicial ?? false,
    );
    const [favoritoLoading, setFavoritoLoading] = React.useState(false);

    /**
     * Toggle otimista do favorito. Botão só renderiza pra Cliente
     * logado (`viewerKind === "cliente"`), então não precisamos
     * tratar o caso anônimo aqui — UI já gateia. Erro de rede
     * reverte o estado e mostra inline (sem alert).
     */
    async function handleToggleFavorito(): Promise<void> {
        if (favoritoLoading) return;
        const next = !favorito;
        setFavorito(next);
        setFavoritoLoading(true);
        try {
            const res = await fetch(
                `/api/acompanhantes/${encodeURIComponent(slug)}/favorite`,
                { method: "POST" },
            );
            if (!res.ok) {
                // Reverte otimismo. Botão silencioso — sem alert.
                setFavorito(!next);
            }
        } catch {
            setFavorito(!next);
        } finally {
            setFavoritoLoading(false);
        }
    }

    /**
     * State do {@link ReportDialog} pra denunciar mídias do
     * MediaCarousel. `targetId` é o `mediaId` do item ativo.
     * Anônimo não tem botão (não pode denunciar sem sessão).
     */
    const [reportMediaId, setReportMediaId] = React.useState<string | null>(
        null,
    );
    /**
     * Igual ao acima, mas pra denunciar comentário (`COMMENT`).
     */
    const [reportCommentId, setReportCommentId] = React.useState<
        string | null
    >(null);

    /**
     * Abre o carrossel de Stories no primeiro não visto, ou no
     * primeiro caso todos já tenham sido vistos. Marca como visto
     * imediatamente (otimista) e dispara o POST.
     */
    function abrirStories(): void {
        if (storiesState.length === 0) return;
        const primeiroNaoVisto = storiesState.find((s) => !s.viewed);
        const target = primeiroNaoVisto ?? storiesState[0];
        if (!target) return;
        storyCarousel.openAt(target.id);
    }

    // ─────────────────────────────────────────────────────────────
    // Auto-abertura quando vem `?stories=1`
    //
    // Usado pela tira de Stories da página de busca: clicar num
    // avatar leva para `/acompanhantes/<slug>?stories=1`. Aqui
    // detectamos o flag, abrimos o viewer e limpamos a query
    // string com `router.replace` pra não disparar de novo em
    // navegação subsequente.
    // ─────────────────────────────────────────────────────────────
    const searchParams = useSearchParams();
    const stillOpenedFromQueryRef = React.useRef(false);
    React.useEffect(() => {
        if (stillOpenedFromQueryRef.current) return;
        if (searchParams.get("stories") !== "1") return;
        if (storiesState.length === 0) return;
        stillOpenedFromQueryRef.current = true;
        abrirStories();
        // Limpa o flag da URL pra que recarregar a página não abra
        // novamente.
        const params = new URLSearchParams(searchParams.toString());
        params.delete("stories");
        const qs = params.toString();
        router.replace(`${pathname}${qs ? `?${qs}` : ""}`);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams, storiesState.length]);

    /**
     * Marca um Story como visto. Disparado quando o
     * `onActiveChange` do carrossel apontar pra um story ainda
     * não visto. Atualiza estado local + ring + persiste.
     */
    function handleStoryViewed(storyId: string): void {
        const target = storiesState.find((s) => s.id === storyId);
        if (!target || target.viewed) return;

        // Atualiza estado local (otimista) — flag viewed.
        setStoriesState((prev) =>
            prev.map((s) =>
                s.id === storyId ? { ...s, viewed: true } : s,
            ),
        );
        // Recalcula ring local: se todos `viewed`, vira "seen".
        setStoryRingState((prev) => {
            if (prev === "none") return prev;
            const allViewed = storiesState.every(
                (s) => s.id === storyId || s.viewed,
            );
            return allViewed ? "seen" : "unseen";
        });
        // Persiste no backend (best-effort).
        if (viewerKind === "anonimo") return;
        void fetch(
            `/api/stories/${encodeURIComponent(storyId)}/view`,
            { method: "POST" },
        ).catch(() => undefined);
    }

    /**
     * Toggle de like em Story. Reusa o endpoint da galeria —
     * `MediaLike` é independente do `role`. Apenas Cliente Fan
     * persiste no backend; outros recebem rejeição (UI também
     * desabilita o botão pra esses).
     */
    function handleStoryToggleLike(storyId: string, desired: boolean): void {
        // Otimista no estado local — atualiza `liked` e `likes`.
        setStoriesState((prev) =>
            prev.map((s) =>
                s.id === storyId
                    ? {
                        ...s,
                        liked: desired,
                        likes: Math.max(
                            0,
                            (s.likes ?? 0) + (desired ? 1 : -1),
                        ),
                    }
                    : s,
            ),
        );
        if (viewerKind !== "cliente" || !viewerIsFan) return;
        void fetch(`/api/medias/${encodeURIComponent(storyId)}/likes`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ liked: desired }),
        }).catch(() => undefined);
    }

    // Quando o usuário troca de story dentro do carrossel,
    // marcamos como visto (se ainda não foi).
    React.useEffect(() => {
        if (!storyCarousel.open || storyCarousel.activeId === null) return;
        handleStoryViewed(storyCarousel.activeId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [storyCarousel.open, storyCarousel.activeId]);

    // Estado local da galeria — permite atualização otimista de
    // likes (toggle) e comments (count) sem reload completo. Resync
    // com a prop quando o servidor manda nova galeria via refresh.
    const [galeriaItems, setGaleriaItems] = React.useState<
        ReadonlyArray<MediaItem>
    >(galeriaItemsProp);
    React.useEffect(() => {
        setGaleriaItems(galeriaItemsProp);
    }, [galeriaItemsProp]);

    // Comentários por mídia. Carregados sob demanda quando o
    // carrossel abre, ou quando o usuário envia/exclui.
    const [commentsByMedia, setCommentsByMedia] = React.useState<
        Record<string, ReadonlyArray<MediaComment>>
    >({});

    /**
     * Carrega comentários da mídia ativa quando o carrossel abre
     * ou troca de item. Cache simples por id — não recarrega se
     * já tem. Pula completamente para viewers que não podem ver
     * comentários (anônimo e Cliente Grátis).
     */
    React.useEffect(() => {
        const podeVerComentarios =
            viewerKind === "acompanhante" ||
            (viewerKind === "cliente" && viewerIsFan);
        if (!podeVerComentarios) return;
        if (!carousel.open || carousel.activeId === null) return;
        const id = carousel.activeId;
        if (commentsByMedia[id] !== undefined) return;

        let cancelled = false;
        void fetch(`/api/medias/${encodeURIComponent(id)}/comments`)
            .then((res) => (res.ok ? res.json() : null))
            .then((payload: { comments?: ReadonlyArray<RawComment> } | null) => {
                if (cancelled || !payload?.comments) return;
                setCommentsByMedia((prev) => ({
                    ...prev,
                    [id]: payload.comments!.map(toMediaComment),
                }));
            })
            .catch(() => undefined);
        return () => {
            cancelled = true;
        };
    }, [
        carousel.open,
        carousel.activeId,
        commentsByMedia,
        viewerKind,
        viewerIsFan,
    ]);

    /**
     * Toggle de curtida com atualização otimista. Cliente Grátis e
     * anônimo são redirecionados pra rota apropriada.
     */
    function handleToggleLike(itemId: string, liked: boolean): void {
        if (viewerKind === "anonimo") {
            router.push(buildAuthUrl("/login", pathname));
            return;
        }
        if (viewerKind === "acompanhante" || !viewerIsFan) {
            router.push(buildAuthUrl("/cliente/selecao-plano", pathname));
            return;
        }

        // Otimista.
        setGaleriaItems((prev) =>
            prev.map((m) =>
                m.id === itemId
                    ? {
                        ...m,
                        liked,
                        likes:
                            (m.likes ?? 0) +
                            (liked ? 1 : -1) * (m.liked === liked ? 0 : 1),
                    }
                    : m,
            ),
        );

        void fetch(`/api/medias/${encodeURIComponent(itemId)}/likes`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ liked }),
        })
            .then((res) => (res.ok ? res.json() : null))
            .then(
                (payload: { likesCount?: number } | null) => {
                    if (payload?.likesCount === undefined) return;
                    // Reconcilia o contador exato com o que o servidor
                    // retornou (corrige race conditions).
                    setGaleriaItems((prev) =>
                        prev.map((m) =>
                            m.id === itemId
                                ? { ...m, likes: payload.likesCount }
                                : m,
                        ),
                    );
                },
            )
            .catch(() => {
                // Reverte otimismo em caso de falha.
                setGaleriaItems((prev) =>
                    prev.map((m) =>
                        m.id === itemId ? { ...m, liked: !liked } : m,
                    ),
                );
            });
    }

    /**
     * Adiciona comentário com refetch da lista pra ter o item novo
     * com avatar+nome corretos do servidor.
     */
    function handleAddComment(itemId: string, text: string): void {
        if (viewerKind === "anonimo") {
            router.push(buildAuthUrl("/login", pathname));
            return;
        }
        if (viewerKind === "acompanhante" || !viewerIsFan) {
            router.push(buildAuthUrl("/cliente/selecao-plano", pathname));
            return;
        }

        const trimmed = text.trim();
        if (trimmed.length === 0) return;

        void fetch(`/api/medias/${encodeURIComponent(itemId)}/comments`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: trimmed }),
        })
            .then((res) => (res.ok ? res.json() : null))
            .then(
                (
                    payload: {
                        commentsCount?: number;
                    } | null,
                ) => {
                    if (!payload) return;
                    if (typeof payload.commentsCount === "number") {
                        setGaleriaItems((prev) =>
                            prev.map((m) =>
                                m.id === itemId
                                    ? { ...m, comments: payload.commentsCount }
                                    : m,
                            ),
                        );
                    }
                    // Refetch para atualizar a lista.
                    return fetch(
                        `/api/medias/${encodeURIComponent(itemId)}/comments`,
                    )
                        .then((res) => (res.ok ? res.json() : null))
                        .then(
                            (
                                p: {
                                    comments?: ReadonlyArray<RawComment>;
                                } | null,
                            ) => {
                                if (!p?.comments) return;
                                setCommentsByMedia((prev) => ({
                                    ...prev,
                                    [itemId]:
                                        p.comments!.map(toMediaComment),
                                }));
                            },
                        );
                },
            )
            .catch(() => undefined);
    }

    const valorHoraLabel =
        perfil.valorHoraCents !== null && perfil.valorHoraCents > 0
            ? formatarValorHora(perfil.valorHoraCents)
            : "A combinar";

    const formasPagamentoVisuals = perfil.formasPagamento.flatMap((v) => {
        const opt = FORMAS_PAGAMENTO.find((o) => o.value === v);
        return opt
            ? [{ value: v, label: opt.label as string }]
            : [];
    });

    const atendeLabels = perfil.atendePublicos
        .map((v) => labelFor(ATENDE, v))
        .filter((v): v is string => Boolean(v));
    const praticasLabels = perfil.realizaPraticas
        .map((v) => labelFor(PRATICAS, v))
        .filter((v): v is string => Boolean(v));
    const idiomasLabels = perfil.idiomas
        .map((v) => labelFor(IDIOMAS, v))
        .filter((v): v is string => Boolean(v));

    // Apenas atributos "Sim" viram hashtags. Os "Não"/null somem para
    // não poluir. Se nenhum estiver Sim, a seção inteira não renderiza.
    const characteristics = [
        { active: perfil.temSilicone === true, label: "Silicone" },
        { active: perfil.temTatuagens === true, label: "Tatuagens" },
        { active: perfil.temPiercing === true, label: "Piercing" },
        { active: perfil.fumante === true, label: "Fumante" },
    ].filter((x) => x.active);

    // Galeria filtrada — espelha o padrão do painel privado (MidiasTab).
    const galeriaFiltrada = React.useMemo<ReadonlyArray<MediaItem>>(() => {
        if (filtroGaleria === "fotos")
            return galeriaItems.filter((m) => m.type === "photo");
        if (filtroGaleria === "videos")
            return galeriaItems.filter((m) => m.type === "video");
        return galeriaItems;
    }, [filtroGaleria, galeriaItems]);

    const galeriaTotais = React.useMemo(() => {
        const fotos = galeriaItems.filter((m) => m.type === "photo").length;
        const videos = galeriaItems.filter((m) => m.type === "video").length;
        return { fotos, videos, total: galeriaItems.length };
    }, [galeriaItems]);

    const galeriaFilterOptions: ReadonlyArray<IconSegmentedOption> = [
        {
            value: "tudo",
            label: "Tudo",
            icon: <SparklesIcon size={14} />,
            count: galeriaTotais.total,
        },
        {
            value: "fotos",
            label: "Fotos",
            icon: <ImageIcon size={14} />,
            count: galeriaTotais.fotos,
        },
        {
            value: "videos",
            label: "Vídeos",
            icon: <PlayIcon size={14} />,
            count: galeriaTotais.videos,
        },
    ];

    return (
        <div className="flex flex-col gap-6">
            {/* Identidade + plano */}
            <ProfileHeader
                photoUrl={perfil.fotoUrl}
                name={perfil.nome}
                identifier={`@${perfil.identificador}`}
                badge={
                    <span className="inline-flex items-center gap-1.5">
                        {perfil.verificada ? (
                            <VerifiedBadge size="md" />
                        ) : null}
                        <PlanoBadge plano={perfil.planoExibicao} />
                    </span>
                }
                actions={
                    !viewerIsOwner && viewerKind !== "anonimo" ? (
                        <>
                            {viewerKind === "cliente" ? (
                                <BookmarkButton
                                    marked={favorito}
                                    onChange={() => {
                                        void handleToggleFavorito();
                                    }}
                                    disabled={favoritoLoading}
                                    size="md"
                                />
                            ) : null}
                            <ReportButton
                                targetType="USER"
                                targetId={profileUserId}
                                tone="neutral"
                                title="Denunciar perfil"
                            />
                        </>
                    ) : undefined
                }
                storyRing={storyRingState}
                onStoryClick={
                    storyRingState !== "none" && storiesState.length > 0
                        ? () => abrirStories()
                        : undefined
                }
            />

            {/* Meta-row compacta. Visualizações + curtidas totais
                (foto perfil + galeria + stories ativos). Localização
                sai daqui — já aparece em destaque no StatCard
                "Localização" abaixo. */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-text-secondary">
                <span className="inline-flex items-center gap-1.5">
                    <EyeIcon size={12} />
                    <span>
                        <span className="font-medium text-text-primary">
                            {formatViews(perfil.viewsCount)}
                        </span>{" "}
                        visualizações
                    </span>
                </span>
                <span aria-hidden="true" className="text-text-disabled">
                    ·
                </span>
                <span className="inline-flex items-center gap-1.5">
                    <HeartIcon size={12} />
                    <span>
                        <span className="font-medium text-text-primary">
                            {formatViews(likesTotal)}
                        </span>{" "}
                        {likesTotal === 1 ? "curtida" : "curtidas"}
                    </span>
                </span>
                {perfil.reviewsCount > 0 ? (
                    <>
                        <span aria-hidden="true" className="text-text-disabled">
                            ·
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                            <ChatIcon size={12} />
                            <span>
                                <span className="font-medium text-text-primary">
                                    {formatViews(perfil.reviewsCount)}
                                </span>{" "}
                                {perfil.reviewsCount === 1
                                    ? "avaliação"
                                    : "avaliações"}
                            </span>
                        </span>
                    </>
                ) : null}
            </div>

            {/* CTA principal: WhatsApp */}
            {perfil.whatsappUrl !== null ? (
                <WhatsappCTA href={perfil.whatsappUrl} slug={slug} />
            ) : null}

            {/* Valores + Localização — duas StatCards lado a lado em
                desktop, empilhadas em mobile. Ficam logo abaixo do
                CTA do WhatsApp pra serem a primeira "ficha" útil
                quando o visitante decide se vale a pena conversar. */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <StatCard
                    icon={<SparklesIcon size={14} />}
                    label="Valores"
                >
                    <div className="flex flex-col gap-0.5">
                        <span className="text-[0.7rem] text-text-secondary">
                            a partir de
                        </span>
                        <span className="text-xl font-semibold tracking-tight text-text-primary">
                            {valorHoraLabel}
                            {valorHoraLabel !== "A combinar" ? (
                                <span className="ml-1 text-xs font-normal text-text-secondary">
                                    (1 hora)
                                </span>
                            ) : null}
                        </span>
                    </div>
                </StatCard>

                <StatCard
                    icon={<MapPinIcon size={14} />}
                    label="Localização"
                >
                    <div className="flex flex-col gap-0.5">
                        {perfil.bairroNome ? (
                            <span className="text-xl font-semibold tracking-tight text-text-primary">
                                {perfil.bairroNome}
                            </span>
                        ) : null}
                        <span className="text-sm text-text-primary">
                            {perfil.cidadeNome} · {perfil.estadoSigla}
                        </span>
                    </div>
                </StatCard>
            </div>

            {/* Áudio de apresentação */}
            {/* Vídeo de apresentação (T08, Premium). Em destaque
                logo após o CTA do WhatsApp — quando presente, é
                provavelmente o conteúdo mais persuasivo do perfil. */}
            {perfil.videoApresentacaoUrl !== null ? (
                <section className="flex flex-col gap-2">
                    <SectionHeader title="Veja-me em movimento" />
                    <Card>
                        <video
                            src={perfil.videoApresentacaoUrl}
                            poster={
                                perfil.videoApresentacaoPosterUrl ?? undefined
                            }
                            controls
                            playsInline
                            className="w-full rounded-xl"
                        >
                            {perfil.videoApresentacaoMimeType ? (
                                <source
                                    src={perfil.videoApresentacaoUrl}
                                    type={perfil.videoApresentacaoMimeType}
                                />
                            ) : null}
                        </video>
                    </Card>
                </section>
            ) : null}

            {perfil.audioUrl !== null ? (
                <section className="flex flex-col gap-2">
                    <SectionHeader title="Ouça minha voz" />
                    <Card>
                        <AudioWavePlayer
                            src={perfil.audioUrl}
                            mimeType={perfil.audioMimeType ?? undefined}
                        />
                    </Card>
                </section>
            ) : null}

            {/* Sobre */}
            {perfil.descricao ? (
                <section className="flex flex-col gap-2">
                    <SectionHeader title="Sobre mim" />
                    <Card>
                        <p className="whitespace-pre-line text-sm leading-relaxed text-text-primary">
                            {perfil.descricao}
                        </p>
                    </Card>
                </section>
            ) : null}

            {/* Perguntas frequentes em áudio (T07). FAQ sonora —
                Acompanhante grava ≤30s respondendo perguntas
                comuns. Lista vazia → seção some. */}
            {topicAudios.length > 0 ? (
                <section className="flex flex-col gap-2">
                    <SectionHeader
                        title="Perguntas frequentes"
                        subtitle="Respostas em áudio"
                    />
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {topicAudios.map((t) => (
                            <Card key={t.topicKind}>
                                <div className="flex flex-col gap-2">
                                    <span className="text-sm font-semibold text-text-primary">
                                        {TOPIC_AUDIO_PUBLIC_LABELS[t.topicKind] ??
                                            t.topicKind}
                                    </span>
                                    <AudioWavePlayer
                                        src={t.url}
                                        mimeType={t.mimeType}
                                        aria-label={`Áudio de ${t.topicKind}`}
                                    />
                                </div>
                            </Card>
                        ))}
                    </div>
                </section>
            ) : null}

            {/* Stories Highlights (destaques permanentes) — rail
                circular acima da galeria. Cada item agrupa N
                stories pelo `highlightTitle`. Clicar abre o viewer
                em sequência. Lista vazia → seção some. */}
            {destaques.length > 0 ? (
                <section className="flex flex-col gap-3">
                    <SectionHeader title="Destaques" />
                    <div className="overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                        <ul className="flex items-start gap-4 snap-x snap-mandatory sm:gap-5">
                            {destaques.map((d) => (
                                <li
                                    key={d.title}
                                    className="snap-start shrink-0"
                                >
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setHighlightAtivo(d.title);
                                            const first = d.stories[0];
                                            if (first) {
                                                highlightCarousel.openAt(
                                                    first.id,
                                                );
                                            }
                                        }}
                                        aria-label={`Abrir destaque ${d.title}`}
                                        className="group flex w-[6rem] flex-col items-center gap-2 rounded-2xl px-1 py-1 transition-all hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ec7b5b]/40"
                                    >
                                        <span className="relative block transition-transform group-hover:scale-105">
                                            <span
                                                className="block rounded-full p-[3px] bg-gradient-to-br from-[color:var(--accent)] to-[color:var(--accent-deep)]"
                                            >
                                                <span className="block overflow-hidden rounded-full bg-surface p-[2px]">
                                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                                    <img
                                                        src={d.coverUrl}
                                                        alt=""
                                                        className="h-16 w-16 rounded-full object-cover"
                                                    />
                                                </span>
                                            </span>
                                            {d.coverKind === "VIDEO" ? (
                                                <span
                                                    aria-hidden="true"
                                                    className="absolute bottom-0 right-0 inline-flex h-5 w-5 items-center justify-center rounded-full bg-black/65 text-white ring-2 ring-surface"
                                                >
                                                    <PlayIcon size={10} />
                                                </span>
                                            ) : null}
                                        </span>
                                        <span className="block max-w-[6rem] truncate text-center text-xs font-medium text-text-primary">
                                            {d.title}
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                </section>
            ) : null}

            {/* Galeria */}
            <section className="flex flex-col gap-3">
                <SectionHeader
                    title="Galeria"
                    trailing={
                        galeriaTotais.total > 0 ? (
                            <IconSegmented
                                options={galeriaFilterOptions}
                                value={filtroGaleria}
                                onChange={(v) =>
                                    setFiltroGaleria(v as FiltroGaleria)
                                }
                                aria-label="Filtrar tipo de mídia"
                            />
                        ) : null
                    }
                />
                {galeriaFiltrada.length > 0 ? (
                    <Paginator
                        items={galeriaFiltrada}
                        pageSize={6}
                        render={(visible) => (
                            <MediaGrid
                                items={visible}
                                onOpen={carousel.openAt}
                                density="comfortable"
                            />
                        )}
                    />
                ) : (
                    <Card>
                        <p className="text-center text-sm text-text-secondary">
                            {galeriaTotais.total === 0
                                ? "Sem mídias publicadas ainda."
                                : "Nenhum item neste filtro."}
                        </p>
                    </Card>
                )}
            </section>

            {/* Formas de pagamento — tiles chunky */}
            {formasPagamentoVisuals.length > 0 ? (
                <section className="flex flex-col gap-2">
                    <SectionHeader title="Como você pode pagar" />
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {formasPagamentoVisuals.map((item) => (
                            <PaymentTile
                                key={item.value}
                                icon={FORMA_PAGAMENTO_ICONS[item.value]}
                                label={item.label}
                            />
                        ))}
                    </div>
                </section>
            ) : null}

            {/* Disponibilidade semanal — calendário visual */}
            {perfil.diasAtende.length > 0 ? (
                <section className="flex flex-col gap-2">
                    <SectionHeader title="Disponibilidade" />
                    <Card>
                        <WeekCalendar
                            days={WEEK_DAYS_VIEW}
                            activeValues={perfil.diasAtende}
                        />
                        <p className="mt-3 text-center text-[0.7rem] text-text-secondary">
                            Dias destacados são os que atendo.
                        </p>
                    </Card>
                </section>
            ) : null}

            {/* Aparência — grid de tiles com ícones grandes */}
            <section className="flex flex-col gap-2">
                <SectionHeader title="Aparência" />
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    <AttributeTile
                        icon={<WeightIcon size={20} />}
                        value={
                            perfil.pesoKg !== null
                                ? `${perfil.pesoKg} kg`
                                : "—"
                        }
                        label="Peso"
                    />
                    <AttributeTile
                        icon={<RulerIcon size={20} />}
                        value={
                            perfil.alturaCm !== null
                                ? `${perfil.alturaCm} cm`
                                : "—"
                        }
                        label="Altura"
                    />
                    <AttributeTile
                        icon={<FootprintIcon size={20} />}
                        value={
                            perfil.tamanhoPe !== null
                                ? String(perfil.tamanhoPe)
                                : "—"
                        }
                        label="Pé"
                    />
                    <AttributeTile
                        icon={<GlobeIcon size={20} />}
                        value={labelFor(ETNIAS, perfil.etnia) ?? "—"}
                        label="Etnia"
                    />
                    <AttributeTile
                        icon={<EyeIcon size={20} />}
                        value={labelFor(CORES_OLHOS, perfil.corOlhos) ?? "—"}
                        label="Olhos"
                    />
                    <AttributeTile
                        icon={<ScissorsIcon size={20} />}
                        value={joinCabelo(
                            labelFor(ESTILOS_CABELO, perfil.estiloCabelo),
                            labelFor(TAMANHOS_CABELO, perfil.tamanhoCabelo),
                        )}
                        label="Cabelo"
                    />
                </div>
            </section>

            {/* Quem atendo + Características — Card único com grid
                interno 1col mobile / 2cols desktop pra distribuir as
                TagBanks (Atende, Realiza, Características, Idiomas)
                e evitar o visual "tudo socado na esquerda". Usa
                gap-x-8 generoso entre colunas pra que cada TagBank
                respire. */}
            {(atendeLabels.length > 0 ||
                praticasLabels.length > 0 ||
                idiomasLabels.length > 0 ||
                characteristics.length > 0) ? (
                <section className="flex flex-col gap-2">
                    <SectionHeader title="Características" />
                    <Card>
                        <div className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
                            {atendeLabels.length > 0 ? (
                                <TagBank label="Atende">
                                    {atendeLabels.map((label) => (
                                        <TagChip
                                            key={label}
                                            tone="primary"
                                            size="md"
                                        >
                                            {label}
                                        </TagChip>
                                    ))}
                                </TagBank>
                            ) : null}

                            {praticasLabels.length > 0 ? (
                                <TagBank label="Realiza">
                                    {praticasLabels.map((label) => (
                                        <TagChip
                                            key={label}
                                            tone="soft"
                                            size="md"
                                        >
                                            {label}
                                        </TagChip>
                                    ))}
                                </TagBank>
                            ) : null}

                            {characteristics.length > 0 ? (
                                <TagBank label="Características">
                                    {characteristics.map((c) => (
                                        <TagChip
                                            key={c.label}
                                            tone="soft"
                                            size="md"
                                            prefix="#"
                                        >
                                            {c.label}
                                        </TagChip>
                                    ))}
                                </TagBank>
                            ) : null}

                            {idiomasLabels.length > 0 ? (
                                <TagBank label="Idiomas">
                                    {idiomasLabels.map((label) => (
                                        <TagChip
                                            key={label}
                                            tone="outline"
                                            size="md"
                                            icon={<GlobeIcon size={12} />}
                                        >
                                            {label}
                                        </TagChip>
                                    ))}
                                </TagBank>
                            ) : null}
                        </div>
                    </Card>
                </section>
            ) : null}

            {/* Perguntas e respostas (Q&A). Vem antes das avaliações
                porque cliente pergunta antes de decidir avaliar. */}
            <PerguntasSection
                slug={slug}
                perguntas={perguntas}
                perguntasCount={perguntasCount}
                viewerKind={viewerKind}
                viewerIsOwner={viewerIsOwner}
                viewerIsFan={viewerIsFan}
            />

            {/* Avaliações (apenas texto — sem nota numérica) */}
            <AvaliacoesSection
                slug={slug}
                reviews={reviews}
                reviewsCount={perfil.reviewsCount}
                viewerKind={viewerKind}
                viewerIsOwner={viewerIsOwner}
                viewerIsFan={viewerIsFan}
                minhaReview={minhaReview}
            />

            {/* CTA secundário: repete o "Falar no WhatsApp" no fim
                da página. Quem rolou tudo até aqui já decidiu — não
                obrigamos o usuário a rolar pra cima de novo. */}
            {perfil.whatsappUrl !== null ? (
                <WhatsappCTA href={perfil.whatsappUrl} slug={slug} />
            ) : null}

            {/* Carrossel modal */}
            <MediaCarousel
                items={galeriaFiltrada}
                activeId={carousel.activeId}
                onActiveChange={carousel.openAt}
                open={carousel.open}
                onClose={carousel.close}
                comments={
                    viewerKind === "cliente" && viewerIsFan
                        ? commentsByMedia
                        : viewerKind === "acompanhante"
                            ? commentsByMedia
                            : undefined
                }
                onToggleLike={handleToggleLike}
                onReport={
                    viewerKind !== "anonimo" && !viewerIsOwner
                        ? (id) => setReportMediaId(id)
                        : undefined
                }
                onReportComment={
                    viewerKind !== "anonimo"
                        ? (id) => setReportCommentId(id)
                        : undefined
                }
                onAddComment={
                    viewerKind === "cliente" && viewerIsFan
                        ? handleAddComment
                        : undefined
                }
                currentUserPhotoUrl={viewerFotoUrl}
                currentUserName={viewerNome ?? undefined}
                commentsLocked={
                    viewerKind === "anonimo"
                        ? {
                            title: "Comentários exclusivos",
                            description:
                                "Faça login como Cliente Fan pra ver e comentar.",
                            action: (
                                <Button href={buildAuthUrl("/login", pathname)} size="sm">
                                    Entrar
                                </Button>
                            ),
                        }
                        : viewerKind === "cliente" && !viewerIsFan
                            ? {
                                title: "Comentários exclusivos pra Fans",
                                description:
                                    "Vire Fan pra ver e publicar comentários nas fotos.",
                                action: (
                                    <Button
                                        href={buildAuthUrl("/cliente/selecao-plano", pathname)}
                                        size="sm"
                                    >
                                        Virar Fan
                                    </Button>
                                ),
                            }
                            : undefined
                }
            />

            {/* Carrossel de Stories. Reusa o mesmo MediaCarousel
                da galeria com `storyMode`: sem painel branco
                lateral, com progress bar segmentada no topo,
                toolbar overlay sobre a mídia, auto-advance e
                caption sobreposta. Marca como visto ao trocar
                de item, dispara like via endpoint compartilhado
                de mídia. */}
            <MediaCarousel
                items={storiesState}
                activeId={storyCarousel.activeId}
                onActiveChange={storyCarousel.openAt}
                open={storyCarousel.open}
                onClose={storyCarousel.close}
                storyMode
                onToggleLike={
                    viewerKind === "cliente" && viewerIsFan
                        ? handleStoryToggleLike
                        : undefined
                }
            />

            {/* Carrossel dos Stories de um Highlight. Mesmo
                `storyMode` mas sem onToggleLike (highlights são
                arquivados, viewer público não pode curtir). Fecha
                via close → reseta o highlightAtivo. */}
            <MediaCarousel
                items={storiesDoHighlight}
                activeId={highlightCarousel.activeId}
                onActiveChange={highlightCarousel.openAt}
                open={highlightCarousel.open && highlightAtivo !== null}
                onClose={() => {
                    highlightCarousel.close();
                    setHighlightAtivo(null);
                }}
                storyMode
            />

            {/* Diálogo de denúncia de mídia. `targetId` é o id da
                mídia ativa no MediaCarousel — capturado via
                `onReport` callback. */}
            <ReportDialog
                open={reportMediaId !== null}
                onClose={() => setReportMediaId(null)}
                targetType="MEDIA"
                targetId={reportMediaId ?? ""}
            />
            <ReportDialog
                open={reportCommentId !== null}
                onClose={() => setReportCommentId(null)}
                targetType="COMMENT"
                targetId={reportCommentId ?? ""}
            />
        </div>
    );
}

// ---------------------------------------------------------------------------
// Subcomponentes locais
// ---------------------------------------------------------------------------

/**
 * Selo de plano discriminado. Wrap fino sobre o {@link RankBadge}
 * que mapeia `PlanoExibicao` → tom semântico + label/ícone. Boost
 * ganha tom "hero" + ícone de chama; Premium tem "feature" com
 * coroa; Básico fica "standard" com estrela.
 */
function PlanoBadge({
    plano,
}: {
    plano: PlanoExibicao;
}): React.ReactElement {
    const config: Record<
        PlanoExibicao,
        {
            tone: "hero" | "feature" | "standard";
            icon: React.ReactElement;
            label: string;
        }
    > = {
        BOOST: {
            tone: "hero",
            icon: <FlameIcon size={11} />,
            label: "Em destaque",
        },
        PREMIUM: {
            tone: "feature",
            icon: <CrownIcon size={11} />,
            label: "Premium",
        },
        BASICO: {
            tone: "standard",
            icon: <SparklesIcon size={11} />,
            label: "Básico",
        },
    };
    const c = config[plano];
    return (
        <RankBadge tone={c.tone} icon={c.icon}>
            {c.label}
        </RankBadge>
    );
}

/**
 * CTA full-width "Falar no WhatsApp" reutilizado no topo (logo após
 * o header) e no rodapé (após Avaliações). Mantemos a duplicação
 * deliberada — visitante que rolou tudo até o fim já decidiu, e
 * não queremos forçar ele a rolar de volta pra clicar.
 *
 * Ao clicar, dispara um beacon fire-and-forget pra
 * `/api/acompanhantes/[slug]/whatsapp-click` (métrica de conversão,
 * T10) antes de seguir o link. Não bloqueia a navegação — usa
 * `keepalive` pra que o request sobreviva ao unload da página.
 */
function WhatsappCTA({
    href,
    slug,
}: {
    href: string;
    slug: string;
}): React.ReactElement {
    function handleClick(): void {
        try {
            void fetch(
                `/api/acompanhantes/${encodeURIComponent(slug)}/whatsapp-click`,
                {
                    method: "POST",
                    keepalive: true,
                    headers: { "Content-Type": "application/json" },
                    body: "{}",
                },
            ).catch(() => undefined);
        } catch {
            // Métrica não bloqueia o contato.
        }
    }

    return (
        <Button
            href={href}
            variant="primary"
            size="lg"
            className="w-full"
            onClick={handleClick}
        >
            <WhatsappIcon size={16} />
            Falar no WhatsApp
        </Button>
    );
}

/**
 * Tile chunky para forma de pagamento. Ícone grande à esquerda,
 * label compacto à direita. Mais "presente" que um chip pequeno.
 */
function PaymentTile({
    icon,
    label,
}: {
    icon: React.ReactNode;
    label: string;
}): React.ReactElement {
    return (
        <div className="flex items-center gap-2.5 rounded-xl border border-neutral-200 bg-surface px-3 py-2.5">
            <span
                aria-hidden="true"
                className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-[color:var(--accent-soft)] text-[color:var(--accent-deep)]"
            >
                {icon}
            </span>
            <span className="text-sm font-medium text-text-primary">
                {label}
            </span>
        </div>
    );
}

/**
 * Bank de tags com label uppercase em cima e linha de chips em baixo.
 * Usado no bloco "Quem atendo" pra agrupar visualmente público,
 * práticas e idiomas. Mantido local porque é apenas um wrapper de
 * layout específico desta página — promover a primitivo só quando
 * outra tela quiser o mesmo padrão.
 */
function TagBank({
    label,
    children,
}: {
    label: string;
    children: React.ReactNode;
}): React.ReactElement {
    return (
        <div className="flex flex-col gap-2">
            <span className="text-[0.65rem] font-medium uppercase tracking-wider text-text-secondary">
                {label}
            </span>
            <div className="flex flex-wrap gap-1.5">{children}</div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

/**
 * Forma "raw" de um comentário retornado pelo endpoint
 * `GET /api/medias/[id]/comments`. Mantemos local pra não acoplar
 * o tipo do servidor ao tipo do client component primitivo.
 */
type RawComment = {
    id: string;
    text: string;
    createdAt: string | Date;
    isMine: boolean;
    authorNome: string;
    authorIdentificador: string;
    authorFotoUrl: string | null;
};

function toMediaComment(raw: RawComment): MediaComment {
    return {
        id: raw.id,
        text: raw.text,
        timeAgo: formatRelative(raw.createdAt),
        authorName: raw.authorNome,
        authorIdentifier: raw.authorIdentificador,
        authorPhotoUrl: raw.authorFotoUrl,
    };
}

function formatRelative(date: Date | string): string {
    const d = typeof date === "string" ? new Date(date) : date;
    const diff = Date.now() - d.getTime();
    const min = Math.floor(diff / 60_000);
    if (min < 1) return "agora";
    if (min < 60) return `${min}min`;
    const h = Math.floor(min / 60);
    if (h < 24) return `${h}h`;
    const days = Math.floor(h / 24);
    if (days < 7) return `${days}d`;
    const weeks = Math.floor(days / 7);
    if (weeks < 5) return `${weeks}sem`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}m`;
    const years = Math.floor(days / 365);
    return `${years}a`;
}

function formatViews(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
    return String(n);
}

function labelFor(
    options: ReadonlyArray<{ value: string; label: string }>,
    value: string | null | undefined,
): string | undefined {
    if (!value) return undefined;
    return options.find((o) => o.value === value)?.label;
}

function joinCabelo(
    estilo: string | undefined,
    tamanho: string | undefined,
): string {
    const partes = [estilo, tamanho].filter(
        (v): v is string => typeof v === "string" && v.length > 0,
    );
    return partes.length > 0 ? partes.join(", ") : "—";
}


