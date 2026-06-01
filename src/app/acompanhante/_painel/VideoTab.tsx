"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import {
    Button,
    Card,
    ConfirmDialog,
    EmptyState,
    InlineAlert,
    LinkButton,
    PencilIcon,
    PlayCircleIcon,
    SectionHeader,
    TrashIcon,
    VideoPlayer,
    useModal,
} from "@/components";

/**
 * Aba "Vídeo" do painel da Acompanhante.
 *
 * Disponível apenas pra `Plano_Premium` (`permiteAudio === true`,
 * mesmo gate do áudio). Sobe um vídeo curto (5–60s) que aparece
 * em destaque no perfil público.
 *
 * # UX
 *
 * - Sem vídeo: {@link EmptyState} convida a fazer upload via input
 *   file. Validação do MIME e duração no client.
 * - Com vídeo: `<video>` controlado + botão "Substituir" e
 *   excluir.
 */
export interface VideoTabProps {
    videoUrl: string | null;
    videoMimeType: string | null;
    videoPosterUrl: string | null;
}

const VIDEO_MIME_ACEITO = ["video/mp4", "video/webm", "video/quicktime"];
const DURACAO_MAX_S = 60;
const DURACAO_MIN_S = 5;

export function VideoTab({
    videoUrl,
    videoMimeType,
    videoPosterUrl,
}: VideoTabProps): React.ReactElement {
    const router = useRouter();
    const deleteDialog = useModal();
    const [submitting, setSubmitting] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [deleting, setDeleting] = React.useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    function abrirSeletor(): void {
        setError(null);
        fileInputRef.current?.click();
    }

    async function handleFile(file: File): Promise<void> {
        if (!VIDEO_MIME_ACEITO.includes(file.type)) {
            setError("Formato não aceito. Use MP4, WebM ou MOV.");
            return;
        }

        // Mede duração no client antes de subir.
        const duration = await medirDuracao(file).catch(() => null);
        if (duration === null) {
            setError("Não foi possível ler o vídeo. Tente outro arquivo.");
            return;
        }
        if (duration < DURACAO_MIN_S || duration > DURACAO_MAX_S) {
            setError(
                `Duração inválida. Use entre ${DURACAO_MIN_S}s e ${DURACAO_MAX_S}s.`,
            );
            return;
        }

        setSubmitting(true);
        try {
            const formData = new FormData();
            formData.append("video", file);
            const res = await fetch(
                `/api/acompanhante/video-apresentacao?duration=${duration.toFixed(
                    2,
                )}`,
                { method: "PUT", body: formData },
            );
            if (!res.ok) {
                const payload = (await res.json().catch(() => null)) as
                    | { reason?: string }
                    | null;
                setError(reasonToMessage(payload?.reason ?? "DESCONHECIDO"));
                return;
            }
            router.refresh();
        } catch {
            setError("Falha ao enviar. Tente novamente.");
        } finally {
            setSubmitting(false);
        }
    }

    async function handleDelete(): Promise<void> {
        setDeleting(true);
        try {
            const res = await fetch("/api/acompanhante/video-apresentacao", {
                method: "DELETE",
            });
            if (!res.ok) {
                setError("Não foi possível excluir agora.");
                return;
            }
            deleteDialog.close();
            router.refresh();
        } catch {
            setError("Falha de rede. Tente novamente.");
        } finally {
            setDeleting(false);
        }
    }

    return (
        <div className="flex flex-col gap-3">
            <SectionHeader
                title="Vídeo de apresentação"
                subtitle="Vídeo curto (5–60s) em destaque no seu perfil público."
                trailing={
                    videoUrl !== null ? (
                        <LinkButton
                            onClick={abrirSeletor}
                            icon={<PencilIcon size={12} />}
                            disabled={submitting}
                        >
                            Substituir
                        </LinkButton>
                    ) : null
                }
            />

            {videoUrl !== null ? (
                <Card>
                    <div className="flex flex-col gap-3">
                        <VideoPlayer
                            src={videoUrl}
                            mimeType={videoMimeType ?? undefined}
                            posterUrl={videoPosterUrl}
                            label="Seu vídeo de apresentação"
                        />
                        <div className="flex items-center justify-end gap-2">
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={deleteDialog.open}
                                disabled={deleting || submitting}
                            >
                                <TrashIcon size={14} />
                                Excluir
                            </Button>
                        </div>
                    </div>
                </Card>
            ) : (
                <Card padding="none">
                    <EmptyState
                        size="sm"
                        icon={<PlayCircleIcon size={20} />}
                        title="Nenhum vídeo enviado"
                        description={`Envie um vídeo curto entre ${DURACAO_MIN_S}s e ${DURACAO_MAX_S}s. MP4, WebM ou MOV.`}
                        action={
                            <Button
                                type="button"
                                variant="primary"
                                size="md"
                                onClick={abrirSeletor}
                                disabled={submitting}
                            >
                                <PlayCircleIcon size={14} />
                                {submitting ? "Enviando…" : "Enviar vídeo"}
                            </Button>
                        }
                    />
                </Card>
            )}

            {error !== null ? (
                <InlineAlert tone="danger">{error}</InlineAlert>
            ) : null}

            <input
                ref={fileInputRef}
                type="file"
                accept="video/mp4,video/webm,video/quicktime"
                className="hidden"
                onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                        void handleFile(file);
                    }
                    // Reseta o input pra permitir re-enviar o mesmo arquivo.
                    e.target.value = "";
                }}
            />

            <ConfirmDialog
                open={deleteDialog.isOpen}
                onClose={deleteDialog.close}
                onConfirm={handleDelete}
                title="Excluir vídeo"
                description="O vídeo será removido do seu perfil. Você pode subir outro depois."
                tone="danger"
                confirmLabel="Excluir"
                loading={deleting}
            />
        </div>
    );
}

/** Mede a duração do vídeo lendo metadata via `<video>` invisível. */
function medirDuracao(file: File): Promise<number> {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const video = document.createElement("video");
        video.preload = "metadata";
        video.onloadedmetadata = () => {
            URL.revokeObjectURL(url);
            resolve(video.duration);
        };
        video.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error("metadata error"));
        };
        video.src = url;
    });
}

function reasonToMessage(reason: string): string {
    switch (reason) {
        case "VIDEO_INVALIDO":
            return "Vídeo inválido. Tente outro arquivo.";
        case "DURACAO_INVALIDA":
            return `Duração precisa estar entre ${DURACAO_MIN_S}s e ${DURACAO_MAX_S}s.`;
        case "PLANO_INVALIDO":
            return "Vídeo de apresentação é exclusivo do Premium.";
        case "SEM_PLANO":
            return "Selecione um plano para enviar vídeo.";
        case "TIPO_INVALIDO":
            return "Esta conta não pode enviar vídeo.";
        case "NAO_AUTENTICADO":
            return "Sua sessão expirou. Faça login novamente.";
        case "VIDEO_NAO_ENCONTRADO":
        case "PERFIL_NAO_ENCONTRADO":
            return "Vídeo não encontrado.";
        case "RATE_LIMITED":
            return "Você enviou muitos arquivos seguidos. Espere um pouco.";
        default:
            return "Não foi possível enviar o vídeo. Tente novamente.";
    }
}
