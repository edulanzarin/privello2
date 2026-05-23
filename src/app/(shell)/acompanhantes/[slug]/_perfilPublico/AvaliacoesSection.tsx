"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import {
    Avatar,
    Button,
    Card,
    InlineAlert,
    LockedContent,
    Paginator,
    RatingStars,
    SectionHeader,
    StarIcon,
} from "@/components";

import type { ReviewPublico } from "@/server/reviews";
import type { ViewerKind } from "./PerfilPublicoView";

/**
 * Bloco completo de Avaliações no perfil público.
 *
 * Estrutura:
 *
 *   1. **Resumo**: estrelas grandes + nota média + total. Quando
 *      ainda não há avaliações, exibe estado vazio.
 *   2. **Sua avaliação** (Cliente autenticado, não-dono): formulário
 *      com 5 estrelas clicáveis + textarea + botão Enviar/Atualizar.
 *      Pré-popula com `minhaReview` se já existir.
 *   3. **Avaliações recentes**: lista paginada.
 *
 * Para Acompanhantes e visitantes anônimos o formulário fica
 * substituído por um aviso ("Faça login pra avaliar" / "Acompanhante
 * não avalia"). A própria dona do perfil também não vê o formulário.
 */
export interface AvaliacoesSectionProps {
    slug: string;
    reviews: ReadonlyArray<ReviewPublico>;
    reviewsCount: number;
    reviewsAverage: number;
    viewerKind: ViewerKind;
    viewerIsOwner: boolean;
    minhaReview: { rating: number; comment: string | null } | null;
}

export function AvaliacoesSection({
    slug,
    reviews,
    reviewsCount,
    reviewsAverage,
    viewerKind,
    viewerIsOwner,
    minhaReview,
}: AvaliacoesSectionProps): React.ReactElement {
    // Anônimo: bloqueia tudo (resumo, lista, formulário) com
    // `LockedContent`. O conteúdo blurado é puramente fake — os
    // dados reais não chegam ao payload RSC para anônimos
    // (filtrado server-side em `page.tsx`). Aqui só renderizamos
    // placeholders convincentes.
    if (viewerKind === "anonimo") {
        return (
            <section className="flex flex-col gap-3">
                <SectionHeader title="Avaliações" />
                <LockedContent
                    blurAmount={10}
                    title="Avaliações exclusivas para Clientes"
                    description="Faça login pra ler o que outros Clientes acharam deste perfil."
                    action={
                        <Button href="/login" size="sm">
                            Entrar
                        </Button>
                    }
                >
                    <FakeAvaliacoesPreview />
                </LockedContent>
            </section>
        );
    }

    return (
        <section className="flex flex-col gap-3">
            <SectionHeader
                title="Avaliações"
                trailing={
                    reviewsCount > 0 ? (
                        <span className="text-xs text-text-secondary">
                            {reviewsCount}{" "}
                            {reviewsCount === 1 ? "avaliação" : "avaliações"}
                        </span>
                    ) : null
                }
            />

            {/* Resumo agregado */}
            <Card>
                {reviewsCount > 0 ? (
                    <div className="flex flex-col items-center gap-1.5 text-center">
                        <RatingStars
                            value={reviewsAverage}
                            size="lg"
                        />
                        <span className="text-3xl font-semibold tracking-tight text-text-primary">
                            {reviewsAverage.toFixed(1)}
                        </span>
                        <span className="text-xs text-text-secondary">
                            de {reviewsCount}{" "}
                            {reviewsCount === 1
                                ? "avaliação"
                                : "avaliações"}
                        </span>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-1.5 py-2 text-center">
                        <span
                            aria-hidden="true"
                            className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100 text-text-disabled"
                        >
                            <StarIcon size={20} />
                        </span>
                        <span className="text-sm font-medium text-text-primary">
                            Sem avaliações ainda
                        </span>
                        <span className="text-xs text-text-secondary">
                            Seja o primeiro a avaliar este perfil.
                        </span>
                    </div>
                )}
            </Card>

            {/* Formulário de avaliação (Cliente autenticado, não-dono) */}
            {viewerKind === "cliente" && !viewerIsOwner ? (
                <ReviewForm slug={slug} initial={minhaReview} />
            ) : null}

            {/* Lista de avaliações */}
            {reviews.length > 0 ? (
                <Paginator
                    items={reviews}
                    pageSize={5}
                    showCounter={false}
                    loadMoreLabel="Ver mais avaliações"
                    render={(visible) => (
                        <div className="flex flex-col gap-3">
                            {visible.map((r) => (
                                <ReviewCard key={r.id} review={r} />
                            ))}
                        </div>
                    )}
                />
            ) : null}
        </section>
    );
}

// ---------------------------------------------------------------------------
// ReviewForm
// ---------------------------------------------------------------------------

function ReviewForm({
    slug,
    initial,
}: {
    slug: string;
    initial: { rating: number; comment: string | null } | null;
}): React.ReactElement {
    const router = useRouter();
    const [rating, setRating] = React.useState(initial?.rating ?? 0);
    const [comment, setComment] = React.useState(initial?.comment ?? "");
    const [submitting, setSubmitting] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [success, setSuccess] = React.useState(false);
    const isEditing = initial !== null;

    async function submit(): Promise<void> {
        if (submitting) return;
        if (rating < 1 || rating > 5) {
            setError("Escolha uma nota de 1 a 5 estrelas.");
            return;
        }
        setSubmitting(true);
        setError(null);
        setSuccess(false);
        try {
            const trimmedComment = comment.trim();
            const res = await fetch(
                `/api/acompanhantes/${encodeURIComponent(slug)}/reviews`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        rating,
                        comment:
                            trimmedComment.length > 0
                                ? trimmedComment
                                : null,
                    }),
                },
            );
            if (!res.ok) {
                setError(
                    "Não foi possível enviar a avaliação. Tente novamente.",
                );
                return;
            }
            setSuccess(true);
            router.refresh();
        } catch {
            setError("Falha de rede. Tente novamente.");
        } finally {
            setSubmitting(false);
        }
    }

    async function remove(): Promise<void> {
        if (submitting || !isEditing) return;
        if (
            !window.confirm(
                "Tem certeza que deseja remover sua avaliação?",
            )
        ) {
            return;
        }
        setSubmitting(true);
        setError(null);
        try {
            const res = await fetch(
                `/api/acompanhantes/${encodeURIComponent(slug)}/reviews`,
                { method: "DELETE" },
            );
            if (!res.ok) {
                setError(
                    "Não foi possível remover a avaliação. Tente novamente.",
                );
                return;
            }
            setRating(0);
            setComment("");
            router.refresh();
        } catch {
            setError("Falha de rede. Tente novamente.");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <Card>
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    void submit();
                }}
                className="flex flex-col gap-3"
            >
                <span className="text-sm font-semibold text-text-primary">
                    {isEditing ? "Sua avaliação" : "Avaliar este perfil"}
                </span>

                {/* Star input — 5 botões clicáveis */}
                <div className="flex items-center gap-1.5">
                    <RatingInput value={rating} onChange={setRating} />
                    {rating > 0 ? (
                        <span className="text-sm font-medium text-text-primary">
                            {rating}/5
                        </span>
                    ) : (
                        <span className="text-xs text-text-secondary">
                            Toque para escolher
                        </span>
                    )}
                </div>

                <textarea
                    rows={3}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Comente sua experiência (opcional)."
                    maxLength={2000}
                    disabled={submitting}
                    className="block w-full resize-none rounded-md border border-neutral-200 bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-disabled shadow-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30 focus-visible:border-primary-400 disabled:cursor-not-allowed disabled:bg-neutral-50"
                />

                {error !== null ? (
                    <InlineAlert tone="danger">{error}</InlineAlert>
                ) : null}
                {success ? (
                    <InlineAlert tone="success">
                        Avaliação enviada. Obrigado pelo feedback.
                    </InlineAlert>
                ) : null}

                <div className="flex items-center justify-end gap-2">
                    {isEditing ? (
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => void remove()}
                            disabled={submitting}
                        >
                            Remover
                        </Button>
                    ) : null}
                    <Button
                        type="submit"
                        variant="primary"
                        size="sm"
                        loading={submitting}
                        disabled={submitting || rating < 1}
                    >
                        {isEditing ? "Atualizar" : "Enviar"}
                    </Button>
                </div>
            </form>
        </Card>
    );
}

/**
 * Input de estrelas — 5 botões clicáveis com hover de pré-visualização.
 * Usa o `RatingStars` decorativo internamente para manter a aparência
 * consistente.
 */
function RatingInput({
    value,
    onChange,
}: {
    value: number;
    onChange: (v: number) => void;
}): React.ReactElement {
    const [hover, setHover] = React.useState<number | null>(null);
    const display = hover ?? value;
    return (
        <div
            role="radiogroup"
            aria-label="Sua nota"
            className="inline-flex items-center"
            onMouseLeave={() => setHover(null)}
        >
            {[1, 2, 3, 4, 5].map((n) => (
                <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={value === n}
                    aria-label={`${n} ${n === 1 ? "estrela" : "estrelas"}`}
                    onClick={() => onChange(n)}
                    onMouseEnter={() => setHover(n)}
                    className="cursor-pointer rounded p-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30"
                >
                    <RatingStars value={display >= n ? 1 : 0} max={1} size="lg" />
                </button>
            ))}
        </div>
    );
}

// ---------------------------------------------------------------------------
// ReviewCard
// ---------------------------------------------------------------------------

function ReviewCard({ review }: { review: ReviewPublico }): React.ReactElement {
    return (
        <Card>
            <div className="flex flex-col gap-2">
                <div className="flex items-start gap-3">
                    <Avatar
                        src={review.authorFotoUrl}
                        name={review.authorNome}
                        size="sm"
                    />
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="truncate text-sm font-medium text-text-primary">
                            {review.authorNome}
                        </span>
                        <span className="text-xs text-text-secondary">
                            @{review.authorIdentificador} ·{" "}
                            {formatRelative(review.createdAt)}
                        </span>
                    </div>
                    <RatingStars value={review.rating} size="sm" />
                </div>
                {review.comment ? (
                    <p className="whitespace-pre-line text-sm leading-relaxed text-text-primary">
                        {review.comment}
                    </p>
                ) : null}
            </div>
        </Card>
    );
}

/**
 * Placeholder visual usado dentro do {@link LockedContent} para
 * anônimos. Renderiza um resumo agregado falso + 3 reviews fake
 * com texto curto. Quando o `LockedContent` borra, o que aparece
 * dá a sensação de "tem conteúdo aqui" sem vazar nada real.
 *
 * Mantido local por ser específico desta seção. Se mais de um
 * caller precisar de fake reviews, promove a primitivo.
 */
function FakeAvaliacoesPreview(): React.ReactElement {
    return (
        <div className="flex flex-col gap-3">
            <Card>
                <div className="flex flex-col items-center gap-1.5 text-center">
                    <RatingStars value={4.5} size="lg" />
                    <span className="text-3xl font-semibold tracking-tight text-text-primary">
                        4.5
                    </span>
                    <span className="text-xs text-text-secondary">
                        de muitas avaliações
                    </span>
                </div>
            </Card>
            {[1, 2, 3].map((i) => (
                <Card key={i}>
                    <div className="flex flex-col gap-2">
                        <div className="flex items-start gap-3">
                            <Avatar src={null} name="•••" size="sm" />
                            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                                <span className="truncate text-sm font-medium text-text-primary">
                                    ••••••• ••••
                                </span>
                                <span className="text-xs text-text-secondary">
                                    @•••• · há ••• dias
                                </span>
                            </div>
                            <RatingStars value={4 + (i % 2)} size="sm" />
                        </div>
                        <p className="text-sm leading-relaxed text-text-primary">
                            ••••••• ••• ••••••• •••• ••••••••• ••• •••••• •••••.
                            ••••••• ••• •••• ••••••• •••.
                        </p>
                    </div>
                </Card>
            ))}
        </div>
    );
}

/**
 * Formato relativo simples ("há 2 dias", "há 3 semanas"). Para
 * volumes baixos é suficiente — quando precisarmos de
 * internacionalização, troca por `Intl.RelativeTimeFormat`.
 */
function formatRelative(date: Date | string): string {
    const d = typeof date === "string" ? new Date(date) : date;
    const diffMs = Date.now() - d.getTime();
    const minutes = Math.floor(diffMs / 60_000);
    if (minutes < 1) return "agora";
    if (minutes < 60) return `há ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `há ${hours} ${hours === 1 ? "hora" : "horas"}`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `há ${days} ${days === 1 ? "dia" : "dias"}`;
    const weeks = Math.floor(days / 7);
    if (weeks < 5) return `há ${weeks} ${weeks === 1 ? "semana" : "semanas"}`;
    const months = Math.floor(days / 30);
    if (months < 12) return `há ${months} ${months === 1 ? "mês" : "meses"}`;
    const years = Math.floor(days / 365);
    return `há ${years} ${years === 1 ? "ano" : "anos"}`;
}
