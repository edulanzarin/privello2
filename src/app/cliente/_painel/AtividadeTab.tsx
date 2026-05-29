"use client";

import * as React from "react";
import Link from "next/link";

import {
    ActivityFeed,
    ActivityFeedItem,
    ChatIcon,
    DiamondIcon,
    EmptyState,
    FilterChips,
    HeartIcon,
    Paginator,
    PlayCircleIcon,
    SparklesIcon,
    UpgradeBanner,
    type FilterChipsOption,
} from "@/components";
import type { PlanoClienteTipo } from "@/domain/plano-cliente/definitions";
import type {
    CommentDoCliente,
    LikeDoCliente,
} from "@/server/media-interactions";
import type { ReviewDoCliente } from "@/server/reviews";

/**
 * Aba "Atividade" do painel do Cliente.
 *
 * Renderiza um feed unificado das interações do Cliente com
 * Acompanhantes:
 *   - **Avaliações**: reviews publicadas, com link pro perfil.
 *   - **Curtidas** (Fan): mídias curtidas, com thumbnail.
 *   - **Comentários** (Fan): texto + perfil dono.
 *
 * Cliente Grátis vê apenas o filtro de avaliações habilitado;
 * Curtidas e Comentários aparecem com cadeado e redirecionam pra
 * `/cliente/selecao-plano`. Quando uma Acompanhante cancela ou
 * desativa, suas interações somem do feed automaticamente
 * (filtros server-side em `listar*DoCliente`).
 */
export interface AtividadeTabProps {
    planoVigente: PlanoClienteTipo | null;
    reviews: ReadonlyArray<ReviewDoCliente>;
    likes: ReadonlyArray<LikeDoCliente>;
    comentarios: ReadonlyArray<CommentDoCliente>;
}

type FiltroAtividade = "tudo" | "avaliacoes" | "curtidas" | "comentarios";

export function AtividadeTab({
    planoVigente,
    reviews,
    likes,
    comentarios,
}: AtividadeTabProps): React.ReactElement {
    const isFan = planoVigente === "FAN";
    const [filtro, setFiltro] = React.useState<FiltroAtividade>("tudo");

    function handleFiltroChange(next: string): void {
        if (
            !isFan &&
            (next === "curtidas" || next === "comentarios")
        ) {
            window.location.href = "/cliente/selecao-plano";
            return;
        }
        setFiltro(next as FiltroAtividade);
    }

    const opcoes: ReadonlyArray<FilterChipsOption> = [
        {
            value: "tudo",
            label: "Tudo",
            icon: <SparklesIcon size={11} />,
        },
        {
            value: "avaliacoes",
            label: "Avaliações",
            icon: <ChatIcon size={11} />,
        },
        {
            value: "curtidas",
            label: "Curtidas",
            icon: <HeartIcon size={11} />,
            locked: !isFan,
        },
        {
            value: "comentarios",
            label: "Comentários",
            icon: <PlayCircleIcon size={11} />,
            locked: !isFan,
        },
    ];

    // Combina os 3 tipos em um feed único ordenado por data.
    type FeedRow =
        | { kind: "review"; date: Date; review: ReviewDoCliente }
        | { kind: "like"; date: Date; like: LikeDoCliente }
        | { kind: "comment"; date: Date; comment: CommentDoCliente };

    const feedRows: ReadonlyArray<FeedRow> = React.useMemo(() => {
        const all: FeedRow[] = [];
        if (filtro === "tudo" || filtro === "avaliacoes") {
            for (const r of reviews) {
                all.push({ kind: "review", date: r.createdAt, review: r });
            }
        }
        if (filtro === "tudo" || filtro === "curtidas") {
            for (const l of likes) {
                all.push({ kind: "like", date: l.createdAt, like: l });
            }
        }
        if (filtro === "tudo" || filtro === "comentarios") {
            for (const c of comentarios) {
                all.push({
                    kind: "comment",
                    date: c.createdAt,
                    comment: c,
                });
            }
        }
        return all.sort((a, b) => b.date.getTime() - a.date.getTime());
    }, [filtro, reviews, likes, comentarios]);

    return (
        <div className="flex flex-col gap-4">
            {!isFan ? (
                <UpgradeBanner
                    icon={<DiamondIcon size={16} />}
                    title="Desbloqueie o Fan"
                    description="Curta fotos e Stories, comente e veja avaliações de outros Clientes."
                    ctaHref="/cliente/selecao-plano"
                    ctaLabel="Virar Fan"
                />
            ) : null}

            <FilterChips
                options={opcoes}
                value={filtro}
                onChange={handleFiltroChange}
                aria-label="Filtrar tipo de atividade"
                layout="fixed"
            />

            {feedRows.length > 0 ? (
                <Paginator
                    items={feedRows}
                    pageSize={10}
                    loadMoreLabel="Carregar mais"
                    showCounter
                    render={(visible) => (
                        <ActivityFeed aria-label="Histórico de atividade">
                            {visible.map((row) => {
                                if (row.kind === "review") {
                                    return (
                                        <ReviewRow
                                            key={`r-${row.review.id}`}
                                            review={row.review}
                                        />
                                    );
                                }
                                if (row.kind === "like") {
                                    return (
                                        <LikeRow
                                            key={`l-${row.like.mediaId}`}
                                            like={row.like}
                                        />
                                    );
                                }
                                return (
                                    <CommentRow
                                        key={`c-${row.comment.id}`}
                                        comment={row.comment}
                                    />
                                );
                            })}
                        </ActivityFeed>
                    )}
                />
            ) : (
                <ActivityFeed aria-label="Histórico de atividade">
                    <EmptyState
                        size="sm"
                        icon={empties[filtro].icon}
                        title={empties[filtro].title}
                        description={empties[filtro].description}
                    />
                </ActivityFeed>
            )}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Linhas do feed
// ---------------------------------------------------------------------------

function ReviewRow({
    review,
}: {
    review: ReviewDoCliente;
}): React.ReactElement {
    const href = `/acompanhantes/${review.targetIdentificador}`;
    const subtitle = truncate(review.comment, 90);
    return (
        <Link href={href} className="block focus:outline-none">
            <ActivityFeedItem
                icon={<ChatIcon size={14} />}
                title={
                    <span className="text-text-primary">
                        Você avaliou{" "}
                        <span className="font-semibold">
                            {review.targetNome}
                        </span>
                    </span>
                }
                subtitle={subtitle}
                trailing={
                    <span className="text-xs text-text-secondary">
                        {formatRelative(review.createdAt)}
                    </span>
                }
            />
        </Link>
    );
}

function LikeRow({
    like,
}: {
    like: LikeDoCliente;
}): React.ReactElement {
    const href = `/acompanhantes/${like.targetIdentificador}`;
    return (
        <Link href={href} className="block focus:outline-none">
            <ActivityFeedItem
                icon={<HeartIcon size={14} />}
                title={
                    <span className="text-text-primary">
                        Você curtiu uma{" "}
                        {like.mediaKind === "VIDEO" ? "vídeo" : "foto"} de{" "}
                        <span className="font-semibold">
                            {like.targetNome}
                        </span>
                    </span>
                }
                trailing={
                    <span className="text-xs text-text-secondary">
                        {formatRelative(like.createdAt)}
                    </span>
                }
            />
        </Link>
    );
}

function CommentRow({
    comment,
}: {
    comment: CommentDoCliente;
}): React.ReactElement {
    const href = `/acompanhantes/${comment.targetIdentificador}`;
    return (
        <Link href={href} className="block focus:outline-none">
            <ActivityFeedItem
                icon={<PlayCircleIcon size={14} />}
                title={
                    <span className="text-text-primary">
                        Você comentou em{" "}
                        <span className="font-semibold">
                            {comment.targetNome}
                        </span>
                    </span>
                }
                subtitle={truncate(comment.text, 90)}
                trailing={
                    <span className="text-xs text-text-secondary">
                        {formatRelative(comment.createdAt)}
                    </span>
                }
            />
        </Link>
    );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function truncate(text: string, max: number): string {
    if (text.length <= max) return text;
    return `${text.slice(0, max - 1).trimEnd()}…`;
}

function formatRelative(date: Date | string): string {
    const d = typeof date === "string" ? new Date(date) : date;
    const diff = Date.now() - d.getTime();
    const min = Math.floor(diff / 60_000);
    if (min < 1) return "agora";
    if (min < 60) return `há ${min}min`;
    const h = Math.floor(min / 60);
    if (h < 24) return `há ${h}h`;
    const days = Math.floor(h / 24);
    if (days < 7) return `há ${days}d`;
    const weeks = Math.floor(days / 7);
    if (weeks < 5) return `há ${weeks}sem`;
    const months = Math.floor(days / 30);
    if (months < 12) return `há ${months}m`;
    const years = Math.floor(days / 365);
    return `há ${years}a`;
}

const empties: Record<
    FiltroAtividade,
    { title: string; description: string; icon: React.ReactNode }
> = {
    tudo: {
        title: "Sem atividade por enquanto",
        description:
            "Quando você avaliar, curtir ou comentar, tudo aparece aqui.",
        icon: <SparklesIcon size={20} />,
    },
    avaliacoes: {
        title: "Você ainda não avaliou nenhuma Acompanhante",
        description: "Ao publicar avaliações, elas ficam disponíveis aqui.",
        icon: <ChatIcon size={20} />,
    },
    curtidas: {
        title: "Sem curtidas por enquanto",
        description: "Suas curtidas em fotos e Stories aparecem nesta lista.",
        icon: <HeartIcon size={20} />,
    },
    comentarios: {
        title: "Sem comentários por enquanto",
        description: "Os comentários que você publicar em fotos vêm para cá.",
        icon: <PlayCircleIcon size={20} />,
    },
};
