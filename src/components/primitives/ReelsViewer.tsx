"use client";

import * as React from "react";

import { Avatar } from "./Avatar";
import { HeartIcon } from "../icons";
import { LikeButton } from "./LikeButton";
import { LockIcon } from "../icons";
import { MapPinIcon } from "../icons";

/**
 * Item de Reel exibido no viewer vertical.
 *
 * Genérico — sem nomes de entidades de domínio (Property 29).
 * Quem fornece o array só precisa entregar `id`, `videoUrl`,
 * `posterUrl?`, `caption?`, `owner` e contadores.
 */
export interface ReelsViewerItem {
    /** Identificador único do reel (`Media.id`). */
    id: string;
    /** URL do vídeo (geralmente `/api/storage/<key>`). */
    videoUrl: string;
    /** Capa estática opcional (primeiro frame). */
    posterUrl?: string | null;
    /** Legenda — até 200 chars exibida sobre o vídeo. */
    caption?: string | null;
    /** Total de curtidas do reel. */
    likes: number;
    /** Já curtido pelo viewer atual? */
    liked: boolean;
    /** Owner exibido como header overlay. */
    owner: {
        identificador: string;
        nome: string;
        fotoUrl: string | null;
        cidadeNome: string;
        estadoSigla: string;
    };
}

/**
 * Estado do gate / paywall — quando o viewer Grátis ou anônimo
 * estoura a quota diária. UI mostra overlay convidando a criar
 * conta / virar Fan e bloqueia novos reels.
 */
export interface ReelsViewerPaywall {
    /** Mensagem principal do overlay. */
    title: string;
    /** Mensagem secundária com explicação curta. */
    description: string;
    /** CTAs do overlay (botões). */
    actions: React.ReactNode;
}

/**
 * Props do {@link ReelsViewer}.
 */
export interface ReelsViewerProps {
    /** Itens carregados até agora. Anexar mais via setState do consumer. */
    items: ReadonlyArray<ReelsViewerItem>;

    /**
     * Chamado quando o viewer chega no penúltimo item da lista —
     * consumer carrega próxima página do feed.
     */
    onNeedMore: () => void;

    /**
     * Chamado a cada vez que um reel novo entra em foco. Consumer
     * registra view, calcula quota etc.
     */
    onViewActive: (id: string) => void;

    /**
     * Chamado quando o viewer toca no coração. Consumer dispara
     * `POST /api/medias/<id>/likes` com `desired`. Recebe o
     * estado novo (`liked`) e o id do reel.
     */
    onToggleLike?: (id: string, desired: boolean) => void;

    /**
     * Quando passado, cobre o viewer com um overlay de paywall ao
     * tentar avançar pra novos reels. Itens já visualizados ainda
     * podem ser revisitados pelo scroll.
     */
    paywall?: ReelsViewerPaywall | null;

    /** Classes extras aplicadas ao container externo. */
    className?: string;
}

/**
 * ReelsViewer — viewer vertical full-screen de Reels (estilo
 * TikTok).
 *
 * Layout:
 *
 *   - Container `h-[100dvh]` com `overflow-y-scroll snap-y snap-mandatory`.
 *   - Cada item é uma `<section>` `h-[100dvh] snap-start` que
 *     ocupa o viewport inteiro.
 *   - O vídeo é `object-cover` (corta sem deformar).
 *
 * Interações:
 *
 *   - Tap no centro: pausa/retoma.
 *   - Coração no rodapé direito: like (delegado ao consumer).
 *   - Avatar/nome no rodapé esquerdo: navega pro perfil
 *     (delegado ao consumer via `<a>`).
 *   - Scroll vertical: muda o reel ativo.
 *
 * Auto-play / muted:
 *
 *   - Reel ativo: autoplay com `muted` (regra do iOS).
 *   - Reel não-ativo: pausado.
 *
 * Detecção do ativo: IntersectionObserver com `threshold: 0.7`
 * — quando ≥70% do reel está visível, ele é o "ativo".
 *
 * Paywall: quando `paywall != null`, o overlay é renderizado
 * sobre o viewer e bloqueia novos itens. Itens já vistos
 * (anteriores ao ponto de bloqueio) ainda funcionam.
 */
export function ReelsViewer({
    items,
    onNeedMore,
    onViewActive,
    onToggleLike,
    paywall,
    className,
}: ReelsViewerProps): React.ReactElement {
    const containerRef = React.useRef<HTMLDivElement>(null);
    const itemRefs = React.useRef<Map<string, HTMLElement>>(new Map());
    const videoRefs = React.useRef<Map<string, HTMLVideoElement>>(new Map());
    const [activeId, setActiveId] = React.useState<string | null>(
        items[0]?.id ?? null,
    );
    const [muted, setMuted] = React.useState(true);

    // IntersectionObserver pra detectar reel em foco.
    React.useEffect(() => {
        const root = containerRef.current;
        if (!root) return;

        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting && entry.intersectionRatio >= 0.7) {
                        const id = entry.target.getAttribute("data-reel-id");
                        if (id) {
                            setActiveId(id);
                        }
                    }
                }
            },
            { root, threshold: [0, 0.7, 1] },
        );

        for (const node of itemRefs.current.values()) {
            observer.observe(node);
        }

        return () => observer.disconnect();
    }, [items]);

    // Quando active muda: pausa todos, dá play no novo, dispara
    // onViewActive e checa se precisa carregar mais.
    React.useEffect(() => {
        if (activeId === null) return;

        for (const [id, video] of videoRefs.current.entries()) {
            if (id === activeId) {
                void video.play().catch(() => undefined);
            } else {
                video.pause();
                video.currentTime = 0;
            }
        }
        onViewActive(activeId);

        // Dispara `onNeedMore` quando ativo é o penúltimo (ou último).
        const idx = items.findIndex((i) => i.id === activeId);
        if (idx >= items.length - 2) {
            onNeedMore();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeId]);

    function handleTap(): void {
        const id = activeId;
        if (id === null) return;
        const video = videoRefs.current.get(id);
        if (!video) return;
        if (video.paused) {
            void video.play().catch(() => undefined);
        } else {
            video.pause();
        }
    }

    return (
        <div className="flex w-full justify-center bg-black">
            <div
                ref={containerRef}
                className={[
                    "relative w-full max-w-[28rem] overflow-y-scroll bg-black",
                    "snap-y snap-mandatory",
                    "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
                    className ?? "",
                ]
                    .filter(Boolean)
                    .join(" ")}
                style={{
                    // Desconta TopBar (h-14 = 3.5rem) + BottomNav (h-16 = 4rem)
                    // pra que cada reel caiba exatamente no espaço visível
                    // entre as duas barras fixas.
                    height: "calc(100dvh - 3.5rem - 4rem)",
                }}
            >
            {items.map((item) => (
                <section
                    key={item.id}
                    data-reel-id={item.id}
                    ref={(node) => {
                        if (node) itemRefs.current.set(item.id, node);
                        else itemRefs.current.delete(item.id);
                    }}
                    className="relative flex w-full snap-start items-center justify-center bg-black"
                    style={{ height: "calc(100dvh - 3.5rem - 4rem)" }}
                >
                    <video
                        ref={(node) => {
                            if (node) videoRefs.current.set(item.id, node);
                            else videoRefs.current.delete(item.id);
                        }}
                        src={item.videoUrl}
                        poster={item.posterUrl ?? undefined}
                        muted={muted}
                        playsInline
                        loop
                        preload="metadata"
                        className="h-full w-full object-cover"
                        onClick={handleTap}
                    />

                    {/* Overlay de informações do owner — canto
                        inferior esquerdo. */}
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-gradient-to-t from-black/70 via-black/30 to-transparent p-4">
                        <div className="pointer-events-auto flex min-w-0 flex-col gap-2 text-white">
                            <a
                                href={`/acompanhantes/${item.owner.identificador}`}
                                className="inline-flex items-center gap-2 self-start rounded-full bg-white/10 px-3 py-1.5 ring-1 ring-white/15 backdrop-blur-md transition-all hover:bg-white/20"
                            >
                                <Avatar
                                    src={item.owner.fotoUrl ?? null}
                                    name={item.owner.nome}
                                    size="sm"
                                />
                                <span className="flex flex-col leading-tight">
                                    <span className="truncate text-sm font-semibold">
                                        {item.owner.nome}
                                    </span>
                                    <span className="inline-flex items-center gap-1 truncate text-[0.65rem] text-white/80">
                                        <MapPinIcon size={10} />
                                        {item.owner.cidadeNome},{" "}
                                        {item.owner.estadoSigla}
                                    </span>
                                </span>
                            </a>

                            {item.caption ? (
                                <p className="max-w-[80vw] text-sm leading-snug">
                                    {item.caption}
                                </p>
                            ) : null}
                        </div>

                        {/* Coluna de ações à direita — só like + mute. */}
                        <div className="pointer-events-auto flex flex-col items-center gap-3">
                            <LikeButton
                                liked={item.liked}
                                count={item.likes}
                                onChange={(desired) =>
                                    onToggleLike?.(item.id, desired)
                                }
                                size="md"
                                aria-label={
                                    item.liked
                                        ? "Descurtir reel"
                                        : "Curtir reel"
                                }
                                tone="onDark"
                            />

                            <button
                                type="button"
                                onClick={() => setMuted((v) => !v)}
                                aria-label={muted ? "Ativar som" : "Silenciar"}
                                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-white/15 backdrop-blur-md transition-all hover:bg-white/20 hover:scale-105"
                            >
                                {muted ? (
                                    <MutedIcon size={16} />
                                ) : (
                                    <UnmutedIcon size={16} />
                                )}
                            </button>
                        </div>
                    </div>
                </section>
            ))}

            {/* Paywall overlay — cobre tudo quando ativo. */}
            {paywall ? (
                <div className="pointer-events-auto absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-black/55 px-6 text-center backdrop-blur-2xl">
                    <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-[color:var(--accent)] to-[color:var(--accent-deep)] text-white shadow-[0_12px_28px_-8px_rgba(197,82,58,0.7)] ring-4 ring-white/20">
                        <LockIcon size={28} />
                    </span>
                    <h2 className="max-w-xs text-2xl font-bold tracking-tight text-white">
                        {paywall.title}
                    </h2>
                    <p className="max-w-sm text-sm leading-relaxed text-white/80">
                        {paywall.description}
                    </p>
                    <div className="flex flex-col gap-2 sm:flex-row">
                        {paywall.actions}
                    </div>
                </div>
            ) : null}
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────
// Ícones inline — `MutedIcon`/`UnmutedIcon` (alto-falante)
// Pequenos, locais ao componente — sem peso pra subir pro `icons.tsx`.
// ─────────────────────────────────────────────────────────────────────

interface IconLocalProps {
    size?: number;
}

function MutedIcon({ size = 18 }: IconLocalProps): React.ReactElement {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <path d="M11 5L6 9H2v6h4l5 4z" />
            <line x1="23" y1="9" x2="17" y2="15" />
            <line x1="17" y1="9" x2="23" y2="15" />
        </svg>
    );
}

function UnmutedIcon({ size = 18 }: IconLocalProps): React.ReactElement {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <path d="M11 5L6 9H2v6h4l5 4z" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
        </svg>
    );
}

const _heart = HeartIcon;
void _heart;
