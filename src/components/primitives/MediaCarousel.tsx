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
}: MediaCarouselProps): React.ReactElement | null {
    const [draft, setDraft] = React.useState("");

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

    return (
        <Modal
            open={open}
            onClose={onClose}
            size="xl"
            backdropTone="strong"
            showCloseButton={false}
            className="!p-0"
        >
            {/* Container interno. Mobile: coluna; desktop: linha. */}
            <div className="flex h-full w-full flex-col md:flex-row">
                {/* Mídia */}
                <div className="relative flex flex-1 items-center justify-center bg-black md:w-[60%]">
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

                {/* Painel lateral: stats + comentários */}
                <aside className="flex flex-col bg-surface md:w-[40%] md:max-w-md">
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

                    {/* Lista de comentários */}
                    <div className="flex-1 overflow-y-auto px-4 py-3">
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

                    {/* Input de comentário (quando habilitado) */}
                    {canComment ? (
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
 * `<video>` com controles nativos. Centralizado dentro do container
 * preto sem cortar (object-contain).
 */
function CarouselMedia({ item }: { item: MediaItem }): React.ReactElement {
    if (item.type === "video") {
        return (
            <video
                key={item.id}
                src={item.url}
                poster={item.posterUrl ?? undefined}
                controls
                playsInline
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
