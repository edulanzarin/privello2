"use client";

import * as React from "react";

import {
    ChevronLeftIcon,
    ChevronRightIcon,
    TrashIcon,
    XIcon,
} from "../icons";

import { Comment, CommentInput } from "./Comment";
import { EmptyState } from "./EmptyState";
import { formatRelativeTime } from "./formatRelativeTime";
import { IconButton } from "./IconButton";
import { LikeButton } from "./LikeButton";
import { LockedContent } from "./LockedContent";
import { Modal } from "./Modal";
import type { MediaComment, MediaItem } from "./MediaTypes";

/**
 * Props do {@link MediaCarousel}.
 *
 * Modal que exibe uma lista de mídias em carrossel, com curtidas e
 * comentários por item. Pensado pra ser o "viewer único" usado em
 * todo lugar do produto: galeria privada da Acompanhante, galeria
 * pública no `/acompanhantes/[slug]`, Reels (modo único vertical) e
 * qualquer outra superfície futura.
 *
 * Construído sobre o {@link Modal} primitivo (`size="xl"` +
 * `backdropTone="strong"`), herdando trava de scroll, Esc para
 * fechar e backdrop clicável. Adiciona apenas o conteúdo específico:
 * navegação por setas, painel de comentários e toolbar de ações.
 *
 * # Comportamento
 *
 * - Aberto/fechado é controlado por `open` + `onClose`.
 * - O índice ativo é controlado: `activeId` aponta para o item
 *   exibido. Setas (←/→), botões laterais e teclado movem o foco e
 *   disparam `onActiveChange`.
 *
 * # Comentários
 *
 * Os comentários do item ativo vêm em `comments` (mapa por id).
 * `onAddComment(itemId, text)` é chamado quando o usuário envia.
 * Quando ausente, o input fica oculto (modo "leitor").
 *
 * Nenhuma prop carrega nomes de entidades de domínio (Property 29).
 */
export interface MediaCarouselProps {
    /** Lista completa de mídias do carrossel. */
    items: ReadonlyArray<MediaItem>;
    /** ID do item atualmente em foco. */
    activeId: string | null;
    /** Callback ao trocar o item ativo (←/→). */
    onActiveChange: (id: string) => void;
    /** Whether the modal is open. */
    open: boolean;
    /** Callback de fechamento (X, Esc, clique no backdrop). */
    onClose: () => void;
    /**
     * Mapa de comentários por `itemId`. Quando ausente, mostra
     * estado vazio padronizado.
     */
    comments?: Record<string, ReadonlyArray<MediaComment>>;
    /**
     * Callback ao curtir/descurtir. Recebe o `itemId` e o **novo**
     * estado. Quando ausente, o `LikeButton` fica desabilitado.
     */
    onToggleLike?: (itemId: string, liked: boolean) => void;
    /**
     * Callback ao enviar um comentário. Recebe o `itemId` e o texto.
     * Quando ausente, o {@link CommentInput} fica oculto (modo
     * "leitor").
     */
    onAddComment?: (itemId: string, text: string) => void;
    /**
     * Avatar do usuário atual, exibido no `CommentInput`. Quando
     * `onAddComment` está ausente, é ignorado.
     */
    currentUserPhotoUrl?: string | null;
    /** Nome do usuário atual (fallback do Avatar). */
    currentUserName?: string;
    /**
     * Callback opcional para excluir o item ativo. Quando ausente,
     * o botão de excluir não é renderizado. Use no painel da
     * Acompanhante (dona da galeria); omita no perfil público.
     */
    onDelete?: (itemId: string) => void | Promise<void>;
    /**
     * Quando presente, substitui a área de comentários por um
     * gate visual ({@link LockedContent}) — usado pra anônimos
     * que não podem ver comentários, ou pra Cliente Grátis quando
     * o recurso é exclusivo Fan.
     *
     * Quando definido, `comments` e `onAddComment` são ignorados.
     */
    commentsLocked?: {
        title: React.ReactNode;
        description?: React.ReactNode;
        action?: React.ReactNode;
    };
    /**
     * Quando `true`, oculta completamente o bloco de comentários
     * (lista + input + lock). Usado pra Stories, que não tem
     * comentário — só like, descrição e ações.
     *
     * `comments`, `onAddComment` e `commentsLocked` são ignorados.
     * O painel lateral fica enxuto: toolbar (like + ações) +
     * descrição (se houver). Em desktop a aside encolhe naturalmente
     * porque não tem mais lista pra ocupar.
     */
    hideComments?: boolean;
    /**
     * Modo Story. Quando `true`:
     *
     *   - O painel direito (`aside` branca) é completamente
     *     escondido — fica só a mídia centralizada no fundo preto.
     *   - Uma barra de progresso segmentada (uma seção por item)
     *     aparece no topo, animando ao longo de
     *     `storyAutoAdvanceMs` ms.
     *   - Toolbar overlay translúcida sobre a mídia: like (canto
     *     superior esquerdo), tempo relativo + close (canto
     *     superior direito).
     *   - Caption opcional (vinda de `MediaItem.description`)
     *     aparece sobre a base, em texto claro com gradiente.
     *   - Auto-advance: foto passa pra próxima após
     *     `storyAutoAdvanceMs` (padrão: 5000); vídeo avança ao
     *     terminar. No último item, fecha o modal.
     *   - Tap no centro pausa/retoma; tap esquerda volta; tap
     *     direita avança.
     *
     * `hideComments` é tratado como `true` automaticamente nesse
     * modo.
     */
    storyMode?: boolean;
    /**
     * Duração de exibição de fotos no `storyMode`, em ms. Padrão:
     * 5000.
     */
    storyAutoAdvanceMs?: number;
}

/**
 * MediaCarousel — modal de viewer com curtidas e comentários.
 *
 * Layout responsivo:
 * - Desktop: split horizontal (mídia à esquerda, painel de
 *   metadados/comentários à direita, ~40% da largura).
 * - Mobile: stack vertical (mídia em cima ocupando ~60vh, painel de
 *   metadados rolável embaixo).
 */
export function MediaCarousel({
    items,
    activeId,
    onActiveChange,
    open,
    onClose,
    comments,
    onToggleLike,
    onAddComment,
    currentUserPhotoUrl,
    currentUserName,
    onDelete,
    commentsLocked,
    hideComments = false,
    storyMode = false,
    storyAutoAdvanceMs = 5000,
}: MediaCarouselProps): React.ReactElement | null {
    const [draft, setDraft] = React.useState("");
    const storyVideoRef = React.useRef<HTMLVideoElement>(null);
    // Em story mode, comentários sempre escondidos.
    const effectiveHideComments = hideComments || storyMode;

    // Limpa o rascunho ao trocar de item para evitar postar texto
    // pensado para outra mídia.
    React.useEffect(() => {
        setDraft("");
    }, [activeId]);

    // Setas navegam quando o modal está aberto.
    React.useEffect(() => {
        if (!open) return;
        function handleKey(e: KeyboardEvent): void {
            if (e.key === "ArrowLeft") moveBy(-1);
            if (e.key === "ArrowRight") moveBy(+1);
        }
        function moveBy(delta: number): void {
            const idx = items.findIndex((m) => m.id === activeId);
            if (idx < 0) return;
            const next = items[idx + delta];
            if (next !== undefined) onActiveChange(next.id);
        }
        window.addEventListener("keydown", handleKey);
        return () => window.removeEventListener("keydown", handleKey);
    }, [open, activeId, items, onActiveChange]);

    // Auto-advance no story mode. Foto: setTimeout simples de
    // `storyAutoAdvanceMs`; vídeo: avança no `onEnded` via callback
    // direto. Quando passa do último item, fecha o modal.
    React.useEffect(() => {
        if (!storyMode || !open || activeId === null) return;
        const idx = items.findIndex((m) => m.id === activeId);
        if (idx < 0) return;
        const current = items[idx];
        if (!current || current.type === "video") return;

        const timer = window.setTimeout(() => {
            const nextItem = items[idx + 1];
            if (nextItem !== undefined) {
                onActiveChange(nextItem.id);
            } else {
                onClose();
            }
        }, storyAutoAdvanceMs);

        return () => window.clearTimeout(timer);
    }, [
        storyMode,
        open,
        activeId,
        items,
        storyAutoAdvanceMs,
        onActiveChange,
        onClose,
    ]);

    if (!open || activeId === null) {
        // Mantém o Modal montado mesmo sem activeId pra ele cuidar
        // do unmount/cleanup uniformemente.
        return (
            <Modal
                open={false}
                onClose={onClose}
                size="xl"
                backdropTone="strong"
            >
                <span />
            </Modal>
        );
    }

    const activeIndex = items.findIndex((m) => m.id === activeId);
    const active = activeIndex >= 0 ? items[activeIndex] : null;
    if (active === undefined || active === null) return null;

    const hasPrev = activeIndex > 0;
    const hasNext = activeIndex < items.length - 1;

    const itemComments = comments?.[active.id] ?? [];
    const canComment = onAddComment !== undefined;

    if (storyMode) {
        return (
            <Modal
                open={open}
                onClose={onClose}
                size="sm"
                backdropTone="strong"
                showCloseButton={false}
                className="!p-0"
            >
                {/* Story mode — sempre vertical: mídia em cima,
                    bloco branco com info embaixo. Sem aside lateral. */}
                <div className="flex h-full w-full flex-col">
                    {/* Mídia + overlays (progress bar + close + setas). */}
                    <div className="relative flex flex-1 items-center justify-center bg-black">
                        <CarouselMedia
                            item={active}
                            videoRef={
                                active.type === "video"
                                    ? storyVideoRef
                                    : undefined
                            }
                            onVideoEnded={() => {
                                queueMicrotask(() => {
                                    const next = items[activeIndex + 1];
                                    if (next !== undefined) {
                                        onActiveChange(next.id);
                                    } else {
                                        onClose();
                                    }
                                });
                            }}
                            autoPlayVideo
                        />

                        {/* Progress bar segmentada — uma seção
                            por item, animada via CSS animation pra
                            ficar independente do React re-render.
                            Usa `transform: scaleX(0→1)` (mais
                            performático que animar `width`). */}
                        <div className="pointer-events-none absolute left-0 right-0 top-0 z-20 flex gap-1 px-3 pt-3">
                            {items.map((it, i) => {
                                const state =
                                    i < activeIndex
                                        ? "done"
                                        : i === activeIndex
                                            ? "active"
                                            : "pending";
                                return (
                                    <div
                                        key={it.id}
                                        className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/30"
                                    >
                                        <div
                                            // Reset de animação ao
                                            // trocar de item via key
                                            // (forçando re-mount do
                                            // elemento animado).
                                            key={`${activeId}-${i}`}
                                            className="h-full w-full origin-left bg-white"
                                            style={{
                                                transform:
                                                    state === "done"
                                                        ? "scaleX(1)"
                                                        : state === "pending"
                                                            ? "scaleX(0)"
                                                            : undefined,
                                                animation:
                                                    state === "active"
                                                        ? `story-progress-bar ${storyAutoAdvanceMs}ms linear forwards`
                                                        : undefined,
                                            }}
                                        />
                                    </div>
                                );
                            })}
                        </div>

                        {/* Close no canto superior direito. */}
                        <button
                            type="button"
                            onClick={onClose}
                            aria-label="Fechar"
                            className="absolute right-2 top-7 z-20 inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition-colors hover:bg-black/75 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 sm:right-3"
                        >
                            <XIcon size={18} />
                        </button>

                        {/* Setas — visíveis em todos os tamanhos.
                            Em mobile ficam menores e mais grudadas
                            na borda; em desktop maiores. */}
                        {hasPrev ? (
                            <button
                                type="button"
                                onClick={() =>
                                    onActiveChange(items[activeIndex - 1]!.id)
                                }
                                aria-label="Story anterior"
                                className="absolute left-2 top-1/2 inline-flex -translate-y-1/2 items-center justify-center rounded-full bg-black/45 p-1.5 text-white backdrop-blur-sm transition-colors hover:bg-black/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 sm:left-3 sm:p-2"
                            >
                                <ChevronLeftIcon size={18} />
                            </button>
                        ) : null}
                        {hasNext ? (
                            <button
                                type="button"
                                onClick={() =>
                                    onActiveChange(items[activeIndex + 1]!.id)
                                }
                                aria-label="Próximo story"
                                className="absolute right-2 top-1/2 inline-flex -translate-y-1/2 items-center justify-center rounded-full bg-black/45 p-1.5 text-white backdrop-blur-sm transition-colors hover:bg-black/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 sm:right-3 sm:p-2"
                            >
                                <ChevronRightIcon size={18} />
                            </button>
                        ) : null}
                    </div>

                    {/* Bloco branco embaixo: like + delete + tempo +
                        descrição. Mesmo visual da aside da galeria,
                        mas embaixo (mobile e desktop). */}
                    <div className="flex flex-col bg-surface">
                        <div className="flex items-center justify-between gap-3 border-t border-neutral-200 px-4 py-3">
                            <LikeButton
                                liked={Boolean(active.liked)}
                                count={active.likes}
                                disabled={onToggleLike === undefined}
                                onChange={(next) =>
                                    onToggleLike?.(active.id, next)
                                }
                                size="lg"
                            />
                            <div className="flex items-center gap-3">
                                {onDelete !== undefined ? (
                                    <IconButton
                                        icon={<TrashIcon size={16} />}
                                        aria-label="Excluir Story"
                                        tone="danger"
                                        size="sm"
                                        onClick={() =>
                                            void onDelete(active.id)
                                        }
                                    />
                                ) : null}
                                {active.createdAt !== undefined ? (
                                    <span className="text-xs font-medium text-text-disabled">
                                        {formatRelativeTime(active.createdAt)}
                                    </span>
                                ) : null}
                            </div>
                        </div>
                        {active.description ? (
                            <div className="border-t border-neutral-100 px-4 py-3">
                                <p className="whitespace-pre-line break-words text-sm leading-relaxed text-text-primary">
                                    {active.description}
                                </p>
                            </div>
                        ) : null}
                    </div>
                </div>
            </Modal>
        );
    }

    return (
        <Modal
            open={open}
            onClose={onClose}
            size="xl"
            backdropTone="strong"
            showCloseButton={false}
            className="!p-0"
        >
            {/* Container interno com altura fixa — 85% do viewport.
                Garante que o modal não cresce/encolhe com a mídia e
                que a seção de comentários tem scroll interno com
                input fixo no fundo (estilo Instagram). */}
            <div className="flex h-[85dvh] w-full flex-col md:flex-row">
                {/* Mídia — em mobile ocupa no máximo 50% da altura
                    do modal; em desktop ocupa 60% da largura. */}
                <div className="relative flex max-h-[50%] flex-1 items-center justify-center bg-black md:max-h-full md:w-[60%]">
                    <CarouselMedia item={active} />

                    {/* Botão de fechar próprio do carrossel — fica
                        no canto superior direito da mídia, sobre o
                        backdrop preto. Maior e com fundo translúcido
                        para ficar legível em qualquer mídia. Em
                        mobile substitui o X discreto do Modal, que
                        ficava confuso sobre a mídia. */}
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Fechar"
                        className="absolute right-2 top-2 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition-colors hover:bg-black/75 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 sm:right-3 sm:top-3"
                    >
                        <XIcon size={18} />
                    </button>

                    {/* Setas laterais — sempre visíveis em qualquer
                        tamanho de tela. Em mobile ficam menores e
                        mais grudadas na borda. */}
                    {hasPrev ? (
                        <button
                            type="button"
                            onClick={() =>
                                onActiveChange(items[activeIndex - 1]!.id)
                            }
                            aria-label="Mídia anterior"
                            className="absolute left-2 top-1/2 inline-flex -translate-y-1/2 items-center justify-center rounded-full bg-black/45 p-1.5 text-white backdrop-blur-sm transition-colors hover:bg-black/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 sm:left-3 sm:p-2"
                        >
                            <ChevronLeftIcon size={18} />
                        </button>
                    ) : null}
                    {hasNext ? (
                        <button
                            type="button"
                            onClick={() =>
                                onActiveChange(items[activeIndex + 1]!.id)
                            }
                            aria-label="Próxima mídia"
                            className="absolute right-2 top-1/2 inline-flex -translate-y-1/2 items-center justify-center rounded-full bg-black/45 p-1.5 text-white backdrop-blur-sm transition-colors hover:bg-black/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 sm:right-3 sm:p-2"
                        >
                            <ChevronRightIcon size={18} />
                        </button>
                    ) : null}

                    {/* Indicador de posição. */}
                    <span
                        aria-hidden="true"
                        className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/45 px-2 py-0.5 text-[0.65rem] font-medium text-white backdrop-blur-sm"
                    >
                        {activeIndex + 1} / {items.length}
                    </span>
                </div>

                {/* Painel lateral: stats + comentários.
                    `min-h-0` é essencial pra que `flex-1` + 
                    `overflow-y-auto` na lista de comentários
                    funcione — sem ele o flex item não encolhe
                    abaixo do conteúdo intrínseco. */}
                <aside className="flex min-h-0 flex-1 flex-col bg-surface md:w-[40%] md:max-w-md">
                    {/* Toolbar: like grande à esquerda + ações + data à direita */}
                    <div className="flex items-center justify-between gap-3 border-b border-neutral-200 px-4 py-3">
                        <LikeButton
                            liked={Boolean(active.liked)}
                            count={active.likes}
                            disabled={onToggleLike === undefined}
                            onChange={(next) =>
                                onToggleLike?.(active.id, next)
                            }
                            size="lg"
                        />
                        <div className="flex items-center gap-2">
                            {onDelete !== undefined ? (
                                <IconButton
                                    icon={<TrashIcon size={16} />}
                                    aria-label="Excluir mídia"
                                    tone="danger"
                                    size="sm"
                                    onClick={() => void onDelete(active.id)}
                                />
                            ) : null}
                            {active.createdAt !== undefined ? (
                                <span className="text-xs font-medium text-text-disabled">
                                    {formatRelativeTime(active.createdAt)}
                                </span>
                            ) : null}
                        </div>
                    </div>

                    {/* Descrição: bloco próprio com leading folgado e
                        sem truncate. Aceita múltiplas linhas. */}
                    {active.description ? (
                        <div className="border-b border-neutral-200 px-4 py-3">
                            <p className="whitespace-pre-line break-words text-sm leading-relaxed text-text-primary">
                                {active.description}
                            </p>
                        </div>
                    ) : null}

                    {/* Lista de comentários — quando há gate, exibe
                        LockedContent com placeholders fake. O caller
                        (anônimo / Cliente Grátis) não deve ver
                        comentários reais. Pulado quando hideComments. */}
                    {effectiveHideComments ? null : commentsLocked ? (
                        <div className="min-h-0 flex-1 overflow-hidden p-4">
                            <LockedContent
                                blurAmount={8}
                                title={commentsLocked.title}
                                description={commentsLocked.description}
                                action={commentsLocked.action}
                                className="h-full min-h-[260px]"
                            >
                                <div className="flex flex-col gap-4 p-4">
                                    {[1, 2, 3].map((i) => (
                                        <div
                                            key={i}
                                            className="flex items-start gap-3"
                                        >
                                            <div className="h-8 w-8 flex-none rounded-full bg-neutral-200" />
                                            <div className="flex flex-1 flex-col gap-1.5">
                                                <div className="h-3 w-24 rounded bg-neutral-200" />
                                                <div className="h-3 w-full rounded bg-neutral-200" />
                                                <div className="h-3 w-3/4 rounded bg-neutral-200" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </LockedContent>
                        </div>
                    ) : (
                        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
                            {itemComments.length === 0 ? (
                                <EmptyState
                                    size="sm"
                                    title="Nenhum comentário ainda"
                                    description={
                                        canComment
                                            ? "Seja o primeiro a comentar."
                                            : undefined
                                    }
                                />
                            ) : (
                                <ul className="flex flex-col gap-4">
                                    {itemComments.map((c) => (
                                        <li key={c.id}>
                                            <Comment comment={c} />
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    )}

                    {/* Input de comentário (quando habilitado e sem gate) */}
                    {!effectiveHideComments && canComment && !commentsLocked ? (
                        <div className="border-t border-neutral-200 px-4 py-3">
                            <CommentInput
                                value={draft}
                                onChange={setDraft}
                                onSubmit={(text) => {
                                    onAddComment?.(active.id, text);
                                    setDraft("");
                                }}
                                authorPhotoUrl={currentUserPhotoUrl}
                                authorName={currentUserName}
                            />
                        </div>
                    ) : null}
                </aside>
            </div>
        </Modal>
    );
}

/**
 * Renderização da mídia ativa: foto via `<img>` ou vídeo via
 * `<video>` com controles nativos (ou autoplay quando em story
 * mode). Centralizado dentro do container preto sem cortar
 * (object-contain).
 */
function CarouselMedia({
    item,
    videoRef,
    onVideoTimeUpdate,
    onVideoEnded,
    autoPlayVideo = false,
}: {
    item: MediaItem;
    videoRef?: React.RefObject<HTMLVideoElement | null>;
    onVideoTimeUpdate?: (progressPct: number) => void;
    onVideoEnded?: () => void;
    autoPlayVideo?: boolean;
}): React.ReactElement {
    if (item.type === "video") {
        return (
            <video
                ref={videoRef}
                key={item.id}
                src={item.url}
                poster={item.posterUrl ?? undefined}
                controls={!autoPlayVideo}
                autoPlay={autoPlayVideo}
                playsInline
                onTimeUpdate={
                    onVideoTimeUpdate
                        ? (e) => {
                            const v = e.currentTarget;
                            if (v.duration > 0) {
                                onVideoTimeUpdate(
                                    (v.currentTime / v.duration) * 100,
                                );
                            }
                        }
                        : undefined
                }
                onEnded={onVideoEnded}
                className="max-h-full max-w-full object-contain"
                aria-label={item.description ?? "Vídeo"}
            />
        );
    }
    return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
            key={item.id}
            src={item.url}
            alt={item.description ?? ""}
            className="max-h-full max-w-full object-contain"
        />
    );
}

/**
 * Hook helper que controla o estado do carrossel.
 *
 * Encapsula o boilerplate `(open, activeId, openAt, close)` que toda
 * página que usa o carrossel ia ter que reinventar. Use em
 * componentes client que renderizam grades de mídia.
 *
 * @example
 * const carousel = useMediaCarousel();
 * return (
 *   <>
 *     <MediaGrid items={items} onOpen={carousel.openAt} />
 *     <MediaCarousel
 *       items={items}
 *       activeId={carousel.activeId}
 *       onActiveChange={carousel.openAt}
 *       open={carousel.open}
 *       onClose={carousel.close}
 *     />
 *   </>
 * );
 */
export function useMediaCarousel(): {
    open: boolean;
    activeId: string | null;
    openAt: (id: string) => void;
    close: () => void;
} {
    const [activeId, setActiveId] = React.useState<string | null>(null);
    const open = activeId !== null;

    const openAt = React.useCallback((id: string) => {
        setActiveId(id);
    }, []);
    const close = React.useCallback(() => {
        setActiveId(null);
    }, []);

    return { open, activeId, openAt, close };
}
