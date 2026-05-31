"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import {
    AudioWavePlayer,
    Button,
    CameraIcon,
    CameraVerifiedIcon,
    CheckIcon,
    CityChips,
    CityCombobox,
    CrownIcon,
    DocumentVerifiedIcon,
    FaceVerifiedIcon,
    FeatureTile,
    FlameIcon,
    LockIcon,
    Paginator,
    ProfileFeedCard,
    RankBadge,
    SectionLink,
    SectionTitle,
    SecurityCheckIcon,
    SparklesIcon,
    StarIcon,
    StatList,
    type CityComboboxValue,
} from "@/components";

import { formatarValorHora } from "@/domain/atendimentoComercial";

import type { CidadeEmDestaque, FeedHome, FeedItem, HomeStats, MidiaCollageItem } from "@/server/acompanhante-profile/feed";
import type { PlanoExibicao } from "@/server/acompanhante-profile";

/**
 * Props do {@link HomeView}.
 */
export interface HomeViewProps {
    /** `userType` da sessão atual ou `null` (anônimo). */
    viewerType: "CLIENTE" | "ACOMPANHANTE" | null;
    /** 2 buckets do feed: Boost + Em alta. */
    feed: FeedHome;
    /** Estatísticas globais pro aside do hero. */
    stats: HomeStats;
    /**
     * Cidades em destaque pra renderizar como carrossel horizontal
     * abaixo do hero.
     */
    cidades: ReadonlyArray<CidadeEmDestaque>;
    /**
     * Mídias aleatórias da galeria pra preencher a collage do hero.
     * Decorativo — sem links pra perfis e renderizado com blur
     * pra evitar destaque de conteúdo sensível.
     */
    midiasCollage: ReadonlyArray<MidiaCollageItem>;
}

/**
 * HomeView — landing pública da Privello.
 *
 * Estrutura editorial em seções largas:
 *
 * 1. **Hero**: split 60/40 com headline pesada + sub à esquerda e
 *    {@link StatList} num quadro à direita (4 indicadores +
 *    disclaimer +18). Logo abaixo, barra de busca grande
 *    full-width e CTAs pra anônimos.
 * 2. **Em destaque** (boost ativo) — só renderiza se houver perfis
 *    com Boost. Grid 1/2/3 colunas.
 * 3. **Em alta** — perfis mais visualizados nos últimos 7 dias.
 *    Tem fallback "Novos perfis em breve".
 * 4. **Verificação séria** — 3 steps editoriais ilustrando o
 *    processo (cadastro → publicação → avaliações).
 * 5. **CTA final** — bloco gradiente com 2 botões (anônimos).
 * 6. **Disclaimer** legal curto.
 *
 * Mobile-first sempre — em mobile o hero quebra em coluna única,
 * stats vão pra cima do quadro e a barra de busca ocupa 100%.
 */
export function HomeView({
    viewerType,
    feed,
    stats,
    cidades,
    midiasCollage,
}: HomeViewProps): React.ReactElement {
    const router = useRouter();
    const [cityValue, setCityValue] = React.useState<CityComboboxValue>({
        query: "",
        name: "",
        uf: "",
    });

    function handleSubmit(value: CityComboboxValue): void {
        const params = new URLSearchParams();
        if (value.name && value.uf) {
            params.set("cidade", value.name);
            params.set("uf", value.uf);
            // Persiste pra `/acompanhantes` lembrar entre navegações.
            try {
                window.sessionStorage.setItem(
                    "privello:ultima-cidade",
                    JSON.stringify({ name: value.name, uf: value.uf }),
                );
            } catch {
                // sessionStorage indisponível — segue silencioso.
            }
        } else if (value.query.trim().length > 0) {
            params.set("q", value.query.trim());
        }
        const qs = params.toString();
        router.push(`/acompanhantes${qs ? `?${qs}` : ""}`);
    }

    const isAnonimo = viewerType === null;

    return (
        <div className="flex flex-col gap-16 sm:gap-20">
            {/* ── Hero ───────────────────────────────────────────── */}
            <section className="flex flex-col gap-10">
                <div className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-end lg:gap-16">
                    {/* Esquerda: headline + sub */}
                    <div className="flex flex-col gap-6">
                        <h1 className="text-4xl font-bold tracking-tight text-text-primary sm:text-5xl lg:text-6xl lg:leading-[1.05]">
                            Encontros com{" "}
                            <span className="text-[color:var(--accent-deep)]">respeito,</span>
                            <br className="hidden sm:inline" />
                            privacidade e atitude.
                        </h1>
                        <p className="max-w-xl text-base leading-relaxed text-text-secondary sm:text-lg">
                            A plataforma que coloca acompanhantes no centro:
                            perfil completo, agenda transparente e contato
                            direto. Você decide com quem, quando e como.
                        </p>
                    </div>

                    {/* Direita: collage de perfis em destaque + stats glass */}
                    <aside className="relative">
                        <HeroCollage items={midiasCollage} />
                        <div className="absolute inset-x-3 bottom-3 z-10 sm:inset-x-4 sm:bottom-4">
                            <div className="glass-surface-strong rounded-2xl p-4 sm:p-5">
                                <StatList
                                    items={[
                                        {
                                            label: "Perfis ativos",
                                            value: formatNumber(stats.perfisAtivos),
                                        },
                                        {
                                            label: "Cidades",
                                            value: formatNumber(stats.cidades),
                                        },
                                        {
                                            label: "Em destaque",
                                            value: formatNumber(stats.boostsAtivos),
                                        },
                                        {
                                            label: "Avaliações",
                                            value: formatNumber(stats.avaliacoes),
                                        },
                                    ]}
                                />
                            </div>
                        </div>
                    </aside>
                </div>

                {/* Search full-width */}
                <div className="flex flex-col gap-3">
                    <CityCombobox
                        value={cityValue}
                        onChange={setCityValue}
                        onSubmit={handleSubmit}
                        placeholder="Em qual cidade você está?"
                    />
                </div>

                {isAnonimo ? (
                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                        <Button
                            href="/cadastro/cliente"
                            variant="primary"
                            size="md"
                        >
                            Criar conta grátis
                        </Button>
                        <Button
                            href="/cadastro/acompanhante"
                            variant="ghost"
                            size="md"
                        >
                            Quero anunciar como acompanhante
                        </Button>
                    </div>
                ) : null}
            </section>

            {/* ── Cidades em destaque ────────────────────────────── */}
            {cidades.length > 0 ? (
                <section className="flex flex-col gap-4">
                    <div className="flex items-end justify-between gap-3">
                        <div className="flex flex-col gap-1">
                            <span className="eyebrow">Onde estão</span>
                            <h2 className="text-xl font-semibold tracking-tight text-text-primary sm:text-2xl">
                                Cidades em destaque
                            </h2>
                        </div>
                        <SectionLink href="/acompanhantes">
                            Todas
                        </SectionLink>
                    </div>
                    <CityChips
                        items={cidades.map((c) => ({
                            label: c.cidadeNome,
                            sublabel: c.estadoSigla,
                            href: `/acompanhantes?uf=${encodeURIComponent(
                                c.estadoSigla,
                            )}&cidade=${encodeURIComponent(c.cidadeNome)}`,
                            photoUrl: c.photoUrl,
                            count: c.count,
                        }))}
                    />
                </section>
            ) : null}

            {/* ── Em destaque (Boost) ────────────────────────────── */}
            {feed.boost.length > 0 ? (
                <section className="flex flex-col gap-6 border-t border-border pt-12 sm:pt-16">
                    <SectionTitle
                        title="Em destaque"
                        subtitle="Quem está com Boost ativo agora."
                        chip={
                            <RankBadge
                                tone="hero"
                                icon={<FlameIcon size={10} />}
                            >
                                Boost ativo
                            </RankBadge>
                        }
                        trailing={
                            <SectionLink href="/acompanhantes?boost=1">
                                Ver todos
                            </SectionLink>
                        }
                    />
                    <FeedGrid items={feed.boost} />
                </section>
            ) : null}

            {/* ── Em alta da semana ──────────────────────────────── */}
            <section className="flex flex-col gap-6 border-t border-border pt-12 sm:pt-16">
                <SectionTitle
                    title="Em alta"
                    subtitle="Os perfis mais vistos nos últimos 7 dias."
                    chip={
                        <RankBadge
                            tone="feature"
                            icon={<StarIcon size={10} />}
                        >
                            Da semana
                        </RankBadge>
                    }
                    trailing={
                        <SectionLink href="/acompanhantes?ordenar=popular">
                            Ver todos
                        </SectionLink>
                    }
                />
                {feed.alta.length > 0 ? (
                    <FeedGrid items={feed.alta} />
                ) : (
                    <p className="rounded-3xl border border-dashed border-border bg-surface-muted p-10 text-center text-sm text-text-secondary">
                        Novos perfis em breve. Seja a primeira a se cadastrar
                        na sua cidade.
                    </p>
                )}
            </section>

            {/* ── Por que confiar na Privello ────────────────────── */}
            <section className="border-t border-border pt-12 sm:pt-16">
                <div className="mb-8 flex flex-col items-center gap-3 text-center sm:mb-12">
                    <span className="eyebrow">Plataforma confiável</span>
                    <h2 className="max-w-2xl text-3xl font-bold leading-tight tracking-tight text-text-primary sm:text-4xl">
                        Contrate com mais{" "}
                        <span className="text-[color:var(--accent-deep)]">
                            segurança e praticidade
                        </span>
                    </h2>
                    <p className="max-w-xl text-base leading-relaxed text-text-secondary">
                        Encontre acompanhantes verificadas, com perfil completo
                        e sem complicações.
                    </p>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
                    <FeatureTile
                        icon={<CameraVerifiedIcon size={22} />}
                        title="Mídia 360°"
                        subtitle="Fotos e vídeos atualizados, sem retoque enganoso."
                    />
                    <FeatureTile
                        icon={<DocumentVerifiedIcon size={22} />}
                        title="100% verificadas"
                        subtitle="Documentos conferidos pela nossa equipe."
                    />
                    <FeatureTile
                        icon={<FaceVerifiedIcon size={22} />}
                        title="Verificação facial"
                        subtitle="Selfie + documento batem com o perfil."
                    />
                    <FeatureTile
                        icon={<SecurityCheckIcon size={22} />}
                        title="Privacidade séria"
                        subtitle="Seu telefone fica oculto até você decidir."
                    />
                </div>
            </section>

            {/* ── Verificação séria ──────────────────────────────── */}
            <section className="border-t border-border pt-12 sm:pt-16">
                <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
                    <div className="flex flex-col gap-5">
                        <h2 className="text-3xl font-bold leading-tight tracking-tight text-text-primary sm:text-4xl">
                            Privacidade <span className="text-[color:var(--accent-deep)]">de verdade.</span>
                            <br />
                            Sem rodeios.
                        </h2>
                        <p className="max-w-md text-base leading-relaxed text-text-secondary">
                            Telefone só é exposto quando você quiser falar.
                            Acompanhante mantém controle total do perfil — você
                            decide quem vê, quando vê e o que aparece em
                            destaque.
                        </p>
                        <ul className="flex flex-col gap-2 text-sm text-text-secondary">
                            <li className="inline-flex items-center gap-2">
                                <CheckIcon size={14} className="text-[color:var(--accent-deep)]" />
                                Marca d&apos;água nas suas mídias.
                            </li>
                            <li className="inline-flex items-center gap-2">
                                <CheckIcon size={14} className="text-[color:var(--accent-deep)]" />
                                Só clientes pagantes podem avaliar e comentar.
                            </li>
                            <li className="inline-flex items-center gap-2">
                                <CheckIcon size={14} className="text-[color:var(--accent-deep)]" />
                                Toggle de visibilidade pública a qualquer
                                momento.
                            </li>
                        </ul>
                    </div>

                    <ol className="flex flex-col gap-6">
                        <Step
                            n="01"
                            icon={<CameraIcon size={16} />}
                            title="Cadastro do perfil"
                            desc="Foto, áudio, valores e dias de atendimento. Mídias com marca d'água automática."
                        />
                        <Step
                            n="02"
                            icon={<SparklesIcon size={16} />}
                            title="Publicação imediata"
                            desc="Seu perfil entra na listagem assim que o plano é selecionado. Boost e Premium ganham destaque."
                        />
                        <Step
                            n="03"
                            icon={<LockIcon size={16} />}
                            title="Controle total"
                            desc="Visibilidade, valores, avaliações e comentários — você liga e desliga quando quiser."
                        />
                    </ol>
                </div>
            </section>

            {/* ── CTA final ──────────────────────────────────────── */}
            {isAnonimo ? (
                <section className="overflow-hidden rounded-3xl border border-[#ec7b5b]/15 bg-gradient-to-br from-primary-50 via-surface to-secondary-50 p-8 sm:p-12">
                    <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex flex-col gap-2">
                            <h2 className="text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">
                                Crie seu perfil de graça e comece hoje.
                            </h2>
                            <p className="max-w-xl text-sm text-text-secondary sm:text-base">
                                Cadastro em menos de 1 minuto. Para
                                acompanhantes que querem visibilidade séria e
                                clientes que valorizam discrição.
                            </p>
                        </div>
                        <div className="flex flex-col gap-2 sm:flex-row">
                            <Button
                                href="/cadastro/cliente"
                                variant="primary"
                                size="md"
                            >
                                Sou cliente
                            </Button>
                            <Button
                                href="/cadastro/acompanhante"
                                variant="ghost"
                                size="md"
                            >
                                Sou acompanhante
                            </Button>
                        </div>
                    </div>
                </section>
            ) : null}

            {/* ── Disclaimer ─────────────────────────────────────── */}
            <footer className="border-t border-border pt-6 text-center text-xs text-text-secondary sm:text-left">
                <p>
                    Privello é uma plataforma para maiores de 18 anos. Não
                    intermediamos contratações; cada acompanhante negocia
                    diretamente com o cliente. Conteúdos publicados são de
                    responsabilidade dos respectivos titulares.
                </p>
            </footer>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────
// Helpers locais
// ─────────────────────────────────────────────────────────────────────

/**
 * Grid responsivo de cards — variant `split` em todas as posições.
 * 1 col mobile, 2 col sm, 3 col lg.
 *
 * Em listas curtas (≤ pageSize) renderiza tudo de uma vez. Em listas
 * maiores envolve no `Paginator` que mostra `pageSize` itens
 * inicialmente e revela mais N a cada clique no botão "Mostrar mais".
 */
function FeedGrid({
    items,
    pageSize = 5,
}: {
    items: ReadonlyArray<FeedItem>;
    pageSize?: number;
}): React.ReactElement {
    if (items.length <= pageSize) {
        return <FeedGridLayout items={items} />;
    }
    return (
        <Paginator
            items={items}
            pageSize={pageSize}
            loadMoreLabel={`Mostrar mais ${pageSize}`}
            render={(visible) => <FeedGridLayout items={visible} />}
        />
    );
}

function FeedGridLayout({
    items,
}: {
    items: ReadonlyArray<FeedItem>;
}): React.ReactElement {
    return (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
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
                            ? formatarValorHora(item.valorHoraCents)
                            : undefined
                    }
                    priceCaption="a partir de"
                    mediaCount={item.mediasCount}
                    hasAudio={item.audioUrl !== null}
                    audio={
                        item.audioUrl !== null ? (
                            <AudioWavePlayer
                                src={item.audioUrl}
                                mimeType={item.audioMimeType ?? undefined}
                                variant="mini"
                                stopPropagation
                            />
                        ) : null
                    }
                    badge={renderRankBadge(item.planoExibicao)}
                    verified={item.verificada}
                    active={item.ativaRecentemente}
                />
            ))}
        </div>
    );
}

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
 * Passo numerado para o bloco "Privacidade de verdade".
 * Subcomponente local — visualmente específico desta seção.
 */
function Step({
    n,
    icon,
    title,
    desc,
}: {
    n: string;
    icon: React.ReactNode;
    title: string;
    desc: string;
}): React.ReactElement {
    return (
        <li className="flex gap-4">
            <div className="flex shrink-0 flex-col items-center gap-2">
                <span className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-[color:var(--accent-deep)]">
                    {n}
                </span>
                <span
                    aria-hidden="true"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface text-[color:var(--accent-deep)]"
                >
                    {icon}
                </span>
            </div>
            <div className="flex-1 pt-1">
                <p className="text-base font-semibold text-text-primary">
                    {title}
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-text-secondary">
                    {desc}
                </p>
            </div>
        </li>
    );
}

function formatNumber(n: number): string {
    if (!Number.isFinite(n) || n < 0) return "—";
    return n.toLocaleString("pt-BR");
}

/**
 * HeroCollage — mosaico assimétrico de 4 fotos pra ilustrar o
 * hero. Layout estilo "wall" do Spotify: uma foto grande à esquerda
 * (col-span 2) + 3 fotos menores empilhadas à direita.
 *
 * As fotos são amostras aleatórias da galeria pública, sem links
 * pra perfil — puramente decorativas. Aplica blur leve pra evitar
 * destaque de conteúdo sensível, já que o sample é random.
 *
 * Quando há menos itens, repete o último pra fechar o grid sem
 * buracos. Quando não há item nenhum, cai num gradient warm.
 */
function HeroCollage({
    items,
}: {
    items: ReadonlyArray<MidiaCollageItem>;
}): React.ReactElement {
    // Pad pra 4 itens repetindo o último (ou usando placeholder).
    const padded: ReadonlyArray<MidiaCollageItem | null> = (() => {
        if (items.length === 0) return [null, null, null, null];
        const out: Array<MidiaCollageItem | null> = [];
        for (let i = 0; i < 4; i++) {
            out.push(items[i % items.length] ?? null);
        }
        return out;
    })();

    const [big, t1, t2, b1] = padded;

    return (
        <div
            aria-hidden="true"
            className="relative grid aspect-[4/5] w-full grid-cols-3 grid-rows-3 gap-2 overflow-hidden rounded-3xl"
        >
            {/* Tile grande à esquerda — span 2 col × 3 row */}
            <CollageTile
                item={big}
                className="col-span-2 row-span-3 rounded-3xl"
            />
            {/* 3 tiles menores em coluna direita */}
            <CollageTile item={t1} className="col-start-3 row-start-1 rounded-2xl" />
            <CollageTile item={t2} className="col-start-3 row-start-2 rounded-2xl" />
            <CollageTile item={b1} className="col-start-3 row-start-3 rounded-2xl" />
        </div>
    );
}

/**
 * CollageTile — uma célula da collage. Decorativa, sem link.
 * Aplica blur leve + saturação reduzida + overlay warm pra
 * evitar destaque de conteúdo sensível.
 */
function CollageTile({
    item,
    className,
}: {
    item: MidiaCollageItem | null;
    className?: string;
}): React.ReactElement {
    const composed = [
        "relative overflow-hidden bg-gradient-to-br from-[color:var(--accent-soft)] via-[#ffd1bf] to-[color:var(--accent)]",
        className ?? "",
    ]
        .filter(Boolean)
        .join(" ");

    if (item === null) {
        return (
            <div className={composed}>
                <span
                    aria-hidden="true"
                    className="flex h-full w-full items-center justify-center text-3xl font-bold text-white/85"
                >
                    P
                </span>
            </div>
        );
    }

    return (
        <div className={composed}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src={item.url}
                alt=""
                aria-hidden="true"
                loading="lazy"
                className="h-full w-full object-cover"
                style={{
                    filter: "blur(4px) saturate(1.1)",
                    transform: "scale(1.06)",
                }}
            />
            {/* Overlay warm sutil pra unificar com o resto do hero */}
            <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-[color:var(--accent)]/15 via-transparent to-transparent"
            />
        </div>
    );
}
