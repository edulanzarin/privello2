import { PageSurface } from "@/components";
import { getCurrentSession } from "@/server/auth/currentSession";
import {
    listarFeedHome,
    obterStatsHome,
    type FeedHome,
    type HomeStats,
} from "@/server/acompanhante-profile/feed";

import { HomeView } from "./_home/HomeView";

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
            listarFeedHome({ limite: { boost: 12, alta: 12 } }),
            obterStatsHome(),
        ]);
        feed = f;
        stats = s;
    } catch {
        // mantém fallbacks
    }

    return (
        <PageSurface width="lg">
            <HomeView
                viewerType={session?.userType ?? null}
                feed={feed}
                stats={stats}
            />
        </PageSurface>
    );
}
