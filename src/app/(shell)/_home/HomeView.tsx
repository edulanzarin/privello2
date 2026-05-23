"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import {
    Card,
    CityCombobox,
    CrownIcon,
    EmptyState,
    FlameIcon,
    HorizontalSnap,
    MapPinIcon,
    ProfileFeedCard,
    RankBadge,
    SectionHeader,
    SparklesIcon,
    UsersIcon,
    type CityComboboxValue,
} from "@/components";

import type { FeedHome, FeedItem, CidadePopular } from "@/server/acompanhante-profile/feed";
import type { PlanoExibicao } from "@/server/acompanhante-profile";

/**
 * Props do {@link HomeView}.
 *
 * Recebe os 3 buckets do feed e a lista de cidades populares já
 * resolvidos pelo RSC. Mantém-se cliente apenas pra orquestrar o
 * `CityCombobox` (autocomplete fetch-driven) e a navegação ao
 * submeter a busca.
 */
export interface HomeViewProps {
    feed: FeedHome;
    cidades: ReadonlyArray<CidadePopular>;
}

/**
 * HomeView — feed de descoberta da página inicial.
 *
 * Estrutura mobile-first:
 *
 * 1. Hero compacto com headline + barra de busca de cidade.
 * 2. "Em destaque agora" — fileira horizontal com Acompanhantes
 *    com Boost ativo. Esconde se nenhum.
 * 3. Cidades populares — chips clicáveis que filtram a busca.
 * 4. "Premium" — grid 2/3 colunas.
 * 5. "Recém-chegadas" (Básico) — grid 2/3 colunas.
 * 6. Rodapé com fallback se não há nada (banco zerado).
 */
export function HomeView({ feed, cidades }: HomeViewProps): React.ReactElement {
    const router = useRouter();
    const [cityValue, setCityValue] = React.useState<CityComboboxValue>({
        query: "",
        name: "",
        uf: "",
    });

    function navegarBusca(args: {
        cidadeNome?: string;
        estadoSigla?: string;
        textoLivre?: string;
    }): void {
        const params = new URLSearchParams();
        if (args.cidadeNome && args.estadoSigla) {
            params.set("cidade", args.cidadeNome);
            params.set("uf", args.estadoSigla);
        } else if (args.textoLivre && args.textoLivre.length > 0) {
            params.set("q", args.textoLivre);
        }
        const qs = params.toString();
        router.push(`/acompanhantes${qs ? `?${qs}` : ""}`);
    }

    function handleSubmit(value: CityComboboxValue): void {
        if (value.name && value.uf) {
            navegarBusca({
                cidadeNome: value.name,
                estadoSigla: value.uf,
            });
            return;
        }
        navegarBusca({ textoLivre: value.query });
    }

    const totalGeral =
        feed.boost.length + feed.premium.length + feed.basico.length;

    return (
        <div className="flex flex-col gap-8">
            {/* Hero */}
            <section className="flex flex-col gap-4">
                <div className="flex flex-col gap-2 text-center sm:gap-3 sm:text-left">
                    <h1 className="text-3xl font-semibold tracking-tight text-text-primary sm:text-4xl">
                        Encontre quem está perto de você.
                    </h1>
                    <p className="text-sm text-text-secondary sm:text-base">
                        Descubra perfis em destaque agora e explore por cidade.
                    </p>
                </div>
                <CityCombobox
                    value={cityValue}
                    onChange={setCityValue}
                    onSubmit={handleSubmit}
                    placeholder="Buscar por cidade"
                />
            </section>

            {/* Cidades populares */}
            {cidades.length > 0 ? (
                <section className="flex flex-col gap-3">
                    <SectionHeader
                        icon={<MapPinIcon size={16} />}
                        title="Cidades populares"
                        subtitle="Toque pra ver quem está disponível"
                    />
                    <HorizontalSnap aria-label="Cidades populares" gap="sm">
                        {cidades.map((c) => (
                            <button
                                key={`${c.estadoSigla}-${c.cidadeNome}`}
                                type="button"
                                onClick={() =>
                                    navegarBusca({
                                        cidadeNome: c.cidadeNome,
                                        estadoSigla: c.estadoSigla,
                                    })
                                }
                                className="snap-start inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-border bg-surface px-4 py-2 text-sm text-text-primary transition-colors hover:border-primary-300 hover:bg-primary-50"
                            >
                                <MapPinIcon size={14} />
                                <span className="font-medium">
                                    {c.cidadeNome}
                                </span>
                                <span className="text-xs text-text-secondary">
                                    {c.estadoSigla}
                                </span>
                                <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[0.7rem] font-semibold text-text-secondary">
                                    {c.total}
                                </span>
                            </button>
                        ))}
                    </HorizontalSnap>
                </section>
            ) : null}

            {/* Boost — destaque do dia */}
            {feed.boost.length > 0 ? (
                <section className="flex flex-col gap-3">
                    <SectionHeader
                        icon={<FlameIcon size={16} />}
                        title="Em destaque agora"
                        subtitle="Boost ativo nas próximas horas"
                    />
                    <HorizontalSnap aria-label="Em destaque agora" gap="md">
                        {feed.boost.map((item) => (
                            <FeedCardSnap key={item.identificador} item={item} />
                        ))}
                    </HorizontalSnap>
                </section>
            ) : null}

            {/* Premium */}
            {feed.premium.length > 0 ? (
                <section className="flex flex-col gap-3">
                    <SectionHeader
                        icon={<CrownIcon size={16} />}
                        title="Premium"
                        subtitle="Perfis com plano Premium ativo"
                    />
                    <FeedGrid items={feed.premium} />
                </section>
            ) : null}

            {/* Básico */}
            {feed.basico.length > 0 ? (
                <section className="flex flex-col gap-3">
                    <SectionHeader
                        icon={<UsersIcon size={16} />}
                        title="Recém-chegadas"
                        subtitle="Conheça novos perfis na plataforma"
                    />
                    <FeedGrid items={feed.basico} />
                </section>
            ) : null}

            {/* Empty state geral */}
            {totalGeral === 0 ? (
                <Card padding="none">
                    <EmptyState
                        icon={<SparklesIcon size={20} />}
                        title="Ainda não há perfis disponíveis"
                        description="Volte em breve. Estamos preparando tudo pra você descobrir quem está perto."
                    />
                </Card>
            ) : null}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Item do feed renderizado dentro de um {@link HorizontalSnap}.
 * Aplica `snap-start` e largura fixa pra que cards iguais convivam
 * lado a lado.
 */
function FeedCardSnap({ item }: { item: FeedItem }): React.ReactElement {
    return (
        <div className="snap-start w-44 flex-none sm:w-56">
            <ProfileFeedCard
                href={`/acompanhantes/${item.identificador}`}
                name={item.nome}
                identifier={item.identificador}
                photoUrl={item.fotoUrl}
                cityName={item.cidadeNome}
                stateSigla={item.estadoSigla}
                neighborhood={item.bairroNome}
                viewsCount={item.viewsCount}
                rating={item.reviewsAverage}
                badge={renderRankBadge(item.planoExibicao)}
            />
        </div>
    );
}

/**
 * Grid responsivo de cards: 2 colunas no mobile, 3 em sm+, 4 em
 * lg. Mantém o ritmo visual da home sem cards "espremidos".
 */
function FeedGrid({
    items,
}: {
    items: ReadonlyArray<FeedItem>;
}): React.ReactElement {
    return (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
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
                    viewsCount={item.viewsCount}
                    rating={item.reviewsAverage}
                    badge={renderRankBadge(item.planoExibicao)}
                />
            ))}
        </div>
    );
}

/**
 * Mapeia o {@link PlanoExibicao} para o {@link RankBadge} compacto
 * exibido no canto superior direito do card. Boost ganha selo
 * "Boost", Premium ganha "Premium", Básico fica oculto pra reduzir
 * ruído visual em cards menores.
 */
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
