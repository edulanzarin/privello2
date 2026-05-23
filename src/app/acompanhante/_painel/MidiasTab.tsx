"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import {
    Button,
    Card,
    ClockIcon,
    ConfirmDialog,
    EmptyState,
    HeartIcon,
    IconButton,
    IconSegmented,
    ImageIcon,
    MediaCarousel,
    MediaGrid,
    MediaUploadModal,
    MetricPill,
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
}

type Filtro = "tudo" | "fotos" | "videos";
type FiltroStory = "ativos" | "expirados";

/**
 * Mapa `itemId → comentários`. Vai ser populado pelo `Sistema_de_Comentarios`.
 */
const COMMENTS_PLACEHOLDER: Record<string, ReadonlyArray<MediaComment>> = {};

/**
 * Stories ativos e expirados. Quando o `Sistema_de_Stories` existir,
 * essas listas viram props vindas da página `/acompanhante`. Por
 * enquanto a UI já está montada — basta plugar dados reais.
 */
const STORIES_ATIVOS_PLACEHOLDER: ReadonlyArray<MediaItem> = [];
const STORIES_EXPIRADOS_PLACEHOLDER: ReadonlyArray<MediaItem> = [];

export function MidiasTab({ plano, items }: MidiasTabProps): React.ReactElement {
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
    // Estrutura espelha a da Galeria: filtro segmentado (ativos /
    // expirados), grid de thumbs e modal de upload próprio. Quando o
    // `Sistema_de_Stories` existir, basta substituir os arrays
    // placeholder por props vindas do server.
    // -----------------------------------------------------------------
    const [filtroStory, setFiltroStory] = React.useState<FiltroStory>("ativos");
    const storiesCarousel = useMediaCarousel();
    const storyUpload = useModal();
    const [uploadingStory, setUploadingStory] = React.useState(false);
    const [storyUploadError, setStoryUploadError] = React.useState<
        string | null
    >(null);

    const storiesByFilter =
        filtroStory === "ativos"
            ? STORIES_ATIVOS_PLACEHOLDER
            : STORIES_EXPIRADOS_PLACEHOLDER;

    const storyFilterOptions: ReadonlyArray<IconSegmentedOption> = [
        {
            value: "ativos",
            label: "Ativos",
            icon: <PlayIcon size={14} />,
            count: STORIES_ATIVOS_PLACEHOLDER.length,
        },
        {
            value: "expirados",
            label: "Expirados",
            icon: <ClockIcon size={14} />,
            count: STORIES_EXPIRADOS_PLACEHOLDER.length,
        },
    ];

    // Aplica o filtro corrente. Memoizado para que mudanças de
    // estado fora de filtro não invalidem a lista.
    const filteredItems = React.useMemo(() => {
        if (filtro === "fotos") return items.filter((m) => m.type === "photo");
        if (filtro === "videos") return items.filter((m) => m.type === "video");
        return items;
    }, [filtro, items]);

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
                        <div className="flex items-center gap-2">
                            <IconSegmented
                                options={filterOptions}
                                value={filtro}
                                onChange={(v) => setFiltro(v as Filtro)}
                                aria-label="Filtrar tipo de mídia"
                            />
                            <IconButton
                                onClick={upload.open}
                                icon={<PlusIcon size={20} />}
                                aria-label="Adicionar mídia"
                                tone="primary"
                            />
                        </div>
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

                {/* Conteúdo: grid quando há itens, EmptyState quando vazio. */}
                {filteredItems.length > 0 ? (
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
                        <MediaGrid
                            items={storiesByFilter}
                            onOpen={storiesCarousel.openAt}
                            aspect="portrait"
                        />
                    ) : (
                        <Card padding="none">
                            <EmptyState
                                size="sm"
                                icon={<PlayCircleIcon size={20} />}
                                title={
                                    filtroStory === "ativos"
                                        ? "Sem Stories ativos"
                                        : "Sem Stories expirados"
                                }
                                description={
                                    filtroStory === "ativos"
                                        ? "Os Stories que você publicar aparecem aqui durante 24 horas."
                                        : "Stories expiram após 24 horas e ficam aqui no histórico."
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

            {/* Carrossel de Stories — sempre montado, controla
                visibilidade via `open`. Reusa o mesmo primitivo da
                galeria. Quando o `Sistema_de_Stories` existir, troca
                placeholders por dados reais. */}
            <MediaCarousel
                items={storiesByFilter}
                activeId={storiesCarousel.activeId}
                onActiveChange={storiesCarousel.openAt}
                open={storiesCarousel.open}
                onClose={storiesCarousel.close}
                comments={COMMENTS_PLACEHOLDER}
            />

            {/* Modal de upload de Story. Mesmo primitivo do upload
                de galeria, mas configurado para o fluxo Story:
                aceita foto e vídeo, sem campo de descrição (Stories
                são efêmeros). Endpoint dedicado virá com o
                `Sistema_de_Stories`. */}
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
                showDescription={false}
                onSubmit={async () => {
                    setUploadingStory(true);
                    setStoryUploadError(null);
                    try {
                        // TODO[Sistema_de_Stories]: enviar `result.file`
                        // via POST para `/api/acompanhante/stories`
                        // (endpoint a construir) e `router.refresh()`.
                        // Por ora, fecha o modal sem persistir.
                        await new Promise((r) => setTimeout(r, 400));
                        storyUpload.close();
                    } catch {
                        setStoryUploadError(
                            "Falha ao enviar. Tente novamente.",
                        );
                    } finally {
                        setUploadingStory(false);
                    }
                }}
            />
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
