import { PageSurface } from "@/components";
import { getCurrentSession } from "@/server/auth/currentSession";

import { HomeView } from "./_home/HomeView";

/**
 * Home (`/`).
 *
 * Landing pública da Privello: hero descritivo, barra de busca por
 * cidade, atalhos pras rotas principais (acompanhantes/reels/
 * avaliações/conta), bloco de "por que Privello" com selos de
 * confiança e CTA de cadastro pra visitantes anônimos.
 *
 * **Não lista perfis.** A descoberta de perfis acontece em
 * `/acompanhantes` (página de busca filtrada). A home se concentra
 * em apresentar a marca e direcionar tráfego — quem quer ver perfis
 * passa pelo Hero e cai na busca.
 *
 * O `viewerType` da sessão atual é passado pra UI pra adaptar
 * pequenos detalhes (esconde CTAs de cadastro pra logados, troca
 * o atalho "Entrar" por "Minha conta", etc).
 */
export default async function HomePage() {
    const session = await getCurrentSession();

    return (
        <PageSurface width="lg">
            <HomeView viewerType={session?.userType ?? null} />
        </PageSurface>
    );
}
