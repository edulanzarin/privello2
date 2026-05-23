"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import {
    AttributeTile,
    AudioWavePlayer,
    Badge,
    BanknoteIcon,
    Button,
    Card,
    CashIcon,
    CreditCardIcon,
    CrownIcon,
    EyeIcon,
    FlameIcon,
    FootprintIcon,
    GlobeIcon,
    IconSegmented,
    ImageIcon,
    MapPinIcon,
    MediaCarousel,
    MediaGrid,
    Paginator,
    PixIcon,
    PlayIcon,
    ProfileHeader,
    RatingStars,
    RulerIcon,
    ScissorsIcon,
    SectionHeader,
    SparklesIcon,
    StarIcon,
    StatCard,
    TagChip,
    WeekCalendar,
    WeightIcon,
    WhatsappIcon,
    useMediaCarousel,
    type BadgeTone,
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

import type {
    PerfilAcompanhantePublico,
    PlanoExibicao,
} from "@/server/acompanhante-profile";
import type { ReviewPublico } from "@/server/reviews";

import { AvaliacoesSection } from "./AvaliacoesSection";

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
    perfil: PerfilAcompanhantePublico;
    galeriaItems: ReadonlyArray<MediaItem>;
    /** Avaliações públicas mais recentes. */
    reviews: ReadonlyArray<ReviewPublico>;
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
     * Avaliação que o Cliente autenticado já deixou (ou `null`).
     * Usado pra pré-popular o formulário "Sua avaliação".
     */
    minhaReview: { rating: number; comment: string | null } | null;
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

type FiltroGaleria = "tudo" | "fotos" | "videos";

export function PerfilPublicoView({
    slug,
    perfil,
    galeriaItems: galeriaItemsProp,
    reviews,
    viewerKind,
    viewerIsOwner,
    viewerIsFan,
    viewerNome,
    viewerFotoUrl,
    minhaReview,
}: PerfilPublicoViewProps): React.ReactElement {
    const router = useRouter();
    const carousel = useMediaCarousel();
    const [filtroGaleria, setFiltroGaleria] =
        React.useState<FiltroGaleria>("tudo");

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
     * já tem.
     */
    React.useEffect(() => {
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
    }, [carousel.open, carousel.activeId, commentsByMedia]);

    /**
     * Toggle de curtida com atualização otimista. Cliente Grátis e
     * anônimo são redirecionados pra rota apropriada.
     */
    function handleToggleLike(itemId: string, liked: boolean): void {
        if (viewerKind === "anonimo") {
            router.push("/login");
            return;
        }
        if (viewerKind === "acompanhante" || !viewerIsFan) {
            router.push("/cliente/selecao-plano");
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
            router.push("/login");
            return;
        }
        if (viewerKind === "acompanhante" || !viewerIsFan) {
            router.push("/cliente/selecao-plano");
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
                badge={<PlanoBadge plano={perfil.planoExibicao} />}
            />

            {/* Meta-row compacta. Visualizações + nota agregada (se
                houver). Localização sai daqui — já aparece em
                destaque no StatCard "Localização" abaixo. */}
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
                {perfil.reviewsCount > 0 ? (
                    <>
                        <span aria-hidden="true" className="text-text-disabled">
                            ·
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                            <RatingStars
                                value={perfil.reviewsAverage}
                                size="sm"
                            />
                            <span>
                                <span className="font-medium text-text-primary">
                                    {perfil.reviewsAverage.toFixed(1)}
                                </span>{" "}
                                ({perfil.reviewsCount})
                            </span>
                        </span>
                    </>
                ) : null}
            </div>

            {/* CTA principal: WhatsApp */}
            {perfil.whatsappUrl !== null ? (
                <WhatsappCTA href={perfil.whatsappUrl} />
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

            {/* Avaliações */}
            <AvaliacoesSection
                slug={slug}
                reviews={reviews}
                reviewsCount={perfil.reviewsCount}
                reviewsAverage={perfil.reviewsAverage}
                viewerKind={viewerKind}
                viewerIsOwner={viewerIsOwner}
                minhaReview={minhaReview}
            />

            {/* CTA secundário: repete o "Falar no WhatsApp" no fim
                da página. Quem rolou tudo até aqui já decidiu — não
                obrigamos o usuário a rolar pra cima de novo. */}
            {perfil.whatsappUrl !== null ? (
                <WhatsappCTA href={perfil.whatsappUrl} />
            ) : null}

            {/* Carrossel modal */}
            <MediaCarousel
                items={galeriaFiltrada}
                activeId={carousel.activeId}
                onActiveChange={carousel.openAt}
                open={carousel.open}
                onClose={carousel.close}
                comments={commentsByMedia}
                onToggleLike={handleToggleLike}
                onAddComment={
                    viewerKind === "cliente" && viewerIsFan
                        ? handleAddComment
                        : undefined
                }
                currentUserPhotoUrl={viewerFotoUrl}
                currentUserName={viewerNome ?? undefined}
            />
        </div>
    );
}

// ---------------------------------------------------------------------------
// Subcomponentes locais
// ---------------------------------------------------------------------------

/**
 * Selo de plano discriminado. Boost ganha tom gradient + ícone de
 * chama; Premium tem coroa; Básico fica neutro com estrela.
 */
function PlanoBadge({
    plano,
}: {
    plano: PlanoExibicao;
}): React.ReactElement {
    const config: Record<
        PlanoExibicao,
        { tone: BadgeTone; icon: React.ReactElement; label: string }
    > = {
        BOOST: {
            tone: "primaryGradient",
            icon: <FlameIcon size={11} />,
            label: "Em destaque",
        },
        PREMIUM: {
            tone: "primary",
            icon: <CrownIcon size={11} />,
            label: "Premium",
        },
        BASICO: {
            tone: "neutral",
            icon: <StarIcon size={11} />,
            label: "Básico",
        },
    };
    const c = config[plano];
    return (
        <Badge tone={c.tone} icon={c.icon}>
            {c.label}
        </Badge>
    );
}

/**
 * CTA full-width "Falar no WhatsApp" reutilizado no topo (logo após
 * o header) e no rodapé (após Avaliações). Mantemos a duplicação
 * deliberada — visitante que rolou tudo até o fim já decidiu, e
 * não queremos forçar ele a rolar de volta pra clicar.
 */
function WhatsappCTA({ href }: { href: string }): React.ReactElement {
    return (
        <Button
            href={href}
            variant="primary"
            size="lg"
            className="w-full"
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
                className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-primary-100 text-primary-700"
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
