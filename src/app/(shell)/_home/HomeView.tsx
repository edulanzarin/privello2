"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
    Button,
    CameraIcon,
    CheckIcon,
    ChevronRightIcon,
    CityCombobox,
    CrownIcon,
    FlameIcon,
    LockIcon,
    ProfileFeedCard,
    RankBadge,
    SectionTitle,
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
                        <span className="inline-flex w-max items-center gap-1.5 rounded-full bg-primary-50 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-wider text-primary-700">
                            <FlameIcon size={11} />
                            Privello 2026
                        </span>
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
                    <p className="text-xs text-text-secondary">
                        Digite a cidade e tecle enter pra ver quem está
                        disponível.
                    </p>
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
                            <Link
                                href="/acompanhantes?ordenar=boost"
                                className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-700 transition-colors hover:text-primary-800"
                            >
                                Ver todos
                                <ChevronRightIcon size={14} />
                            </Link>
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
                        <Link
                            href="/acompanhantes?ordenar=alta"
                            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-700 transition-colors hover:text-primary-800"
                        >
                            Ver todos
                            <ChevronRightIcon size={14} />
                        </Link>
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
 */
function FeedGrid({
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
                    rating={item.reviewsAverage}
                    ratingCount={item.reviewsCount}
                    priceLabel={
                        item.valorHoraCents !== null
                            ? formatarValorHora(item.valorHoraCents)
                            : undefined
                    }
                    priceCaption="a partir de"
                    hasAudio={item.temAudio}
                    badge={renderRankBadge(item.planoExibicao)}
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
