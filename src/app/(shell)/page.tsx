import type { Metadata } from "next";

import { PageSurface } from "@/components";
import { getCurrentSession } from "@/server/auth/currentSession";
import {
    listarCidadesEmDestaque,
    listarFeedHome,
    listarMidiasAleatoriasParaCollage,
    obterStatsHome,
    type CidadeEmDestaque,
    type FeedHome,
    type HomeStats,
    type MidiaCollageItem,
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
    let cidades: ReadonlyArray<CidadeEmDestaque> = [];
    let midiasCollage: ReadonlyArray<MidiaCollageItem> = [];
    try {
        const [f, s, c, m] = await Promise.all([
            listarFeedHome({ limite: { boost: 30, alta: 20 } }),
            obterStatsHome(),
            listarCidadesEmDestaque({ limit: 10 }),
            listarMidiasAleatoriasParaCollage({ limit: 4 }),
        ]);
        feed = f;
        stats = s;
        cidades = c;
        midiasCollage = m;
    } catch {
        // mantém fallbacks
    }

    return (
        <PageSurface width="lg">
            <WebSiteJsonLd />
            <FaqJsonLd />
            <HomeView
                viewerType={session?.userType ?? null}
                feed={feed}
                stats={stats}
                cidades={cidades}
                midiasCollage={midiasCollage}
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

/**
 * JSON-LD `FAQPage` — habilita rich snippets de FAQ no SERP. Quando
 * o usuário pesquisa termos como "como funciona privello",
 * "privello é seguro", o Google pode mostrar um accordion expansível
 * direto na página de resultados, gerando mais cliques pra home.
 *
 * Mantemos as perguntas/respostas alinhadas ao conteúdo real do site
 * (Sobre, Termos) — Google penaliza FAQ schema com info que não
 * aparece no HTML.
 */
function FaqJsonLd(): React.ReactElement {
    const data = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: [
            {
                "@type": "Question",
                name: "O que é a Privello?",
                acceptedAnswer: {
                    "@type": "Answer",
                    text: "A Privello é uma plataforma brasileira que conecta acompanhantes verificadas a clientes. Os perfis trazem fotos, vídeos, áudio de apresentação e avaliações reais; o contato acontece direto pelo WhatsApp.",
                },
            },
            {
                "@type": "Question",
                name: "Como funciona a verificação de identidade?",
                acceptedAnswer: {
                    "@type": "Answer",
                    text: "Acompanhantes podem enviar documento e selfie pela plataforma. A análise é manual e, quando aprovada, gera o selo Verificada no perfil — sinal de confiança pros clientes. Documentos ficam em armazenamento privado, acessíveis apenas à equipe de moderação.",
                },
            },
            {
                "@type": "Question",
                name: "A Privello é segura?",
                acceptedAnswer: {
                    "@type": "Answer",
                    text: "Sim. Senhas armazenadas com hash forte (Argon2id), sessões assinadas, HTTPS forçado, headers de segurança e proteção contra CSRF em todos os endpoints. Tratamento de dados em conformidade com a LGPD.",
                },
            },
            {
                "@type": "Question",
                name: "Como funciona o pagamento?",
                acceptedAnswer: {
                    "@type": "Answer",
                    text: "Os pagamentos são processados pela Stripe e aceitam cartão e PIX. Não armazenamos dados de cartão. Acompanhantes pagam mensalidade pelo plano Premium e podem comprar Boost de 24h. Clientes têm o plano Fan opcional (24h, 7 dias ou 30 dias) pra desbloquear interações avançadas.",
                },
            },
            {
                "@type": "Question",
                name: "A Privello intermedia o encontro?",
                acceptedAnswer: {
                    "@type": "Answer",
                    text: "Não. A Privello é uma plataforma de exposição. O contato, negociação e encontros acontecem fora da plataforma, geralmente por WhatsApp. Cada parte é responsável pela própria segurança e pelos termos combinados.",
                },
            },
            {
                "@type": "Question",
                name: "Em quais cidades a Privello está disponível?",
                acceptedAnswer: {
                    "@type": "Answer",
                    text: "A Privello atende todo o Brasil. Você pode buscar acompanhantes em São Paulo, Rio de Janeiro, Belo Horizonte, Curitiba, Porto Alegre, Salvador, Recife, Fortaleza, Brasília e em qualquer outra cidade brasileira com perfis ativos.",
                },
            },
        ],
    };
    return (
        <script
            type="application/ld+json"
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
        />
    );
}
