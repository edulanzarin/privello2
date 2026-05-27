"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";

import {
    Avatar,
    Button,
    Card,
    ChatIcon,
    InlineAlert,
    LockedContent,
    Paginator,
    SectionHeader,
} from "@/components";
import { buildAuthUrl } from "@/domain/redirect";

import type { ReviewPublico } from "@/server/reviews";
import type { ViewerKind } from "./PerfilPublicoView";

/**
 * Bloco de Avaliações (apenas texto) no perfil público.
 *
 * Diferente da versão antiga, aqui **não há nota numérica**:
 * avaliação é só comentário escrito. Estrutura:
 *
 *   1. Header com contador de avaliações.
 *   2. **Sua avaliação** (Cliente Fan, não-dono): textarea +
 *      botão Enviar/Atualizar/Remover.
 *   3. Lista paginada das avaliações recentes.
 *
 * Cliente Grátis e anônimo veem `LockedContent` com placeholder
 * borrado. Acompanhante (Owner ou outra) e Cliente Fan passam
 * direto.
 */
export interface AvaliacoesSectionProps {
    slug: string;
    reviews: ReadonlyArray<ReviewPublico>;
    reviewsCount: number;
    viewerKind: ViewerKind;
    viewerIsOwner: boolean;
    /** Cliente Fan — só ele pode ver/escrever. */
    viewerIsFan: boolean;
    minhaReview: { comment: string } | null;
}

export function AvaliacoesSection({
    slug,
    reviews,
    reviewsCount,
    viewerKind,
    viewerIsOwner,
    viewerIsFan,
    minhaReview,
}: AvaliacoesSectionProps): React.ReactElement {
    const pathname = usePathname();
    const isLocked =
        viewerKind === "anonimo" ||
        (viewerKind === "cliente" && !viewerIsFan);

    if (isLocked) {
        const baseHref =
            viewerKind === "anonimo" ? "/login" : "/cliente/selecao-plano";
        const ctaHref = buildAuthUrl(baseHref, pathname);
        const ctaLabel =
            viewerKind === "anonimo" ? "Entrar" : "Virar Fan";
        const description =
            viewerKind === "anonimo"
                ? "Faça login pra ler o que outros Clientes acharam deste perfil."
                : "Vire Fan pra ler o que outros Clientes estão dizendo.";

        return (
            <section className="flex flex-col gap-3">
                <SectionHeader title="Avaliações" />
                <LockedContent
                    blurAmount={10}
                    title="Avaliações exclusivas para Fans"
                    description={description}
                    action={
                        <Button href={ctaHref} size="sm">
                            {ctaLabel}
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
                            {reviewsCount === 1
                                ? "avaliação"
                                : "avaliações"}
                        </span>
                    ) : null
                }
            />

            {/* Formulário de avaliação (Cliente Fan, não-dono) */}
            {viewerKind === "cliente" && !viewerIsOwner ? (
                <ReviewForm slug={slug} initial={minhaReview} />
            ) : null}

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
            ) : (
                <Card>
                    <div className="flex flex-col items-center gap-1.5 py-2 text-center">
                        <span
                            aria-hidden="true"
                            className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100 text-text-disabled"
                        >
                            <ChatIcon size={20} />
                        </span>
                        <span className="text-sm font-medium text-text-primary">
                            Sem avaliações ainda
                        </span>
                        <span className="text-xs text-text-secondary">
                            Seja o primeiro a deixar uma.
                        </span>
                    </div>
                </Card>
            )}
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
    initial: { comment: string } | null;
}): React.ReactElement {
    const router = useRouter();
    const [comment, setComment] = React.useState(initial?.comment ?? "");
    const [submitting, setSubmitting] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [success, setSuccess] = React.useState(false);
    const isEditing = initial !== null;
    const trimmed = comment.trim();
    const canSubmit = trimmed.length > 0 && trimmed.length <= 2000;

    async function submit(): Promise<void> {
        if (submitting || !canSubmit) return;
        setSubmitting(true);
        setError(null);
        setSuccess(false);
        try {
            const res = await fetch(
                `/api/acompanhantes/${encodeURIComponent(slug)}/reviews`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ comment: trimmed }),
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
                    {isEditing ? "Sua avaliação" : "Deixar uma avaliação"}
                </span>

                <textarea
                    rows={4}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Conte como foi sua experiência."
                    maxLength={2000}
                    disabled={submitting}
                    className="block w-full resize-none rounded-md border border-neutral-200 bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-disabled shadow-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30 focus-visible:border-primary-400 disabled:cursor-not-allowed disabled:bg-neutral-50"
                />
                <div className="flex items-center justify-between text-[0.7rem] text-text-secondary">
                    <span>
                        {trimmed.length === 0
                            ? "Mínimo 1 caractere."
                            : `${trimmed.length}/2000`}
                    </span>
                </div>

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
                        disabled={submitting || !canSubmit}
                    >
                        {isEditing ? "Atualizar" : "Enviar"}
                    </Button>
                </div>
            </form>
        </Card>
    );
}

// ---------------------------------------------------------------------------
// ReviewCard
// ---------------------------------------------------------------------------

function ReviewCard({
    review,
}: {
    review: ReviewPublico;
}): React.ReactElement {
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
                </div>
                <p className="whitespace-pre-line text-sm leading-relaxed text-text-primary">
                    {review.comment}
                </p>
            </div>
        </Card>
    );
}

/**
 * Placeholder visual usado dentro do {@link LockedContent} para
 * anônimos e Clientes Grátis. Renderiza 3 reviews fake com texto
 * curto. Quando o `LockedContent` borra, o que aparece dá a sensação
 * de "tem conteúdo aqui" sem vazar nada real.
 */
function FakeAvaliacoesPreview(): React.ReactElement {
    return (
        <div className="flex flex-col gap-3">
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
