import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageSurface, ProfileFeedCard, SectionLink } from "@/components";
import {
    cidadeLandingPath,
    resolverCidadePorSlug,
} from "@/domain/busca/citySlug";
import { buscar } from "@/server/acompanhante-profile/buscar";
import { listarTodasCidadesComPerfis } from "@/server/acompanhante-profile/feed";

export const runtime = "nodejs";
/**
 * ISR — revalida a cada 1h. Landing de cidade é conteúdo de SEO
 * que muda devagar (entra/sai perfil); 1h equilibra frescor e
 * custo.
 */
export const revalidate = 3600;

const SITE_URL =
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

interface RouteParams {
    uf: string;
    cidade: string;
}

/**
 * Pré-gera as landings das cidades com mais perfis. As demais são
 * geradas sob demanda (ISR) no primeiro acesso e cacheadas.
 */
export async function generateStaticParams(): Promise<RouteParams[]> {
    try {
        const cidades = await listarTodasCidadesComPerfis({ limit: 200 });
        return cidades.map((c) => ({
            uf: c.estadoSigla.toLowerCase(),
            cidade: slugFromName(c.cidadeNome),
        }));
    } catch {
        return [];
    }
}

// slugify local (evita import client-only). Mantém em sincronia com
// `domain/busca/citySlug.slugify`.
function slugFromName(value: string): string {
    return value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .replace(/-{2,}/g, "-");
}

async function resolverCidade(
    params: RouteParams,
): Promise<{ cidadeNome: string; estadoSigla: string } | null> {
    try {
        const candidatas = await listarTodasCidadesComPerfis({ limit: 5000 });
        return resolverCidadePorSlug(params.uf, params.cidade, candidatas);
    } catch {
        return null;
    }
}

export async function generateMetadata({
    params,
}: {
    params: Promise<RouteParams>;
}): Promise<Metadata> {
    const p = await params;
    const cidade = await resolverCidade(p);
    if (!cidade) {
        return { title: "Cidade não encontrada", robots: { index: false } };
    }
    const titulo = `Acompanhantes em ${cidade.cidadeNome}, ${cidade.estadoSigla}`;
    const canonical = cidadeLandingPath(cidade.cidadeNome, cidade.estadoSigla);
    return {
        title: titulo,
        description: `Veja acompanhantes verificadas em ${cidade.cidadeNome}, ${cidade.estadoSigla}. Perfis com fotos, vídeos, áudio e avaliações reais. Contato direto pelo WhatsApp.`,
        alternates: { canonical },
        openGraph: {
            title: `${titulo} · Privello`,
            description: `Acompanhantes verificadas em ${cidade.cidadeNome}, ${cidade.estadoSigla}.`,
            url: `${SITE_URL}${canonical}`,
            type: "website",
        },
    };
}

/**
 * Landing page de cidade (`/acompanhantes/cidade/[uf]/[cidade]`).
 *
 * Página estática (ISR) focada em SEO: título H1 forte com a
 * cidade, parágrafo descritivo, grade dos perfis daquela cidade e
 * um CTA pra busca filtrável completa. Diferente da `/acompanhantes`
 * (que é dinâmica e cheia de filtros JS), esta é leve, indexável e
 * linkada no sitemap.
 */
export default async function CidadeLandingPage({
    params,
}: {
    params: Promise<RouteParams>;
}) {
    const p = await params;
    const cidade = await resolverCidade(p);
    if (!cidade) {
        notFound();
    }

    const resultado = await buscar({
        filtros: {
            cidadeNome: cidade.cidadeNome,
            estadoSigla: cidade.estadoSigla,
        },
        ordenar: "relevancia",
        page: 1,
        perPage: 24,
    });

    const totalLabel = resultado.total.toLocaleString("pt-BR");
    const buscaCompletaHref = `/acompanhantes?cidade=${encodeURIComponent(
        cidade.cidadeNome,
    )}&uf=${encodeURIComponent(cidade.estadoSigla)}`;

    return (
        <PageSurface width="lg">
            <CidadeJsonLd
                cidadeNome={cidade.cidadeNome}
                estadoSigla={cidade.estadoSigla}
                total={resultado.total}
            />
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">
                    Acompanhantes em {cidade.cidadeNome}, {cidade.estadoSigla}
                </h1>
                <p className="max-w-2xl text-sm leading-relaxed text-text-secondary">
                    {resultado.total === 0
                        ? `Ainda não há perfis ativos em ${cidade.cidadeNome}. Volte em breve ou explore cidades próximas.`
                        : `${totalLabel} ${
                              resultado.total === 1 ? "perfil" : "perfis"
                          } em ${cidade.cidadeNome}, ${cidade.estadoSigla}. Veja fotos, vídeos, áudio de apresentação e avaliações reais. O contato é direto pelo WhatsApp — a Privello é vitrine, não intermedia o encontro.`}
                </p>
                <div className="pt-1">
                    <SectionLink href={buscaCompletaHref}>
                        Busca completa com filtros
                    </SectionLink>
                </div>
            </div>

            {resultado.items.length > 0 ? (
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {resultado.items.map((item) => (
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
                            mediaCount={item.mediasCount}
                            hasAudio={item.audioUrl !== null}
                            verified={item.verificada}
                            active={item.ativaRecentemente}
                        />
                    ))}
                </div>
            ) : null}
        </PageSurface>
    );
}

/**
 * JSON-LD de página de cidade.
 *
 * - **CollectionPage** com `mainEntity` apontando pra
 *   `LocalBusiness` (a marca atendendo aquela cidade) — sinaliza
 *   pro Google que esta é a "página oficial" da Privello pra
 *   aquela região.
 * - **BreadcrumbList** — habilita breadcrumbs visuais no SERP
 *   (Início › Acompanhantes › São Paulo, SP).
 *
 * Mantemos o nome da `LocalBusiness` parametrizado por cidade pra
 * dar o sinal local sem mentir (não fingimos ter endereço físico).
 */
function CidadeJsonLd({
    cidadeNome,
    estadoSigla,
    total,
}: {
    cidadeNome: string;
    estadoSigla: string;
    total: number;
}): React.ReactElement {
    const url = `${SITE_URL}${cidadeLandingPath(cidadeNome, estadoSigla)}`;

    const collectionPage = {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: `Acompanhantes em ${cidadeNome}, ${estadoSigla} · Privello`,
        url,
        description: `${total} ${
            total === 1 ? "acompanhante" : "acompanhantes"
        } verificadas em ${cidadeNome}, ${estadoSigla}.`,
        inLanguage: "pt-BR",
        isPartOf: {
            "@type": "WebSite",
            name: "Privello",
            url: SITE_URL,
        },
        about: {
            "@type": "LocalBusiness",
            name: `Privello — ${cidadeNome}, ${estadoSigla}`,
            url,
            areaServed: {
                "@type": "City",
                name: cidadeNome,
                containedInPlace: {
                    "@type": "AdministrativeArea",
                    name: estadoSigla,
                    addressCountry: "BR",
                },
            },
        },
    };

    const breadcrumb = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
            {
                "@type": "ListItem",
                position: 1,
                name: "Início",
                item: `${SITE_URL}/`,
            },
            {
                "@type": "ListItem",
                position: 2,
                name: "Acompanhantes",
                item: `${SITE_URL}/acompanhantes`,
            },
            {
                "@type": "ListItem",
                position: 3,
                name: `${cidadeNome}, ${estadoSigla}`,
                item: url,
            },
        ],
    };

    return (
        <>
            <script
                type="application/ld+json"
                // eslint-disable-next-line react/no-danger
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify(collectionPage),
                }}
            />
            <script
                type="application/ld+json"
                // eslint-disable-next-line react/no-danger
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify(breadcrumb),
                }}
            />
        </>
    );
}
