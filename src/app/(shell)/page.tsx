import type { Metadata } from "next";

import { PageSurface } from "@/components";
import { getCurrentSession } from "@/server/auth/currentSession";
import {
    listarFeedHome,
    obterStatsHome,
    type FeedHome,
    type HomeStats,
} from "@/server/acompanhante-profile/feed";

import { HomeView } from "./_home/HomeView";

const SITE_URL =
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/**
 * Metadata da home — sobrescreve title/description do root pra
 * focar em busca por "acompanhantes [cidade]" que é o intent
 * principal.
 */
export const metadata: Metadata = {
    title: "Acompanhantes verificadas no Brasil",
    description:
        "Plataforma brasileira de acompanhantes. Perfis com fotos, vídeos, áudio de apresentação e avaliações reais. Encontre acompanhantes em São Paulo, Rio, Belo Horizonte, Curitiba, Porto Alegre e outras cidades.",
    alternates: { canonical: "/" },
    openGraph: {
        title: "Privello — Acompanhantes verificadas no Brasil",
        description:
            "Plataforma brasileira de acompanhantes. Perfis com fotos, vídeos, áudio e avaliações reais.",
        url: SITE_URL,
        type: "website",
    },
};

/**
 * Home (`/`).
 *
 * Landing pública editorial da Privello. Hero split com headline +
 * StatList; barra de busca por cidade ocupando largura total; seções
 * largas separadas por hairlines com "Em destaque" (Boost) e
 * "Em alta" (top 7 dias) — só renderizam quando há perfis. Bloco
 * editorial sobre privacidade + CTA final pra anônimos.
 *
 * Servidor (RSC):
 *   - {@link listarFeedHome}: 2 buckets (boost + alta) com cards
 *     completos (preço, áudio, rating, badge).
 *   - {@link obterStatsHome}: indicadores agregados pro aside.
 *
 * Em caso de falha numa query, caímos pra fallbacks vazios pra a
 * home não derrubar — disclaimer e seções editoriais continuam
 * renderizando.
 */
export const revalidate = 60;

export default async function HomePage() {
    const FALLBACK_FEED: FeedHome = { boost: [], alta: [] };
    const FALLBACK_STATS: HomeStats = {
        perfisAtivos: 0,
        cidades: 0,
        boostsAtivos: 0,
        avaliacoes: 0,
    };

    const session = await getCurrentSession();

    let feed: FeedHome = FALLBACK_FEED;
    let stats: HomeStats = FALLBACK_STATS;
    try {
        const [f, s] = await Promise.all([
            listarFeedHome({ limite: { boost: 30, alta: 30 } }),
            obterStatsHome(),
        ]);
        feed = f;
        stats = s;
    } catch {
        // mantém fallbacks
    }

    return (
        <PageSurface width="lg">
            <WebSiteJsonLd />
            <HomeView
                viewerType={session?.userType ?? null}
                feed={feed}
                stats={stats}
            />
        </PageSurface>
    );
}

/**
 * JSON-LD `WebSite` com `potentialAction` — faz o Google
 * potencialmente exibir uma caixinha de busca direto no SERP
 * apontando pra `/acompanhantes?q=`.
 */
function WebSiteJsonLd(): React.ReactElement {
    const data = {
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: "Privello",
        url: SITE_URL,
        potentialAction: {
            "@type": "SearchAction",
            target: {
                "@type": "EntryPoint",
                urlTemplate: `${SITE_URL}/acompanhantes?q={search_term_string}`,
            },
            "query-input": "required name=search_term_string",
        },
    };
    return (
        <script
            type="application/ld+json"
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
        />
    );
}
