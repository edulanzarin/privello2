import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { db } from "@/lib/db";
import { getCurrentSession } from "@/server/auth/currentSession";
import { obterPerfilCliente } from "@/server/cliente-profile";
import {
    listarFeedReels,
    obterQuotaReels,
    type FeedReelItem,
} from "@/server/storage/reelMedia";

import { ReelsView } from "../_reels/ReelsView";

interface ReelDeepLinkParams {
    id: string;
}

/**
 * Metadata do deep-link de Reel. Quando o link é compartilhado
 * (WhatsApp, Twitter), o card prévio mostra o owner e a capa
 * do reel.
 */
export async function generateMetadata({
    params,
}: {
    params: Promise<ReelDeepLinkParams>;
}): Promise<Metadata> {
    const { id } = await params;
    const reel = await db.media.findFirst({
        where: { id, role: "REEL", status: "COMMITTED" },
        select: {
            description: true,
            posterStorageKey: true,
            storageKey: true,
            owner: { select: { nome: true, identificador: true } },
        },
    });
    if (!reel) {
        return { title: "Reel não encontrado", robots: { index: false } };
    }
    const siteUrl =
        process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    const image = reel.posterStorageKey
        ? `${siteUrl}/api/storage/${reel.posterStorageKey}`
        : undefined;
    return {
        title: `${reel.owner.nome} no Reels`,
        description: reel.description ?? `Reel de ${reel.owner.nome}.`,
        robots: { index: false, follow: false },
        openGraph: {
            title: `${reel.owner.nome} no Reels · Privello`,
            description: reel.description ?? undefined,
            url: `${siteUrl}/reels/${id}`,
            images: image ? [{ url: image, width: 720, height: 1280 }] : [],
            type: "video.other",
        },
    };
}

/**
 * `/reels/[id]` — abre o feed iniciado num reel específico.
 *
 * Carrega:
 *   1. O reel solicitado (404 se inexistente).
 *   2. Próximos do feed normal (algoritmo).
 *
 * Renderiza o `ReelsView` com o reel-alvo como primeiro item da
 * lista. O scroll vertical leva pro feed normal depois.
 */
export default async function ReelDeepLinkPage({
    params,
}: {
    params: Promise<ReelDeepLinkParams>;
}) {
    const { id } = await params;
    const session = await getCurrentSession();

    let plano: "GRATIS" | "FAN" | null = null;
    if (session?.userType === "CLIENTE") {
        const perfil = await obterPerfilCliente(session.userId);
        plano = perfil?.planoVigente ?? null;
    }

    // Busca o reel-alvo individualmente.
    const target = await db.media.findFirst({
        where: { id, role: "REEL", status: "COMMITTED" },
        select: {
            id: true,
            storageKey: true,
            mimeType: true,
            durationSeconds: true,
            posterStorageKey: true,
            description: true,
            createdAt: true,
            likesCount: true,
            commentsCount: true,
            owner: {
                select: {
                    nome: true,
                    identificador: true,
                    acompanhante: {
                        select: {
                            cidadeNome: true,
                            estadoSigla: true,
                            perfilVisivel: true,
                            planoVigente: true,
                            fotoPerfil: { select: { storageKey: true } },
                        },
                    },
                },
            },
        },
    });

    if (
        !target ||
        !target.owner.acompanhante ||
        !target.owner.acompanhante.perfilVisivel ||
        target.owner.acompanhante.planoVigente === null
    ) {
        notFound();
    }

    // Já curtiu? Já viu? Pra autenticados.
    let liked = false;
    let viewed = false;
    if (session !== null) {
        const [likeRow, viewRow] = await Promise.all([
            db.mediaLike.findUnique({
                where: { mediaId_userId: { mediaId: id, userId: session.userId } },
                select: { mediaId: true },
            }),
            db.reelView.findUnique({
                where: { mediaId_userId: { mediaId: id, userId: session.userId } },
                select: { mediaId: true },
            }),
        ]);
        liked = likeRow !== null;
        viewed = viewRow !== null;
    }

    const targetItem: FeedReelItem = {
        id: target.id,
        storageKey: target.storageKey,
        mimeType: target.mimeType,
        durationSeconds: target.durationSeconds,
        posterStorageKey: target.posterStorageKey,
        caption: target.description,
        createdAt: target.createdAt,
        likesCount: target.likesCount,
        commentsCount: target.commentsCount,
        viewed,
        liked,
        owner: {
            identificador: target.owner.identificador,
            nome: target.owner.nome,
            fotoUrl: target.owner.acompanhante.fotoPerfil
                ? `/api/storage/${target.owner.acompanhante.fotoPerfil.storageKey}`
                : null,
            cidadeNome: target.owner.acompanhante.cidadeNome,
            estadoSigla: target.owner.acompanhante.estadoSigla,
        },
    };

    // Resto do feed (excluindo o target — ele entra como primeiro
    // item na ordem renderizada).
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

    const restoFeed = feed.items.filter((i) => i.id !== id);

    const allItems = [targetItem, ...restoFeed].map((reel) => ({
        id: reel.id,
        videoUrl: `/api/storage/${reel.storageKey}`,
        posterUrl: reel.posterStorageKey
            ? `/api/storage/${reel.posterStorageKey}`
            : null,
        caption: reel.caption,
        likes: reel.likesCount,
        liked: reel.liked,
        comments: reel.commentsCount,
        owner: {
            identificador: reel.owner.identificador,
            nome: reel.owner.nome,
            fotoUrl: reel.owner.fotoUrl,
            cidadeNome: reel.owner.cidadeNome,
            estadoSigla: reel.owner.estadoSigla,
        },
    }));

    return (
        <ReelsView
            initialItems={allItems}
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
