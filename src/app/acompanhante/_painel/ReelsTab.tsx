"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import {
    Avatar,
    Button,
    Card,
    ConfirmDialog,
    EmptyState,
    HeartIcon,
    InlineAlert,
    LinkButton,
    MediaThumbnail,
    MediaUploadModal,
    PlayCircleIcon,
    SectionHeader,
    TrashIcon,
    useModal,
    type MediaUploadResult,
} from "@/components";

/**
 * Item de Reel exibido na grade do painel privado.
 */
export interface ReelTabItem {
    id: string;
    storageKey: string;
    posterStorageKey: string | null;
    durationSeconds: number | null;
    caption: string | null;
    createdAt: Date | string;
    likesCount: number;
    commentsCount: number;
}

export interface ReelsTabProps {
    /** Reels já publicados pela Acompanhante (mais novos primeiro). */
    items: ReadonlyArray<ReelTabItem>;
    /** Limite atual do plano (`Infinity` para Premium). */
    limite: number;
}

/**
 * Aba "Reels" do painel da Acompanhante.
 *
 * Lista os Reels publicados em grade vertical 9:16 e oferece o
 * fluxo de publicar (upload de vídeo) + excluir.
 *
 * # Validações client-side
 *
 * Antes de subir o arquivo, lemos a duração via `HTMLVideoElement`
 * em background. Recusa se for menor que 5s ou maior que 90s,
 * evitando round-trip desnecessário. O servidor revalida.
 */
export function ReelsTab({
    items,
    limite,
}: ReelsTabProps): React.ReactElement {
    const router = useRouter();
    const upload = useModal();
    const [submitting, setSubmitting] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    const [pendingDeleteId, setPendingDeleteId] = React.useState<string | null>(
        null,
    );
    const [deleting, setDeleting] = React.useState(false);
    const deleteDialog = useModal();

    const atingiuLimite =
        Number.isFinite(limite) && items.length >= limite;

    /**
     * Extrai a duração de um arquivo de vídeo em segundos. Cria um
     * `<video>` em memória, espera o `loadedmetadata` e devolve
     * `videoElement.duration`. Rejeita se o navegador não conseguir
     * decodificar.
     */
    function extrairDuracao(file: File): Promise<number> {
        return new Promise((resolve, reject) => {
            const url = URL.createObjectURL(file);
            const video = document.createElement("video");
            video.preload = "metadata";
            video.muted = true;
            video.playsInline = true;
            video.onloadedmetadata = () => {
                URL.revokeObjectURL(url);
                if (Number.isFinite(video.duration)) {
                    resolve(video.duration);
                } else {
                    reject(new Error("Duração inválida"));
                }
            };
            video.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error("Falha ao decodificar vídeo"));
            };
            video.src = url;
        });
    }

    async function handleSubmit(result: MediaUploadResult): Promise<void> {
        if (result.type !== "video") {
            setError("Reels aceita só vídeo.");
            return;
        }
        setSubmitting(true);
        setError(null);

        let duracao: number;
        try {
            duracao = await extrairDuracao(result.file);
        } catch {
            setSubmitting(false);
            setError(
                "Não conseguimos ler esse vídeo. Tente outro arquivo.",
            );
            return;
        }

        if (duracao < 5 || duracao > 90) {
            setSubmitting(false);
            setError(
                "Vídeo precisa ter entre 5 e 90 segundos.",
            );
            return;
        }

        try {
            const formData = new FormData();
            formData.append("video", result.file);
            formData.append("duration", String(Math.floor(duracao)));
            if (result.description.trim().length > 0) {
                formData.append("caption", result.description);
            }
            const res = await fetch("/api/acompanhante/reels", {
                method: "POST",
                body: formData,
            });
            if (!res.ok) {
                const payload = (await res.json().catch(() => null)) as
                    | { reason?: string }
                    | null;
                setError(reasonToMessage(payload?.reason ?? "DESCONHECIDO"));
                return;
            }
            upload.close();
            router.refresh();
        } catch {
            setError("Falha de rede. Tente novamente.");
        } finally {
            setSubmitting(false);
        }
    }

    function pedirExclusao(id: string): void {
        setPendingDeleteId(id);
        deleteDialog.open();
    }

    async function handleDelete(): Promise<void> {
        if (pendingDeleteId === null) return;
        setDeleting(true);
        try {
            const res = await fetch(
                `/api/acompanhante/reels/${pendingDeleteId}`,
                { method: "DELETE" },
            );
            if (!res.ok) {
                setError("Não foi possível excluir agora. Tente novamente.");
                return;
            }
            deleteDialog.close();
            setPendingDeleteId(null);
            router.refresh();
        } catch {
            setError("Falha de rede.");
        } finally {
            setDeleting(false);
        }
    }

    return (
        <div className="flex flex-col gap-4">
            <SectionHeader
                title="Reels"
                subtitle="Vídeos curtos (5 a 90s) que aparecem no feed público de Reels."
                trailing={
                    !atingiuLimite ? (
                        <Button
                            type="button"
                            variant="primary"
                            size="sm"
                            onClick={() => {
                                setError(null);
                                upload.open();
                            }}
                        >
                            Publicar
                        </Button>
                    ) : null
                }
            />

            {atingiuLimite ? (
                <InlineAlert tone="warning">
                    Você atingiu o limite de {limite} Reels do seu plano.
                    Exclua um existente ou faça upgrade pra Premium.
                </InlineAlert>
            ) : null}

            {error !== null ? (
                <InlineAlert tone="danger">{error}</InlineAlert>
            ) : null}

            {items.length === 0 ? (
                <Card padding="none">
                    <EmptyState
                        icon={<PlayCircleIcon size={20} />}
                        title="Nenhum Reel publicado"
                        description="Publique vídeos curtos pra aparecer no feed de descobertas."
                        action={
                            <Button
                                type="button"
                                variant="primary"
                                size="md"
                                onClick={() => {
                                    setError(null);
                                    upload.open();
                                }}
                            >
                                Publicar Reel
                            </Button>
                        }
                    />
                </Card>
            ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                    {items.map((reel) => (
                        <ReelTile
                            key={reel.id}
                            reel={reel}
                            onDelete={() => pedirExclusao(reel.id)}
                        />
                    ))}
                </div>
            )}

            <MediaUploadModal
                open={upload.isOpen}
                onClose={() => {
                    upload.close();
                    setError(null);
                }}
                onSubmit={handleSubmit}
                title="Publicar Reel"
                subtitle="Vídeo entre 5 e 90 segundos. A capa é o primeiro frame."
                accept="video"
                showDescription
                maxDescription={200}
                descriptionLabel="Legenda"
                descriptionPlaceholder="Conte algo sobre o vídeo. Opcional."
                submitting={submitting}
            />

            <ConfirmDialog
                open={deleteDialog.isOpen}
                onClose={() => {
                    deleteDialog.close();
                    setPendingDeleteId(null);
                }}
                onConfirm={handleDelete}
                title="Excluir Reel"
                description="O vídeo sai do feed imediatamente. Histórico de likes e comentários é preservado."
                tone="danger"
                confirmLabel="Excluir"
                loading={deleting}
            />
        </div>
    );
}

/**
 * Tile individual de um Reel — capa 9:16 + métricas + botão de
 * excluir. Reusa `MediaThumbnail` pra manter o visual coerente
 * com a galeria.
 */
function ReelTile({
    reel,
    onDelete,
}: {
    reel: ReelTabItem;
    onDelete: () => void;
}): React.ReactElement {
    const previewUrl = reel.posterStorageKey
        ? `/api/storage/${reel.posterStorageKey}`
        : `/api/storage/${reel.storageKey}`;

    return (
        <Card padding="none" className="overflow-hidden">
            <div className="relative aspect-[9/16] bg-neutral-200">
                {reel.posterStorageKey ? (
                    // Poster estático extraído no upload — leve.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={previewUrl}
                        alt={reel.caption ?? "Reel"}
                        className="h-full w-full object-cover"
                    />
                ) : (
                    // Sem poster: tag <video> mostra o primeiro frame
                    // mesmo sem play.
                    <video
                        src={previewUrl}
                        muted
                        playsInline
                        preload="metadata"
                        className="h-full w-full object-cover"
                    />
                )}
                {/* Indicador de duração no canto. */}
                {reel.durationSeconds !== null ? (
                    <span className="absolute bottom-1.5 right-1.5 rounded-full bg-black/60 px-2 py-0.5 text-[0.65rem] font-semibold text-white backdrop-blur-sm">
                        {formatDuration(reel.durationSeconds)}
                    </span>
                ) : null}
            </div>

            <div className="flex items-center justify-between gap-2 px-2 py-1.5">
                <span className="inline-flex items-center gap-1 text-xs text-text-secondary">
                    <HeartIcon size={11} />
                    {reel.likesCount}
                </span>
                <LinkButton
                    onClick={onDelete}
                    icon={<TrashIcon size={11} />}
                    tone="danger"
                    aria-label="Excluir Reel"
                >
                    Excluir
                </LinkButton>
            </div>
        </Card>
    );
}

function formatDuration(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Avoid TS error for unused export when only types are reused.
 */
const _unused = Avatar;
void _unused;

function reasonToMessage(reason: string): string {
    switch (reason) {
        case "MIDIA_INVALIDA":
            return "Esse formato de vídeo não é aceito. Use MP4, WebM ou MOV.";
        case "DURACAO_INVALIDA":
            return "O vídeo precisa ter entre 5 e 90 segundos.";
        case "CAPTION_INVALIDA":
            return "Legenda muito longa. Máximo 200 caracteres.";
        case "PLANO_NAO_PERMITE":
            return "Seu plano não permite publicar Reels.";
        case "LIMITE_ATIVOS":
            return "Você atingiu o limite de Reels do seu plano.";
        case "SEM_PLANO":
            return "Selecione um plano para publicar Reels.";
        case "PLANO_INVALIDO":
            return "Plano vigente não permite Reels.";
        case "TIPO_INVALIDO":
            return "Esta conta não pode publicar Reels.";
        case "NAO_AUTENTICADO":
            return "Sua sessão expirou. Faça login novamente.";
        default:
            return "Não foi possível publicar o Reel. Tente novamente.";
    }
}
