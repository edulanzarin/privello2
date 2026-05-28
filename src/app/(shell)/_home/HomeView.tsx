"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import {
    AudioWavePlayer,
    Badge,
    Button,
    CameraIcon,
    CameraVerifiedIcon,
    CheckIcon,
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

import type { FeedHome, FeedItem, HomeStats } from "@/server/acompanhante-profile/feed";
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
                        <Badge
                            tone="primary"
                            icon={<FlameIcon size={11} />}
                        >
                            Privello 2026
                        </Badge>
                        <h1 className="text-4xl font-bold tracking-tight text-text-primary sm:text-5xl lg:text-6xl lg:leading-[1.05]">
                            Encontros com{" "}
                            <span className="text-primary-700">respeito,</span>
                            <br className="hidden sm:inline" />
                            privacidade e atitude.
                        </h1>
                        <p className="max-w-xl text-base leading-relaxed text-text-secondary sm:text-lg">
                            A plataforma que coloca acompanhantes no centro:
                            perfil completo, agenda transparente e contato
                            direto. Você decide com quem, quando e como.
                        </p>
                    </div>

                    {/* Direita: aside com stats */}
                    <aside className="rounded-3xl border border-border bg-surface p-6 sm:p-8">
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
                                    label: "Em destaque agora",
                                    value: formatNumber(stats.boostsAtivos),
                                },
                                {
                                    label: "Avaliações públicas",
                                    value: formatNumber(stats.avaliacoes),
                                },
                            ]}
                            footer="Conteúdo adulto. Você precisa ter 18 anos ou mais para usar a Privello."
                        />
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
                            Privacidade <span className="text-primary-700">de verdade.</span>
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
                                <CheckIcon size={14} className="text-primary-600" />
                                Marca d&apos;água nas suas mídias.
                            </li>
                            <li className="inline-flex items-center gap-2">
                                <CheckIcon size={14} className="text-primary-600" />
                                Só clientes pagantes podem avaliar e comentar.
                            </li>
                            <li className="inline-flex items-center gap-2">
                                <CheckIcon size={14} className="text-primary-600" />
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
                <section className="overflow-hidden rounded-3xl border border-primary-100 bg-gradient-to-br from-primary-50 via-surface to-secondary-50 p-8 sm:p-12">
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
                <span className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-primary-700">
                    {n}
                </span>
                <span
                    aria-hidden="true"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface text-primary-600"
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
