"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";

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
import { buildAuthUrl } from "@/domain/redirect";

import type {
    PerfilAcompanhantePublico,
    PlanoExibicao,
} from "@/server/acompanhante-profile";
import type { ReviewPublico } from "@/server/reviews";

import { AvaliacoesSection } from "./AvaliacoesSection";

/**
 * "Tipo de viewer" â€” quem estÃ¡ abrindo o perfil. Determina UX:
 *
 * - `"anonimo"`: usuÃ¡rio nÃ£o logado. VÃª tudo, mas nÃ£o pode avaliar.
 * - `"cliente"`: Cliente autenticado. Pode avaliar.
 * - `"acompanhante"`: outra Acompanhante. Pode visitar mas nÃ£o avalia.
 */
export type ViewerKind = "anonimo" | "cliente" | "acompanhante";

/**
 * RenderizaÃ§Ã£o completa do perfil pÃºblico. Aceita o
 * {@link PerfilAcompanhantePublico} (sem PII) e a galeria jÃ¡ mapeada
 * pra `MediaItem`.
 *
 * Visual mais "vitrine" do que "ficha de cadastro":
 *
 * 1. Header com avatar + nome + plano discriminado.
 * 2. Meta-row compacta com localizaÃ§Ã£o e visualizaÃ§Ãµes.
 * 3. CTA grande do WhatsApp.
 * 4. Ãudio (se houver).
 * 5. Bio.
 * 6. Galeria com filtro (Tudo/Fotos/VÃ­deos) e paginaÃ§Ã£o.
 * 7. **Valor da hora**: {@link StatHighlight} hero com gradiente.
 * 8. **Pagamentos**: chips chunky com Ã­cones grandes.
 * 9. **Disponibilidade semanal**: {@link WeekCalendar} visual.
 * 10. **AparÃªncia**: grid de {@link AttributeTile} com Ã­cones autorais
 *     (peso/altura/pÃ©/etnia/olhos/cabelo).
 * 11. **CaracterÃ­sticas**: hashtags sÃ³ pros booleanos `true`.
 * 12. **Quem atendo** + prÃ¡ticas + idiomas em chips.
 *
 * Mobile-first sempre. Sem botÃµes de like/delete (sistemas
 * correspondentes ainda nÃ£o existem).
 */
export interface PerfilPublicoViewProps {
    /** `User.identificador` da Acompanhante (slug). Usado nos calls
     *  de avaliaÃ§Ã£o. */
    slug: string;
    perfil: PerfilAcompanhantePublico;
    galeriaItems: ReadonlyArray<MediaItem>;
    /** AvaliaÃ§Ãµes pÃºblicas mais recentes. */
    reviews: ReadonlyArray<ReviewPublico>;
    /** Tipo de viewer â€” alimenta UI condicional do bloco de
     *  avaliaÃ§Ã£o. */
    viewerKind: ViewerKind;
    /** `true` quando o viewer Ã© a prÃ³pria dona do perfil. */
    viewerIsOwner: boolean;
    /**
     * `true` quando o viewer Ã© Cliente Fan â€” pode curtir e comentar.
     * Cliente GrÃ¡tis e anÃ´nimo veem os botÃµes mas sÃ£o redirecionados
     * pra upgrade ao tentar interagir.
     */
    viewerIsFan: boolean;
    /** Identificador (`@`) do viewer autenticado, ou `null`. */
    viewerNome: string | null;
    /** URL da foto do viewer Cliente, pra avatar no `CommentInput`. */
    viewerFotoUrl: string | null;
    /**
     * AvaliaÃ§Ã£o que o Cliente autenticado jÃ¡ deixou (ou `null`).
     * Usado pra prÃ©-popular o formulÃ¡rio "Sua avaliaÃ§Ã£o".
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
 * Mapa visual dos 7 dias da semana. Mantemos a ordem pt-BR canÃ´nica
 * (SEG â†’ DOM). Os labels longos sÃ£o lidos por screen readers via o
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
    const pathname = usePathname();
    const carousel = useMediaCarousel();
    const [filtroGaleria, setFiltroGaleria] =
        React.useState<FiltroGaleria>("tudo");

    // Estado local da galeria â€” permite atualizaÃ§Ã£o otimista de
    // likes (toggle) e comments (count) sem reload completo. Resync
    // com a prop quando o servidor manda nova galeria via refresh.
    const [galeriaItems, setGaleriaItems] = React.useState<
        ReadonlyArray<MediaItem>
    >(galeriaItemsProp);
    React.useEffect(() => {
        setGaleriaItems(galeriaItemsProp);
    }, [galeriaItemsProp]);

    // ComentÃ¡rios por mÃ­dia. Carregados sob demanda quando o
    // carrossel abre, ou quando o usuÃ¡rio envia/exclui.
    const [commentsByMedia, setCommentsByMedia] = React.useState<
        Record<string, ReadonlyArray<MediaComment>>
    >({});

    /**
     * Carrega comentÃ¡rios da mÃ­dia ativa quando o carrossel abre
     * ou troca de item. Cache simples por id â€” nÃ£o recarrega se
     * jÃ¡ tem. Pula completamente para viewers que nÃ£o podem ver
     * comentÃ¡rios (anÃ´nimo e Cliente GrÃ¡tis).
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
     * Toggle de curtida com atualizaÃ§Ã£o otimista. Cliente GrÃ¡tis e
     * anÃ´nimo sÃ£o redirecionados pra rota apropriada.
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
     * Adiciona comentÃ¡rio com refetch da lista pra ter o item novo
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

    // Apenas atributos "Sim" viram hashtags. Os "NÃ£o"/null somem para
    // nÃ£o poluir. Se nenhum estiver Sim, a seÃ§Ã£o inteira nÃ£o renderiza.
    const characteristics = [
        { active: perfil.temSilicone === true, label: "Silicone" },
        { active: perfil.temTatuagens === true, label: "Tatuagens" },
        { active: perfil.temPiercing === true, label: "Piercing" },
        { active: perfil.fumante === true, label: "Fumante" },
    ].filter((x) => x.active);

    // Galeria filtrada â€” espelha o padrÃ£o do painel privado (MidiasTab).
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
            label: "VÃ­deos",
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

            {/* Meta-row compacta. VisualizaÃ§Ãµes + nota agregada (se
                houver). LocalizaÃ§Ã£o sai daqui â€” jÃ¡ aparece em
                destaque no StatCard "LocalizaÃ§Ã£o" abaixo. */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-text-secondary">
                <span className="inline-flex items-center gap-1.5">
                    <EyeIcon size={12} />
                    <span>
                        <span className="font-medium text-text-primary">
                            {formatViews(perfil.viewsCount)}
                        </span>{" "}
                        visualizaÃ§Ãµes
                    </span>
                </span>
                {perfil.reviewsCount > 0 && viewerKind !== "anonimo" ? (
                    <>
                        <span aria-hidden="true" className="text-text-disabled">
                            Â·
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

            {/* Valores + LocalizaÃ§Ã£o â€” duas StatCards lado a lado em
                desktop, empilhadas em mobile. Ficam logo abaixo do
                CTA do WhatsApp pra serem a primeira "ficha" Ãºtil
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
                    label="LocalizaÃ§Ã£o"
                >
                    <div className="flex flex-col gap-0.5">
                        {perfil.bairroNome ? (
                            <span className="text-xl font-semibold tracking-tight text-text-primary">
                                {perfil.bairroNome}
                            </span>
                        ) : null}
                        <span className="text-sm text-text-primary">
                            {perfil.cidadeNome} Â· {perfil.estadoSigla}
                        </span>
                    </div>
                </StatCard>
            </div>

            {/* Ãudio de apresentaÃ§Ã£o */}
            {perfil.audioUrl !== null ? (
                <section className="flex flex-col gap-2">
                    <SectionHeader title="OuÃ§a minha voz" />
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
                                aria-label="Filtrar tipo de mÃ­dia"
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
                                ? "Sem mÃ­dias publicadas ainda."
                                : "Nenhum item neste filtro."}
                        </p>
                    </Card>
                )}
            </section>

            {/* Formas de pagamento â€” tiles chunky */}
            {formasPagamentoVisuals.length > 0 ? (
                <section className="flex flex-col gap-2">
                    <SectionHeader title="Como vocÃª pode pagar" />
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

            {/* Disponibilidade semanal â€” calendÃ¡rio visual */}
            {perfil.diasAtende.length > 0 ? (
                <section className="flex flex-col gap-2">
                    <SectionHeader title="Disponibilidade" />
                    <Card>
                        <WeekCalendar
                            days={WEEK_DAYS_VIEW}
                            activeValues={perfil.diasAtende}
                        />
                        <p className="mt-3 text-center text-[0.7rem] text-text-secondary">
                            Dias destacados sÃ£o os que atendo.
                        </p>
                    </Card>
                </section>
            ) : null}

            {/* AparÃªncia â€” grid de tiles com Ã­cones grandes */}
            <section className="flex flex-col gap-2">
                <SectionHeader title="AparÃªncia" />
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    <AttributeTile
                        icon={<WeightIcon size={20} />}
                        value={
                            perfil.pesoKg !== null
                                ? `${perfil.pesoKg} kg`
                                : "â€”"
                        }
                        label="Peso"
                    />
                    <AttributeTile
                        icon={<RulerIcon size={20} />}
                        value={
                            perfil.alturaCm !== null
                                ? `${perfil.alturaCm} cm`
                                : "â€”"
                        }
                        label="Altura"
                    />
                    <AttributeTile
                        icon={<FootprintIcon size={20} />}
                        value={
                            perfil.tamanhoPe !== null
                                ? String(perfil.tamanhoPe)
                                : "â€”"
                        }
                        label="PÃ©"
                    />
                    <AttributeTile
                        icon={<GlobeIcon size={20} />}
                        value={labelFor(ETNIAS, perfil.etnia) ?? "â€”"}
                        label="Etnia"
                    />
                    <AttributeTile
                        icon={<EyeIcon size={20} />}
                        value={labelFor(CORES_OLHOS, perfil.corOlhos) ?? "â€”"}
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

            {/* Quem atendo + CaracterÃ­sticas â€” Card Ãºnico com grid
                interno 1col mobile / 2cols desktop pra distribuir as
                TagBanks (Atende, Realiza, CaracterÃ­sticas, Idiomas)
                e evitar o visual "tudo socado na esquerda". Usa
                gap-x-8 generoso entre colunas pra que cada TagBank
                respire. */}
            {(atendeLabels.length > 0 ||
                praticasLabels.length > 0 ||
                idiomasLabels.length > 0 ||
                characteristics.length > 0) ? (
                <section className="flex flex-col gap-2">
                    <SectionHeader title="CaracterÃ­sticas" />
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
                                <TagBank label="CaracterÃ­sticas">
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

            {/* AvaliaÃ§Ãµes */}
            <AvaliacoesSection
                slug={slug}
                reviews={reviews}
                reviewsCount={perfil.reviewsCount}
                reviewsAverage={perfil.reviewsAverage}
                viewerKind={viewerKind}
                viewerIsOwner={viewerIsOwner}
                viewerIsFan={viewerIsFan}
                minhaReview={minhaReview}
            />

            {/* CTA secundÃ¡rio: repete o "Falar no WhatsApp" no fim
                da pÃ¡gina. Quem rolou tudo atÃ© aqui jÃ¡ decidiu â€” nÃ£o
                obrigamos o usuÃ¡rio a rolar pra cima de novo. */}
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
                comments={
                    viewerKind === "cliente" && viewerIsFan
                        ? commentsByMedia
                        : viewerKind === "acompanhante"
                            ? commentsByMedia
                            : undefined
                }
                onToggleLike={handleToggleLike}
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
                            title: "ComentÃ¡rios exclusivos",
                            description:
                                "FaÃ§a login como Cliente Fan pra ver e comentar.",
                            action: (
                                <Button href={buildAuthUrl("/login", pathname)} size="sm">
                                    Entrar
                                </Button>
                            ),
                        }
                        : viewerKind === "cliente" && !viewerIsFan
                            ? {
                                title: "ComentÃ¡rios exclusivos pra Fans",
                                description:
                                    "Vire Fan pra ver e publicar comentÃ¡rios nas fotos.",
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
        </div>
    );
}

// ---------------------------------------------------------------------------
// Subcomponentes locais
// ---------------------------------------------------------------------------

/**
 * Selo de plano discriminado. Boost ganha tom gradient + Ã­cone de
 * chama; Premium tem coroa; BÃ¡sico fica neutro com estrela.
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
            label: "BÃ¡sico",
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
 * CTA full-width "Falar no WhatsApp" reutilizado no topo (logo apÃ³s
 * o header) e no rodapÃ© (apÃ³s AvaliaÃ§Ãµes). Mantemos a duplicaÃ§Ã£o
 * deliberada â€” visitante que rolou tudo atÃ© o fim jÃ¡ decidiu, e
 * nÃ£o queremos forÃ§ar ele a rolar de volta pra clicar.
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
 * Tile chunky para forma de pagamento. Ãcone grande Ã  esquerda,
 * label compacto Ã  direita. Mais "presente" que um chip pequeno.
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
 * Usado no bloco "Quem atendo" pra agrupar visualmente pÃºblico,
 * prÃ¡ticas e idiomas. Mantido local porque Ã© apenas um wrapper de
 * layout especÃ­fico desta pÃ¡gina â€” promover a primitivo sÃ³ quando
 * outra tela quiser o mesmo padrÃ£o.
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
 * Forma "raw" de um comentÃ¡rio retornado pelo endpoint
 * `GET /api/medias/[id]/comments`. Mantemos local pra nÃ£o acoplar
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
    return partes.length > 0 ? partes.join(", ") : "â€”";
}


