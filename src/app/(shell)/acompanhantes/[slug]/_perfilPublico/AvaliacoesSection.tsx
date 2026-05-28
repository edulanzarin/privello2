"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";

import {
    Avatar,
    Button,
    Card,
    ChatIcon,
    ChevronRightIcon,
    ConfirmDialog,
    InlineAlert,
    LinkButton,
    LockedContent,
    Modal,
    Paginator,
    RatingDistribution,
    RatingStars,
    SectionHeader,
    SparklesIcon,
    StarIcon,
    useModal,
} from "@/components";
import { buildAuthUrl } from "@/domain/redirect";

import type { ReviewPublico } from "@/server/reviews";
import type { ViewerKind } from "./PerfilPublicoView";

/**
 * Bloco de Avaliações no perfil público.
 *
 * Layout 2026 — moderno e expansível:
 *
 *   1. Header com contador de avaliações + botão "Ver nota geral"
 *      (gated por Fan).
 *   2. **Sua avaliação** (Cliente Fan, não-dono):
 *      - Quando ainda não avaliou: card "Avaliar" com estrelas +
 *        textarea + enviar.
 *      - Quando já avaliou: ReviewCard com sua review + botão
 *        "Trocar avaliação" que abre o form.
 *   3. Lista colapsada por default — botão "Mostrar X avaliações"
 *      expande. Quando expandida, paginada (5 + load more).
 *   4. Cada ReviewCard mostra: rating (estrelas), texto, autor,
 *      data + resposta da Acompanhante (se houver).
 *
 * Acompanhante (owner) vê tudo + pode responder cada avaliação
 * com botão inline "Responder" / "Editar resposta".
 *
 * Cliente Grátis e anônimo veem 1 review como amostra +
 * `LockedContent` borrado pra resto.
 */
export interface AvaliacoesSectionProps {
    slug: string;
    reviews: ReadonlyArray<ReviewPublico>;
    reviewsCount: number;
    viewerKind: ViewerKind;
    viewerIsOwner: boolean;
    viewerIsFan: boolean;
    minhaReview: { comment: string; rating: number | null } | null;
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
    const ratingModal = useModal();

    // ─────────────────────────────────────────────────────────────
    // Locked: anônimo ou Cliente Grátis veem 1 amostra + paywall.
    // ─────────────────────────────────────────────────────────────
    if (isLocked) {
        const previewReview = reviews[0] ?? null;
        const restante = Math.max(0, reviewsCount - (previewReview ? 1 : 0));

        return (
            <section className="flex flex-col gap-3">
                <AvaliacoesHeader
                    reviewsCount={reviewsCount}
                    onAbrirNotaGeral={null}
                />
                {previewReview ? (
                    <ReviewCard review={previewReview} />
                ) : null}
                <PaywallLocked
                    viewerKind={viewerKind}
                    pathname={pathname}
                    restante={restante}
                />
            </section>
        );
    }

    // ─────────────────────────────────────────────────────────────
    // Unlocked: Fan / Acompanhante.
    // ─────────────────────────────────────────────────────────────
    return (
        <section className="flex flex-col gap-3">
            <AvaliacoesHeader
                reviewsCount={reviewsCount}
                onAbrirNotaGeral={
                    reviewsCount > 0 ? ratingModal.open : null
                }
            />

            {/* Modal da nota geral — busca dados via fetch quando abre. */}
            {ratingModal.isOpen ? (
                <NotaGeralModal
                    open={ratingModal.isOpen}
                    onClose={ratingModal.close}
                    slug={slug}
                />
            ) : null}

            {/* Form de avaliação (Cliente Fan, não-dono) */}
            {viewerKind === "cliente" && !viewerIsOwner ? (
                <SuaAvaliacao slug={slug} initial={minhaReview} />
            ) : null}

            {/* Lista colapsada/expandida */}
            <ListaReviews
                reviews={reviews}
                viewerIsOwner={viewerIsOwner}
                slug={slug}
            />
        </section>
    );
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

function AvaliacoesHeader({
    reviewsCount,
    onAbrirNotaGeral,
}: {
    reviewsCount: number;
    onAbrirNotaGeral: (() => void) | null;
}): React.ReactElement {
    return (
        <SectionHeader
            title="Avaliações"
            trailing={
                <div className="flex items-center gap-2">
                    {reviewsCount > 0 ? (
                        <span className="text-xs text-text-secondary">
                            {reviewsCount}{" "}
                            {reviewsCount === 1 ? "avaliação" : "avaliações"}
                        </span>
                    ) : null}
                    {onAbrirNotaGeral ? (
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={onAbrirNotaGeral}
                        >
                            <StarIcon size={12} className="text-warning-500" />
                            Ver nota geral
                        </Button>
                    ) : null}
                </div>
            }
        />
    );
}

// ---------------------------------------------------------------------------
// Modal da nota geral
// ---------------------------------------------------------------------------

interface NotaGeralPayload {
    totalComNota: number;
    media: number | null;
    distribuicao: { 1: number; 2: number; 3: number; 4: number; 5: number };
}

function NotaGeralModal({
    open,
    onClose,
    slug,
}: {
    open: boolean;
    onClose: () => void;
    slug: string;
}): React.ReactElement {
    const [data, setData] = React.useState<NotaGeralPayload | null>(null);
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
        if (!open) return;
        void (async () => {
            try {
                const res = await fetch(
                    `/api/acompanhantes/${encodeURIComponent(slug)}/rating`,
                );
                if (!res.ok) {
                    setError("Não foi possível carregar a nota geral.");
                    return;
                }
                const payload = (await res.json()) as
                    | { ok: true } & NotaGeralPayload
                    | { ok: false };
                if (!payload.ok) {
                    setError("Erro ao carregar.");
                    return;
                }
                setData({
                    totalComNota: payload.totalComNota,
                    media: payload.media,
                    distribuicao: payload.distribuicao,
                });
            } catch {
                setError("Falha de rede.");
            }
        })();
    }, [open, slug]);

    return (
        <Modal open={open} onClose={onClose} title="Nota geral" size="sm">
            <div className="px-5 py-4">
                {error !== null ? (
                    <InlineAlert tone="danger">{error}</InlineAlert>
                ) : data === null ? (
                    <div className="flex items-center justify-center py-8 text-sm text-text-secondary">
                        Carregando…
                    </div>
                ) : data.totalComNota === 0 ? (
                    <div className="flex flex-col items-center gap-2 py-6 text-center">
                        <SparklesIcon
                            size={24}
                            className="text-text-disabled"
                        />
                        <span className="text-sm font-medium text-text-primary">
                            Sem notas ainda
                        </span>
                        <span className="text-xs text-text-secondary">
                            Avaliações com nota numérica aparecem aqui.
                        </span>
                    </div>
                ) : (
                    <RatingDistribution
                        media={data.media}
                        total={data.totalComNota}
                        data={data.distribuicao}
                    />
                )}
            </div>
        </Modal>
    );
}

// ---------------------------------------------------------------------------
// Sua avaliação (Cliente Fan)
// ---------------------------------------------------------------------------

function SuaAvaliacao({
    slug,
    initial,
}: {
    slug: string;
    initial: { comment: string; rating: number | null } | null;
}): React.ReactElement {
    const [editing, setEditing] = React.useState(initial === null);

    // Reseta editing quando initial muda (ex.: usuário enviou nova).
    React.useEffect(() => {
        if (initial !== null && editing) {
            setEditing(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initial?.comment, initial?.rating]);

    if (initial !== null && !editing) {
        // Mostra a review como card + botão de editar.
        return (
            <Card>
                <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold uppercase tracking-wider text-primary-700">
                            Sua avaliação
                        </span>
                        <LinkButton onClick={() => setEditing(true)}>
                            Trocar
                        </LinkButton>
                    </div>
                    {initial.rating !== null ? (
                        <RatingStars
                            value={initial.rating}
                            readOnly
                            size="md"
                        />
                    ) : null}
                    <p className="whitespace-pre-line text-sm leading-relaxed text-text-primary">
                        {initial.comment}
                    </p>
                </div>
            </Card>
        );
    }

    return (
        <ReviewForm
            slug={slug}
            initial={initial}
            onCancel={initial !== null ? () => setEditing(false) : undefined}
        />
    );
}

function ReviewForm({
    slug,
    initial,
    onCancel,
}: {
    slug: string;
    initial: { comment: string; rating: number | null } | null;
    onCancel?: () => void;
}): React.ReactElement {
    const router = useRouter();
    const [comment, setComment] = React.useState(initial?.comment ?? "");
    const [rating, setRating] = React.useState<number | null>(
        initial?.rating ?? null,
    );
    const [submitting, setSubmitting] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const removeDialog = useModal();
    const isEditing = initial !== null;
    const trimmed = comment.trim();
    const canSubmit = trimmed.length > 0 && trimmed.length <= 2000;

    async function submit(): Promise<void> {
        if (submitting || !canSubmit) return;
        setSubmitting(true);
        setError(null);
        try {
            const res = await fetch(
                `/api/acompanhantes/${encodeURIComponent(slug)}/reviews`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ comment: trimmed, rating }),
                },
            );
            if (!res.ok) {
                setError("Não foi possível enviar. Tente novamente.");
                return;
            }
            router.refresh();
        } catch {
            setError("Falha de rede.");
        } finally {
            setSubmitting(false);
        }
    }

    async function remove(): Promise<void> {
        if (submitting) return;
        setSubmitting(true);
        setError(null);
        try {
            const res = await fetch(
                `/api/acompanhantes/${encodeURIComponent(slug)}/reviews`,
                { method: "DELETE" },
            );
            if (!res.ok) {
                setError("Não foi possível remover.");
                return;
            }
            removeDialog.close();
            router.refresh();
        } catch {
            setError("Falha de rede.");
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
                <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-text-primary">
                        {isEditing ? "Editar avaliação" : "Avaliar"}
                    </span>
                    {onCancel ? (
                        <LinkButton onClick={onCancel}>Cancelar</LinkButton>
                    ) : null}
                </div>

                <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-text-secondary">
                        Sua nota (opcional)
                    </span>
                    <RatingStars
                        value={rating}
                        onChange={setRating}
                        size="lg"
                        showLabel
                    />
                </div>

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

                <div className="flex items-center justify-end gap-2">
                    {isEditing ? (
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={removeDialog.open}
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

            <ConfirmDialog
                open={removeDialog.isOpen}
                onClose={removeDialog.close}
                onConfirm={remove}
                title="Remover avaliação"
                description="Sua avaliação será removida. Você pode publicar uma nova depois."
                tone="danger"
                confirmLabel="Remover"
                loading={submitting}
            />
        </Card>
    );
}

// ---------------------------------------------------------------------------
// Lista colapsada/expandida
// ---------------------------------------------------------------------------

function ListaReviews({
    reviews,
    viewerIsOwner,
    slug,
}: {
    reviews: ReadonlyArray<ReviewPublico>;
    viewerIsOwner: boolean;
    slug: string;
}): React.ReactElement {
    const [expanded, setExpanded] = React.useState(false);

    if (reviews.length === 0) {
        return (
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
                        Seja a primeira pessoa a deixar uma.
                    </span>
                </div>
            </Card>
        );
    }

    if (!expanded) {
        return (
            <Button
                type="button"
                variant="ghost"
                size="md"
                onClick={() => setExpanded(true)}
                className="self-start"
            >
                <ChevronRightIcon size={14} />
                Mostrar {reviews.length}{" "}
                {reviews.length === 1 ? "avaliação" : "avaliações"}
            </Button>
        );
    }

    return (
        <div className="flex flex-col gap-3">
            <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setExpanded(false)}
                className="self-start"
            >
                <ChevronRightIcon
                    size={14}
                    className="rotate-90"
                />
                Ocultar
            </Button>
            <Paginator
                items={reviews}
                pageSize={5}
                showCounter={false}
                loadMoreLabel="Ver mais avaliações"
                render={(visible) => (
                    <div className="flex flex-col gap-3">
                        {visible.map((r) => (
                            <ReviewCard
                                key={r.id}
                                review={r}
                                viewerIsOwner={viewerIsOwner}
                                slug={slug}
                            />
                        ))}
                    </div>
                )}
            />
        </div>
    );
}

// ---------------------------------------------------------------------------
// ReviewCard — agora com rating + reply + reply form (owner)
// ---------------------------------------------------------------------------

function ReviewCard({
    review,
    viewerIsOwner = false,
    slug,
}: {
    review: ReviewPublico;
    viewerIsOwner?: boolean;
    slug?: string;
}): React.ReactElement {
    const router = useRouter();
    const [replying, setReplying] = React.useState(false);
    const [replyText, setReplyText] = React.useState(review.replyText ?? "");
    const [submitting, setSubmitting] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    async function submitReply(): Promise<void> {
        const trimmed = replyText.trim();
        if (trimmed.length === 0 || submitting) return;
        setSubmitting(true);
        setError(null);
        try {
            const res = await fetch(
                `/api/reviews/${encodeURIComponent(review.id)}/reply`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ text: trimmed }),
                },
            );
            if (!res.ok) {
                setError("Não foi possível salvar a resposta.");
                return;
            }
            setReplying(false);
            router.refresh();
        } catch {
            setError("Falha de rede.");
        } finally {
            setSubmitting(false);
        }
    }

    async function deleteReply(): Promise<void> {
        if (submitting) return;
        setSubmitting(true);
        setError(null);
        try {
            const res = await fetch(
                `/api/reviews/${encodeURIComponent(review.id)}/reply`,
                { method: "DELETE" },
            );
            if (!res.ok) {
                setError("Não foi possível remover.");
                return;
            }
            setReplyText("");
            setReplying(false);
            router.refresh();
        } catch {
            setError("Falha de rede.");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <Card>
            <div className="flex flex-col gap-3">
                {/* Cabeçalho do autor + rating */}
                <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                        <Avatar
                            src={review.authorFotoUrl}
                            name={review.authorNome}
                            size="sm"
                        />
                        <div className="flex min-w-0 flex-col gap-0.5">
                            <span className="truncate text-sm font-medium text-text-primary">
                                {review.authorNome}
                            </span>
                            <span className="text-xs text-text-secondary">
                                @{review.authorIdentificador} ·{" "}
                                {formatRelative(review.createdAt)}
                            </span>
                        </div>
                    </div>
                    {review.rating !== null ? (
                        <RatingStars
                            value={review.rating}
                            readOnly
                            size="sm"
                            aria-label={`${review.rating} de 5 estrelas`}
                        />
                    ) : null}
                </div>

                {/* Texto da avaliação */}
                <p className="whitespace-pre-line text-sm leading-relaxed text-text-primary">
                    {review.comment}
                </p>

                {/* Resposta da Acompanhante (se houver e não estiver editando) */}
                {review.replyText !== null && !replying ? (
                    <div className="ml-3 rounded-2xl border border-primary-100 bg-primary-50/50 px-3 py-2">
                        <div className="mb-1 flex items-center justify-between gap-2">
                            <span className="inline-flex items-center gap-1 text-[0.65rem] font-semibold uppercase tracking-wider text-primary-700">
                                <SparklesIcon size={11} />
                                Resposta
                            </span>
                            {viewerIsOwner && slug ? (
                                <div className="flex items-center gap-2">
                                    <LinkButton
                                        onClick={() => setReplying(true)}
                                        disabled={submitting}
                                    >
                                        Editar
                                    </LinkButton>
                                    <LinkButton
                                        onClick={deleteReply}
                                        tone="danger"
                                        disabled={submitting}
                                    >
                                        Remover
                                    </LinkButton>
                                </div>
                            ) : null}
                        </div>
                        <p className="whitespace-pre-line text-sm leading-relaxed text-text-primary">
                            {review.replyText}
                        </p>
                    </div>
                ) : null}

                {/* Botão "Responder" (owner sem resposta ainda) */}
                {viewerIsOwner &&
                review.replyText === null &&
                !replying ? (
                    <LinkButton
                        onClick={() => setReplying(true)}
                        icon={<ChatIcon size={11} />}
                    >
                        Responder
                    </LinkButton>
                ) : null}

                {/* Form de resposta (owner editando) */}
                {viewerIsOwner && replying ? (
                    <div className="ml-3 flex flex-col gap-2">
                        <textarea
                            rows={3}
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            maxLength={2000}
                            placeholder="Sua resposta…"
                            autoFocus
                            disabled={submitting}
                            className="block w-full resize-none rounded-md border border-neutral-200 bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-disabled shadow-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30 focus-visible:border-primary-400 disabled:cursor-not-allowed disabled:bg-neutral-50"
                        />
                        {error !== null ? (
                            <InlineAlert tone="danger">{error}</InlineAlert>
                        ) : null}
                        <div className="flex items-center justify-end gap-2">
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    setReplying(false);
                                    setReplyText(review.replyText ?? "");
                                }}
                                disabled={submitting}
                            >
                                Cancelar
                            </Button>
                            <Button
                                type="button"
                                variant="primary"
                                size="sm"
                                onClick={() => void submitReply()}
                                loading={submitting}
                                disabled={
                                    submitting ||
                                    replyText.trim().length === 0
                                }
                            >
                                Salvar
                            </Button>
                        </div>
                    </div>
                ) : null}
            </div>
        </Card>
    );
}

// ---------------------------------------------------------------------------
// Paywall
// ---------------------------------------------------------------------------

function PaywallLocked({
    viewerKind,
    pathname,
    restante,
}: {
    viewerKind: ViewerKind;
    pathname: string;
    restante: number;
}): React.ReactElement {
    const description =
        viewerKind === "anonimo"
            ? "Crie sua conta ou entre pra desbloquear todas as avaliações reais."
            : "Vire Fan pra ler tudo o que outros Clientes estão dizendo.";

    const cta =
        viewerKind === "anonimo" ? (
            <div className="flex flex-col gap-1.5 sm:flex-row">
                <Button
                    href={buildAuthUrl("/cadastro", pathname)}
                    size="sm"
                    variant="primary"
                >
                    Criar conta
                </Button>
                <Button
                    href={buildAuthUrl("/login", pathname)}
                    size="sm"
                    variant="ghost"
                >
                    Entrar
                </Button>
            </div>
        ) : (
            <Button
                href={buildAuthUrl("/cliente/selecao-plano", pathname)}
                size="sm"
            >
                Virar Fan
            </Button>
        );

    return (
        <LockedContent
            blurAmount={10}
            title={
                restante > 0
                    ? `+ ${restante} ${restante === 1 ? "avaliação" : "avaliações"} pra ler`
                    : "Avaliações exclusivas para Fans"
            }
            description={description}
            action={cta}
        >
            <FakeAvaliacoesPreview />
        </LockedContent>
    );
}

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
