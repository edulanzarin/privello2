"use client";

import * as React from "react";
import Link from "next/link";

import {
    ActivityFeed,
    ActivityFeedItem,
    DiamondIcon,
    EmptyState,
    FilterChips,
    HeartIcon,
    PlayCircleIcon,
    SparklesIcon,
    StarIcon,
    UpgradeBanner,
    type FilterChipsOption,
} from "@/components";
import type { PlanoClienteTipo } from "@/domain/plano-cliente/definitions";
import type { ReviewDoCliente } from "@/server/reviews";

/**
 * Aba "Atividade" do painel do Cliente.
 *
 * 1. Banner de upgrade compacto no topo (apenas para o Grátis).
 * 2. Linha de filtros em pílula — Tudo, Avaliações, Curtidas,
 *    Comentários. Para o Grátis, Curtidas e Comentários aparecem
 *    com cadeado: clicar redireciona para `/cliente/selecao-plano`.
 * 3. {@link ActivityFeed} unificado: avaliações que o Cliente
 *    publicou são listadas com link pro perfil avaliado. Curtidas e
 *    comentários ainda mostram EmptyState (sistemas correspondentes
 *    não existem ainda).
 *
 * # Visibilidade ao histórico
 *
 * Avaliações de Acompanhantes que cancelaram o plano somem do feed
 * automaticamente — o filtro é aplicado server-side em
 * `listarReviewsDoCliente` (Caminho A: filtrar no read).
 */
export interface AtividadeTabProps {
    planoVigente: PlanoClienteTipo | null;
    /** Avaliações já publicadas pelo Cliente. */
    reviews: ReadonlyArray<ReviewDoCliente>;
}

type FiltroAtividade = "tudo" | "avaliacoes" | "curtidas" | "comentarios";

export function AtividadeTab({
    planoVigente,
    reviews,
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
            icon: <StarIcon size={11} />,
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

    // Decide o conteúdo do feed conforme filtro. Avaliações são
    // dados reais; curtidas/comentários ainda não existem.
    const showReviews = filtro === "tudo" || filtro === "avaliacoes";
    const reviewItems = showReviews ? reviews : [];

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

            <ActivityFeed aria-label="Histórico de atividade">
                {reviewItems.length > 0 ? (
                    reviewItems.map((review) => (
                        <ReviewActivityRow key={review.id} review={review} />
                    ))
                ) : (
                    <EmptyState
                        size="sm"
                        icon={empties[filtro].icon}
                        title={empties[filtro].title}
                        description={empties[filtro].description}
                    />
                )}
            </ActivityFeed>
        </div>
    );
}

/**
 * Linha de avaliação no feed. Mostra estrelas + nome do alvo + tempo
 * relativo. Clicar leva ao perfil público da Acompanhante avaliada.
 */
function ReviewActivityRow({
    review,
}: {
    review: ReviewDoCliente;
}): React.ReactElement {
    const href = `/acompanhantes/${review.targetIdentificador}`;
    const subtitle = review.comment
        ? truncate(review.comment, 90)
        : `Nota ${review.rating} de 5`;

    return (
        <Link href={href} className="block focus:outline-none">
            <ActivityFeedItem
                icon={<StarIcon size={14} />}
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
                    <span className="flex items-center gap-2 text-xs text-text-secondary">
                        <span className="inline-flex items-center gap-0.5 text-amber-500">
                            <StarIcon size={11} />
                            <span className="font-medium tabular-nums">
                                {review.rating}
                            </span>
                        </span>
                        <span>·</span>
                        <span>{formatRelative(review.createdAt)}</span>
                    </span>
                }
            />
        </Link>
    );
}

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

/**
 * Mensagens de estado vazio para cada filtro. Centralizar aqui
 * facilita reusar o mesmo `EmptyState` quando o feed real chegar e
 * uma busca/filtro voltar zero resultados.
 */
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
        icon: <StarIcon size={20} />,
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
