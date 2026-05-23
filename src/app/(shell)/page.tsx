import { PageSurface } from "@/components";
import {
    listarCidadesPopulares,
    listarFeedHome,
} from "@/server/acompanhante-profile/feed";

import { HomeView } from "./_home/HomeView";

/**
 * Home (`/`).
 *
 * Página pública de descoberta da Privello. Exibe um feed editorial
 * com 3 buckets (Boost / Premium / Básico) + atalhos por cidade
 * popular. A barra de busca por cidade fica em destaque no Hero e
 * leva pra `/acompanhantes` filtrada.
 *
 * Servidor (RSC):
 *   - {@link listarFeedHome}: lê os 3 buckets em paralelo já
 *     filtrados por `perfilVisivel` + `planoVigente !== null`.
 *   - {@link listarCidadesPopulares}: top 8 cidades por contagem.
 *
 * O componente cliente {@link HomeView} cuida da interação:
 * autocomplete de cidade, navegação ao buscar, snap horizontal.
 *
 * A navegação (TopBar + BottomNav) vem do
 * {@link import("./layout").default} via `AppShell`.
 */
export default async function HomePage() {
    const [feed, cidades] = await Promise.all([
        listarFeedHome({
            limite: { boost: 12, premium: 12, basico: 12 },
        }),
        listarCidadesPopulares(8),
    ]);

    return (
        <PageSurface width="lg">
            <HomeView feed={feed} cidades={cidades} />
        </PageSurface>
    );
}
