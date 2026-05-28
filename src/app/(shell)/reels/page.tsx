import type { Metadata } from "next";

import { getCurrentSession } from "@/server/auth/currentSession";
import { obterPerfilCliente } from "@/server/cliente-profile";
import {
    listarFeedReels,
    obterQuotaReels,
    type FeedReelItem,
} from "@/server/storage/reelMedia";

import { ReelsView } from "./_reels/ReelsView";

export const metadata: Metadata = {
    title: "Reels — Privello",
    description:
        "Vídeos curtos de Acompanhantes verificadas. Feed vertical com algoritmo por cidade, popularidade e novidade.",
    robots: { index: false, follow: false },
};

/**
 * `/reels` — feed vertical algorítmico de Reels.
 *
 * Server-side carrega:
 *   - Primeiro lote do feed (10 reels) via `listarFeedReels`.
 *   - Quota do viewer (`obterQuotaReels`) — Cliente Grátis e
 *     anônimos têm limite de 5 visualizações em 24h.
 *
 * Client-side cuida de:
 *   - Scroll vertical com snap.
 *   - Auto-play do reel ativo.
 *   - Like + view via fetch.
 *   - Paywall quando estoura quota.
 *
 * Não recebe filtros server-side — em mobile a barra "Filtros"
 * vai aparecer dentro do viewer (futuro). MVP: feed global.
 */
export default async function ReelsPage() {
    const session = await getCurrentSession();

    let plano: "GRATIS" | "FAN" | null = null;
    if (session?.userType === "CLIENTE") {
        const perfil = await obterPerfilCliente(session.userId);
        plano = perfil?.planoVigente ?? null;
    }

    const [feed, quota] = await Promise.all([
        listarFeedReels({
            viewerUserId: session?.userId ?? null,
            limit: 10,
        }),
        obterQuotaReels(session?.userId ?? null, {
            viewerType: session?.userType ?? null,
            clientePlano: plano,
        }),
    ]);

    return (
        <ReelsView
            initialItems={feed.items.map(toViewerItem)}
            initialNextCursor={feed.nextCursor}
            viewerKind={
                session === null
                    ? "anonimo"
                    : session.userType === "CLIENTE"
                        ? "cliente"
                        : "acompanhante"
            }
            viewerPlano={plano}
            initialQuota={quota}
        />
    );
}

function toViewerItem(reel: FeedReelItem) {
    return {
        id: reel.id,
        videoUrl: `/api/storage/${reel.storageKey}`,
        posterUrl: reel.posterStorageKey
            ? `/api/storage/${reel.posterStorageKey}`
            : null,
        caption: reel.caption,
        likes: reel.likesCount,
        liked: reel.liked,
        owner: {
            identificador: reel.owner.identificador,
            nome: reel.owner.nome,
            fotoUrl: reel.owner.fotoUrl,
            cidadeNome: reel.owner.cidadeNome,
            estadoSigla: reel.owner.estadoSigla,
        },
    };
}
