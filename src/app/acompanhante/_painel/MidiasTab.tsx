"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import {
    Avatar,
    Button,
    Card,
    ClockIcon,
    ConfirmDialog,
    EmptyState,
    HeartIcon,
    IconButton,
    IconSegmented,
    ImageIcon,
    InlineAlert,
    LinkButton,
    MediaCarousel,
    MediaUploadModal,
    MediaGrid,
    MediaThumbnail,
    MetricPill,
    Modal,
    PencilIcon,
    PlayCircleIcon,
    PlayIcon,
    PlusIcon,
    SectionHeader,
    SparklesIcon,
    useMediaCarousel,
    useModal,
    type IconSegmentedOption,
    type MediaComment,
    type MediaItem,
    type MediaUploadResult,
} from "@/components";

import type { PlanoDefinition } from "@/domain/plano/definitions";

/**
 * Aba "Mídias" do painel da Acompanhante.
 *
 * Camada de UI da galeria pessoal. Por enquanto a lista vem vazia
 * (`Sistema_de_Midias` ainda não publica nada), mas toda a
 * orquestração visual já está no lugar:
 *
 * 1. Cabeçalho da galeria com {@link FilterChips} (`Tudo` / `Fotos` /
 *    `Vídeos`) e métricas em {@link MetricPill} (mídias usadas,
 *    curtidas, comentários).
 * 2. {@link MediaGrid} responsivo (3-5 colunas) com tiles do
 *    {@link import("@/components").MediaThumbnail} primitivo —
 *    badge de play em vídeos, stats overlay no canto.
 * 3. {@link MediaCarousel} modal full-screen ao clicar num tile.
 *    Mostra a mídia em foco, lista de comentários e
 *    {@link import("@/components").CommentInput} pra responder.
 *
 * # Quando o `Sistema_de_Midias` chegar
 *
 * Substituir os arrays vazios `MEDIA_ITEMS_PLACEHOLDER` e
 * `COMMENTS_PLACEHOLDER` por dados vindos do server (passados como
 * props pela página `/acompanhante`). Os primitivos não mudam.
 *
 * # Stories
 *
 * Continuam como seção separada abaixo da galeria, com bloqueio
 * tonal quando `permiteStories === false`.
 */
export interface MidiasTabProps {
    plano: PlanoDefinition;
    /**
     * Itens já publicados na galeria, vindos da página
     * `/acompanhante` via {@link import("@/server/storage/galleryMedia").listarGaleria}.
     */
    items: ReadonlyArray<MediaItem>;
    /**
     * Stories ativos (24h não expirados). Lista vazia quando o
     * plano não permite Stories.
     */
    storiesAtivos?: ReadonlyArray<MediaItem>;
    /**
     * Stories que já expiraram (mostrados no histórico recente
     * antes do GC).
     */
    storiesExpirados?: ReadonlyArray<MediaItem>;
    /**
     * Map `storyId → highlightTitle` indicando quais stories
     * arquivados já estão em algum destaque. Map vazio = nenhum.
     */
    storyHighlightMap?: ReadonlyMap<string, string>;
    /**
     * Lista de títulos de destaques existentes do dono. UI mostra
     * como sugestões ao adicionar um story em destaque (pra reusar
     * grupos em vez de criar novo a cada clique).
     */
    titulosDestaque?: ReadonlyArray<string>;
}

type Filtro = "tudo" | "fotos" | "videos";
type FiltroStory = "ativos" | "arquivados";

/**
 * Mapa `itemId → comentários`. Vai ser populado pelo `Sistema_de_Comentarios`.
 */
const COMMENTS_PLACEHOLDER: Record<string, ReadonlyArray<MediaComment>> = {};

export function MidiasTab({
    plano,
    items,
    storiesAtivos = [],
    storiesExpirados = [],
    storyHighlightMap,
    titulosDestaque = [],
}: MidiasTabProps): React.ReactElement {
    const [filtro, setFiltro] = React.useState<Filtro>("tudo");
    const carousel = useMediaCarousel();
    const upload = useModal();
    const [uploading, setUploading] = React.useState(false);
    const [uploadError, setUploadError] = React.useState<string | null>(null);
    const router = useRouter();

    // Estado de exclusão. `pendingDeleteId` controla o ConfirmDialog.
    const [pendingDeleteId, setPendingDeleteId] = React.useState<string | null>(
        null,
    );
    const [deleting, setDeleting] = React.useState(false);
    const [deleteError, setDeleteError] = React.useState<string | null>(null);

    function requestDelete(id: string): void {
        setPendingDeleteId(id);
        setDeleteError(null);
    }

    async function confirmDelete(): Promise<void> {
        if (pendingDeleteId === null) return;
        setDeleting(true);
        setDeleteError(null);
        try {
            const res = await fetch(
                `/api/acompanhante/midias/${pendingDeleteId}`,
                { method: "DELETE" },
            );
            if (!res.ok) {
                setDeleteError(
                    "Não foi possível excluir agora. Tente novamente.",
                );
                return;
            }
            // Fecha o carrossel se a mídia ativa foi a removida.
            if (carousel.activeId === pendingDeleteId) {
                carousel.close();
            }
            setPendingDeleteId(null);
            router.refresh();
        } catch {
            setDeleteError("Falha de rede. Tente novamente.");
        } finally {
            setDeleting(false);
        }
    }

    // -----------------------------------------------------------------
    // Stories
    //
    // Estrutura: avatares circulares para os ativos (mesmo visual da
    // linha de stories pública), com IconButton de "+" pra adicionar.
    // Arquivados ficam num bloco separado com tiles e indicador de
    // expirado, mostrando curtidas históricas.
    // -----------------------------------------------------------------
    const [filtroStory, setFiltroStory] = React.useState<FiltroStory>("ativos");
    const storyCarousel = useMediaCarousel();
    const storyUpload = useModal();
    const [uploadingStory, setUploadingStory] = React.useState(false);
    const [storyUploadError, setStoryUploadError] = React.useState<
        string | null
    >(null);

    // -----------------------------------------------------------------
    // Highlights (Destaques)
    //
    // Modal pra adicionar story arquivado a um destaque (escolher
    // entre títulos existentes ou digitar novo). Toggle de remover é
    // direto (sem modal — só um click).
    // -----------------------------------------------------------------
    const [highlightStoryId, setHighlightStoryId] = React.useState<string | null>(
        null,
    );
    const [highlightTitleInput, setHighlightTitleInput] = React.useState("");
    const [savingHighlight, setSavingHighlight] = React.useState(false);
    const [highlightError, setHighlightError] = React.useState<string | null>(
        null,
    );

    function abrirHighlightDialog(storyId: string): void {
        setHighlightStoryId(storyId);
        setHighlightTitleInput("");
        setHighlightError(null);
    }

    async function salvarHighlight(title: string): Promise<void> {
        if (highlightStoryId === null) return;
        const trimmed = title.trim();
        if (trimmed.length === 0) {
            setHighlightError("Dá um título pro destaque.");
            return;
        }
        if (trimmed.length > 20) {
            setHighlightError("Máximo de 20 caracteres.");
            return;
        }
        setSavingHighlight(true);
        setHighlightError(null);
        try {
            const res = await fetch(
                `/api/acompanhante/stories/${highlightStoryId}/highlight`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ title: trimmed }),
                },
            );
            if (!res.ok) {
                setHighlightError(
                    "Não foi possível adicionar ao destaque agora.",
                );
                return;
            }
            setHighlightStoryId(null);
            router.refresh();
        } catch {
            setHighlightError("Falha de rede. Tente novamente.");
        } finally {
            setSavingHighlight(false);
        }
    }

    async function removerDoHighlight(storyId: string): Promise<void> {
        try {
            const res = await fetch(
                `/api/acompanhante/stories/${storyId}/highlight`,
                { method: "DELETE" },
            );
            if (!res.ok) return;
            router.refresh();
        } catch {
            // Best-effort. UI não trava em erro de rede aqui — usuário
            // tenta de novo.
        }
    }

    const storiesByFilter =
        filtroStory === "ativos" ? storiesAtivos : storiesExpirados;

    const storyFilterOptions: ReadonlyArray<IconSegmentedOption> = [
        {
            value: "ativos",
            label: "Ativos",
            icon: <PlayIcon size={14} />,
            count: storiesAtivos.length,
        },
        {
            value: "arquivados",
            label: "Arquivados",
            icon: <ClockIcon size={14} />,
            count: storiesExpirados.length,
        },
    ];

    // Aplica o filtro corrente. Memoizado para que mudanças de
    // estado fora de filtro não invalidem a lista.
    const filteredItems = React.useMemo(() => {
        if (filtro === "fotos") return items.filter((m) => m.type === "photo");
        if (filtro === "videos") return items.filter((m) => m.type === "video");
        return items;
    }, [filtro, items]);

    // -----------------------------------------------------------------
    // Reorder mode (drag-and-drop)
    //
    // Estado local com a ordem corrente; só persiste ao salvar. Em
    // modo reorder, não filtra (todos os itens são reordenáveis em
    // conjunto — filtrar mostraria apenas um subset e o sortOrder
    // global ficaria inconsistente).
    // -----------------------------------------------------------------
    const [reorderMode, setReorderMode] = React.useState(false);
    const [orderDraft, setOrderDraft] = React.useState<ReadonlyArray<MediaItem>>(
        items,
    );
    const [savingOrder, setSavingOrder] = React.useState(false);
    const [orderError, setOrderError] = React.useState<string | null>(null);
    const [draggingId, setDraggingId] = React.useState<string | null>(null);
    const [overId, setOverId] = React.useState<string | null>(null);

    // Sincroniza com a prop quando o painel recarrega (ex.: depois
    // de publicar uma mídia nova).
    React.useEffect(() => {
        setOrderDraft(items);
    }, [items]);

    function entrarReorder(): void {
        setOrderDraft(items);
        setOrderError(null);
        setReorderMode(true);
    }

    function cancelarReorder(): void {
        setOrderDraft(items);
        setOrderError(null);
        setReorderMode(false);
        setDraggingId(null);
        setOverId(null);
    }

    function moverItem(fromId: string, toId: string): void {
        if (fromId === toId) return;
        setOrderDraft((prev) => {
            const next = [...prev];
            const fromIdx = next.findIndex((m) => m.id === fromId);
            const toIdx = next.findIndex((m) => m.id === toId);
            if (fromIdx === -1 || toIdx === -1) return prev;
            const [moved] = next.splice(fromIdx, 1);
            if (!moved) return prev;
            next.splice(toIdx, 0, moved);
            return next;
        });
    }

    async function salvarReorder(): Promise<void> {
        setSavingOrder(true);
        setOrderError(null);
        try {
            const ids = orderDraft.map((m) => m.id);
            const res = await fetch("/api/acompanhante/midias/order", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids }),
            });
            if (!res.ok) {
                setOrderError(
                    "Não foi possível salvar a nova ordem. Tente novamente.",
                );
                return;
            }
            setReorderMode(false);
            setDraggingId(null);
            setOverId(null);
            router.refresh();
        } catch {
            setOrderError("Falha de rede. Tente novamente.");
        } finally {
            setSavingOrder(false);
        }
    }

    const totals = React.useMemo(() => {
        const fotos = items.filter((m) => m.type === "photo").length;
        const videos = items.filter((m) => m.type === "video").length;
        const likes = items.reduce((acc, m) => acc + (m.likes ?? 0), 0);
        const comentarios = items.reduce(
            (acc, m) => acc + (m.comments ?? 0),
            0,
        );
        return { fotos, videos, likes, comentarios, total: items.length };
    }, [items]);

    const filterOptions: ReadonlyArray<IconSegmentedOption> = [
        {
            value: "tudo",
            label: "Tudo",
            icon: <SparklesIcon size={14} />,
            count: totals.total,
        },
        {
            value: "fotos",
            label: "Fotos",
            icon: <ImageIcon size={14} />,
            count: totals.fotos,
        },
        {
            value: "videos",
            label: "Vídeos",
            icon: <PlayIcon size={14} />,
            count: totals.videos,
        },
    ];

    return (
        <div className="flex flex-col gap-5">
            {/* Galeria */}
            <section className="flex flex-col gap-3">
                <SectionHeader
                    title="Galeria"
                    trailing={
                        reorderMode ? (
                            <div className="flex items-center gap-2">
                                <LinkButton
                                    onClick={cancelarReorder}
                                    disabled={savingOrder}
                                >
                                    Cancelar
                                </LinkButton>
                                <Button
                                    type="button"
                                    variant="primary"
                                    size="sm"
                                    onClick={() => {
                                        void salvarReorder();
                                    }}
                                    disabled={savingOrder}
                                >
                                    {savingOrder ? "Salvando…" : "Salvar ordem"}
                                </Button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                <IconSegmented
                                    options={filterOptions}
                                    value={filtro}
                                    onChange={(v) => setFiltro(v as Filtro)}
                                    aria-label="Filtrar tipo de mídia"
                                />
                                {items.length > 1 ? (
                                    <IconButton
                                        onClick={entrarReorder}
                                        icon={<PencilIcon size={18} />}
                                        aria-label="Reordenar mídias"
                                        tone="neutral"
                                    />
                                ) : null}
                                <IconButton
                                    onClick={upload.open}
                                    icon={<PlusIcon size={20} />}
                                    aria-label="Adicionar mídia"
                                    tone="primary"
                                />
                            </div>
                        )
                    }
                />

                {/* Métricas em pílula compacta. */}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    <MetricPill
                        icon={<SparklesIcon size={11} />}
                        value={`${totals.total}/${plano.limiteMidias}`}
                        label="mídias"
                    />
                    <MetricPill
                        icon={<HeartIcon size={11} />}
                        value={totals.likes}
                        label="curtidas"
                    />
                    <MetricPill
                        icon={<PlayCircleIcon size={11} />}
                        value={totals.comentarios}
                        label="comentários"
                    />
                </div>

                {/* Erro inline da reordenação (visível enquanto persiste). */}
                {orderError !== null ? (
                    <InlineAlert tone="danger">{orderError}</InlineAlert>
                ) : null}

                {/* Conteúdo: grid quando há itens, EmptyState quando vazio.
                    Em modo reorder, exibe lista drag-and-drop com todos
                    os itens (ignora filtro — sortOrder é global). */}
                {reorderMode ? (
                    <div
                        role="list"
                        aria-label="Arraste para reordenar mídias"
                        className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5"
                    >
                        {orderDraft.map((item) => {
                            const isDragging = draggingId === item.id;
                            const isOver = overId === item.id && !isDragging;
                            return (
                                <div
                                    key={item.id}
                                    role="listitem"
                                    draggable
                                    onDragStart={(e) => {
                                        setDraggingId(item.id);
                                        e.dataTransfer.effectAllowed = "move";
                                        // Hint visual padrão do browser.
                                        try {
                                            e.dataTransfer.setData(
                                                "text/plain",
                                                item.id,
                                            );
                                        } catch {
                                            // Algumas envs (ex.: jsdom)
                                            // não suportam — silencioso.
                                        }
                                    }}
                                    onDragEnter={() => {
                                        setOverId(item.id);
                                        if (
                                            draggingId !== null &&
                                            draggingId !== item.id
                                        ) {
                                            moverItem(draggingId, item.id);
                                        }
                                    }}
                                    onDragOver={(e) => {
                                        e.preventDefault();
                                        e.dataTransfer.dropEffect = "move";
                                    }}
                                    onDragEnd={() => {
                                        setDraggingId(null);
                                        setOverId(null);
                                    }}
                                    onDrop={(e) => {
                                        e.preventDefault();
                                        setDraggingId(null);
                                        setOverId(null);
                                    }}
                                    className={[
                                        "relative cursor-grab transition-all duration-150 active:cursor-grabbing",
                                        isDragging
                                            ? "opacity-40 scale-95"
                                            : "opacity-100",
                                        isOver
                                            ? "ring-2 ring-accent/60 ring-offset-1 ring-offset-surface rounded-md"
                                            : "",
                                    ]
                                        .filter(Boolean)
                                        .join(" ")}
                                >
                                    <MediaThumbnail item={item} />
                                </div>
                            );
                        })}
                    </div>
                ) : filteredItems.length > 0 ? (
                    <MediaGrid
                        items={filteredItems}
                        onOpen={carousel.openAt}
                    />
                ) : (
                    <Card padding="none">
                        <EmptyState
                            size="sm"
                            icon={<SparklesIcon size={20} />}
                            title={emptyTitle(filtro, totals.total === 0)}
                            description={emptyDescription(
                                filtro,
                                totals.total === 0,
                            )}
                        />
                    </Card>
                )}
            </section>

            {/* Stories */}
            <section className="flex flex-col gap-3">
                <SectionHeader
                    title="Stories"
                    tone={plano.permiteStories ? "neutral" : "muted"}
                    trailing={
                        plano.permiteStories ? (
                            <div className="flex items-center gap-2">
                                <IconSegmented
                                    options={storyFilterOptions}
                                    value={filtroStory}
                                    onChange={(v) =>
                                        setFiltroStory(v as FiltroStory)
                                    }
                                    aria-label="Filtrar Stories"
                                />
                                <IconButton
                                    onClick={storyUpload.open}
                                    icon={<PlusIcon size={20} />}
                                    aria-label="Adicionar Story"
                                    tone="primary"
                                />
                            </div>
                        ) : null
                    }
                />
                {plano.permiteStories ? (
                    storiesByFilter.length > 0 ? (
                        <Card>
                            {filtroStory === "ativos" ? (
                                /* Ativos: avatares horizontais
                                   compactos, idênticos ao layout
                                   público. */
                                <div className="flex flex-wrap gap-3">
                                    {storiesByFilter.map((s) => (
                                        <button
                                            key={s.id}
                                            type="button"
                                            onClick={() =>
                                                storyCarousel.openAt(s.id)
                                            }
                                            className="flex flex-col items-center gap-1.5 focus:outline-none"
                                            aria-label={`Story de ${formatRelativeShort(s.createdAt)}`}
                                        >
                                            <Avatar
                                                src={s.url}
                                                size="lg"
                                                storyRing="unseen"
                                            />
                                            <span className="text-[0.65rem] text-text-secondary">
                                                {formatRelativeShort(s.createdAt)}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                /* Arquivados: tiles com badge
                                   "Expirado" e contador de likes. */
                                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5">
                                    {storiesByFilter.map((s) => {
                                        const inHighlight =
                                            storyHighlightMap?.get(s.id) ?? null;
                                        return (
                                            <div
                                                key={s.id}
                                                className="flex flex-col gap-1.5"
                                            >
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        storyCarousel.openAt(s.id)
                                                    }
                                                    className="group flex flex-col gap-1.5 text-left focus:outline-none"
                                                >
                                                    <span className="relative block aspect-[3/4] overflow-hidden rounded-2xl bg-neutral-100 ring-1 ring-neutral-200">
                                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                                        <img
                                                            src={s.url}
                                                            alt=""
                                                            className="h-full w-full object-cover saturate-50 transition-all group-hover:saturate-100"
                                                        />
                                                        <span className="absolute inset-x-1.5 top-1.5 flex justify-between gap-1 text-[0.6rem] font-semibold uppercase tracking-wider">
                                                            <span className="rounded-full bg-black/55 px-1.5 py-0.5 text-white">
                                                                Expirado
                                                            </span>
                                                            {inHighlight !== null ? (
                                                                <span className="rounded-full bg-gradient-to-br from-accent to-accent-deep px-1.5 py-0.5 text-white">
                                                                    Em destaque
                                                                </span>
                                                            ) : null}
                                                        </span>
                                                        <span className="absolute inset-x-1.5 bottom-1.5 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[0.65rem] text-white">
                                                            <HeartIcon size={10} />
                                                            {s.likes ?? 0}
                                                        </span>
                                                    </span>
                                                    <span className="text-[0.65rem] text-text-secondary">
                                                        {formatRelativeShort(
                                                            s.createdAt,
                                                        )}
                                                    </span>
                                                </button>
                                                {inHighlight !== null ? (
                                                    <div className="flex items-center justify-between gap-1 px-1">
                                                        <span className="truncate text-[0.65rem] font-medium text-accent-deep">
                                                            {inHighlight}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                void removerDoHighlight(
                                                                    s.id,
                                                                );
                                                            }}
                                                            className="text-[0.65rem] text-text-secondary hover:text-danger-700 focus:outline-none"
                                                        >
                                                            Remover
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            abrirHighlightDialog(
                                                                s.id,
                                                            )
                                                        }
                                                        className="px-1 text-left text-[0.65rem] text-text-secondary hover:text-accent-deep focus:outline-none"
                                                    >
                                                        + Adicionar a destaque
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </Card>
                    ) : (
                        <Card padding="none">
                            <EmptyState
                                size="sm"
                                icon={<PlayCircleIcon size={20} />}
                                title={
                                    filtroStory === "ativos"
                                        ? "Sem Stories ativos"
                                        : "Sem Stories arquivados"
                                }
                                description={
                                    filtroStory === "ativos"
                                        ? "Os Stories que você publicar aparecem aqui durante 24 horas."
                                        : "Stories expiram após 24 horas e ficam arquivados aqui com o histórico de curtidas."
                                }
                            />
                        </Card>
                    )
                ) : (
                    <Card padding="none">
                        <EmptyState
                            size="sm"
                            icon={<PlayCircleIcon size={20} />}
                            title="Stories estão bloqueados"
                            description="Faça upgrade para liberar Stories no seu perfil."
                            action={
                                <Button
                                    href="/acompanhante/selecao-plano"
                                    size="sm"
                                >
                                    Trocar plano
                                </Button>
                            }
                        />
                    </Card>
                )}
            </section>

            {/* Carrossel modal — sempre montado, controla visibilidade
                via prop `open`. Conexão com mídias filtradas para que
                navegar com setas respeite o filtro ativo. */}
            <MediaCarousel
                items={filteredItems}
                activeId={carousel.activeId}
                onActiveChange={carousel.openAt}
                open={carousel.open}
                onClose={carousel.close}
                comments={COMMENTS_PLACEHOLDER}
                onDelete={requestDelete}
            />

            {/* Modal de upload — sempre montado. Faz POST
                multipart para `/api/acompanhante/midias` (server
                cria a Media + commit em R2) e dispara
                `router.refresh()` no sucesso para a página
                pai re-buscar a galeria. */}
            <MediaUploadModal
                open={upload.isOpen}
                onClose={() => {
                    upload.close();
                    setUploadError(null);
                }}
                submitting={uploading}
                title="Adicionar mídia"
                subtitle={
                    uploadError ?? "Foto ou vídeo. Cabe descrição opcional."
                }
                onSubmit={async (result: MediaUploadResult) => {
                    setUploading(true);
                    setUploadError(null);
                    try {
                        const formData = new FormData();
                        formData.append("foto", result.file);
                        formData.append("description", result.description);
                        const res = await fetch(
                            "/api/acompanhante/midias",
                            { method: "POST", body: formData },
                        );
                        if (!res.ok) {
                            const payload = (await res.json().catch(() => null)) as
                                | { reason?: string }
                                | null;
                            const reason = payload?.reason ?? "DESCONHECIDO";
                            setUploadError(reasonToMessage(reason));
                            return;
                        }
                        upload.close();
                        router.refresh();
                    } catch {
                        setUploadError(
                            "Falha ao enviar. Tente novamente.",
                        );
                    } finally {
                        setUploading(false);
                    }
                }}
            />

            {/* Confirmação de exclusão. Aberto via `requestDelete` no
                carrossel; confirmado dispara DELETE + refresh. */}
            <ConfirmDialog
                open={pendingDeleteId !== null}
                onClose={() => {
                    setPendingDeleteId(null);
                    setDeleteError(null);
                }}
                onConfirm={confirmDelete}
                title="Excluir mídia"
                description={
                    deleteError ??
                    "Esta mídia será removida do seu perfil. A ação não pode ser desfeita."
                }
                tone="danger"
                confirmLabel="Excluir"
                loading={deleting}
            />

            {/* Carrossel de Stories — mesmo MediaCarousel da
                galeria, com `storyMode` (sem painel direito,
                progress bar, auto-advance, toolbar overlay).
                Estado local controla `activeId`. */}
            <MediaCarousel
                items={storiesByFilter}
                activeId={storyCarousel.activeId}
                onActiveChange={storyCarousel.openAt}
                open={storyCarousel.open}
                onClose={storyCarousel.close}
                storyMode
            />

            {/* Modal de upload de Story. Mesmo primitivo do upload
                de galeria, mas configurado para o fluxo Story:
                aceita foto e vídeo, com legenda curta opcional
                (até 80 chars). Endpoint dedicado:
                `POST /api/acompanhante/stories`. */}
            <MediaUploadModal
                open={storyUpload.isOpen}
                onClose={() => {
                    storyUpload.close();
                    setStoryUploadError(null);
                }}
                submitting={uploadingStory}
                title="Adicionar Story"
                subtitle={
                    storyUploadError ??
                    "Foto ou vídeo. Story expira após 24 horas."
                }
                showDescription={true}
                descriptionLabel="Legenda"
                descriptionPlaceholder="Diga algo curto. Opcional."
                maxDescription={80}
                onSubmit={async (result: MediaUploadResult) => {
                    setUploadingStory(true);
                    setStoryUploadError(null);
                    try {
                        const formData = new FormData();
                        formData.append("foto", result.file);
                        if (result.description.length > 0) {
                            formData.append("caption", result.description);
                        }
                        const res = await fetch(
                            "/api/acompanhante/stories",
                            { method: "POST", body: formData },
                        );
                        if (!res.ok) {
                            const payload = (await res
                                .json()
                                .catch(() => null)) as
                                | { reason?: string }
                                | null;
                            const reason = payload?.reason ?? "DESCONHECIDO";
                            setStoryUploadError(
                                storyReasonToMessage(reason),
                            );
                            return;
                        }
                        storyUpload.close();
                        router.refresh();
                    } catch {
                        setStoryUploadError(
                            "Falha ao enviar. Tente novamente.",
                        );
                    } finally {
                        setUploadingStory(false);
                    }
                }}
            />

            {/* Modal de adicionar story em destaque. Mostra
                sugestões dos títulos existentes (chips clicáveis)
                + input pra novo título. */}
            <Modal
                open={highlightStoryId !== null}
                onClose={() => setHighlightStoryId(null)}
                title="Adicionar a destaque"
                size="sm"
            >
                <div className="flex flex-col gap-4">
                    <p className="text-sm text-text-secondary">
                        Destaques aparecem no seu perfil acima da
                        galeria. Escolha um existente ou crie um novo.
                    </p>
                    {titulosDestaque.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                            {titulosDestaque.map((t) => (
                                <button
                                    key={t}
                                    type="button"
                                    onClick={() => {
                                        void salvarHighlight(t);
                                    }}
                                    disabled={savingHighlight}
                                    className="rounded-full border border-accent/30 bg-accent-soft px-3 py-1 text-xs font-medium text-accent-deep hover:bg-accent-soft/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:opacity-60"
                                >
                                    {t}
                                </button>
                            ))}
                        </div>
                    ) : null}
                    <div className="flex flex-col gap-1.5">
                        <label
                            htmlFor="highlight-title"
                            className="text-xs font-medium text-text-secondary"
                        >
                            Novo título
                        </label>
                        <input
                            id="highlight-title"
                            type="text"
                            value={highlightTitleInput}
                            onChange={(e) =>
                                setHighlightTitleInput(e.target.value)
                            }
                            maxLength={20}
                            placeholder="Ex: Praia, Look do dia..."
                            disabled={savingHighlight}
                            className="rounded-xl border border-border bg-surface px-3 py-2 text-sm focus:border-accent focus:outline-none disabled:opacity-60"
                        />
                        <span className="text-[0.65rem] text-text-disabled">
                            {highlightTitleInput.length}/20
                        </span>
                    </div>
                    {highlightError !== null ? (
                        <InlineAlert tone="danger">
                            {highlightError}
                        </InlineAlert>
                    ) : null}
                    <div className="flex justify-end gap-2">
                        <Button
                            type="button"
                            variant="ghost"
                            size="md"
                            onClick={() => setHighlightStoryId(null)}
                            disabled={savingHighlight}
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="button"
                            variant="primary"
                            size="md"
                            onClick={() => {
                                void salvarHighlight(highlightTitleInput);
                            }}
                            disabled={
                                savingHighlight ||
                                highlightTitleInput.trim().length === 0
                            }
                        >
                            {savingHighlight ? "Salvando…" : "Salvar"}
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}

function emptyTitle(filtro: Filtro, totalIsZero: boolean): string {
    if (totalIsZero) return "Nenhuma mídia publicada ainda";
    if (filtro === "fotos") return "Nenhuma foto neste filtro";
    if (filtro === "videos") return "Nenhum vídeo neste filtro";
    return "Nenhuma mídia neste filtro";
}

function emptyDescription(
    filtro: Filtro,
    totalIsZero: boolean,
): string | undefined {
    if (totalIsZero) {
        return "Quando você publicar fotos e vídeos, eles aparecem aqui em grade.";
    }
    if (filtro === "fotos") return "Você ainda não publicou fotos.";
    if (filtro === "videos") return "Você ainda não publicou vídeos.";
    return undefined;
}

/**
 * Converte o `reason` discriminado retornado pelo endpoint em uma
 * mensagem amigável exibida no subtitle do modal de upload.
 */
function reasonToMessage(reason: string): string {
    switch (reason) {
        case "MIDIA_INVALIDA":
            return "Tipo ou tamanho não suportado. Use JPEG/PNG/WEBP até 8 MB ou MP4/WEBM/MOV até 50 MB.";
        case "DESCRICAO_INVALIDA":
            return "Descrição muito longa.";
        case "LIMITE_ATINGIDO":
            return "Você atingiu o limite de mídias do seu plano.";
        case "SEM_PLANO":
            return "Selecione um plano para publicar mídias.";
        case "NAO_AUTENTICADO":
            return "Sua sessão expirou. Faça login novamente.";
        case "TIPO_INVALIDO":
            return "Esta conta não pode publicar mídias.";
        default:
            return "Não foi possível publicar a mídia. Tente novamente.";
    }
}

/**
 * Converte o `reason` retornado pelo endpoint de Stories em
 * mensagem amigável.
 */
function storyReasonToMessage(reason: string): string {
    switch (reason) {
        case "MIDIA_INVALIDA":
            return "Tipo ou tamanho não suportado. Use JPEG/PNG/WEBP até 8 MB ou MP4/WEBM/MOV até 50 MB.";
        case "CAPTION_INVALIDA":
            return "Legenda muito longa. Use até 80 caracteres.";
        case "LIMITE_ATIVOS":
            return "Você atingiu o limite de Stories ativos. Aguarde alguns expirarem.";
        case "PLANO_INVALIDO":
            return "Stories estão disponíveis apenas no plano Premium.";
        case "SEM_PLANO":
            return "Selecione um plano para publicar Stories.";
        case "NAO_AUTENTICADO":
            return "Sua sessão expirou. Faça login novamente.";
        default:
            return "Não foi possível publicar o Story. Tente novamente.";
    }
}

/**
 * Versão curta do tempo relativo ("3h", "agora", "17h").
 * Usado nos labels minúsculos abaixo dos avatares de Story.
 */
function formatRelativeShort(date: Date | string | undefined): string {
    if (date === undefined) return "";
    const d = typeof date === "string" ? new Date(date) : date;
    const diff = Date.now() - d.getTime();
    const min = Math.floor(diff / 60_000);
    if (min < 1) return "agora";
    if (min < 60) return `${min}m`;
    const h = Math.floor(min / 60);
    if (h < 24) return `${h}h`;
    const days = Math.floor(h / 24);
    return `${days}d`;
}
