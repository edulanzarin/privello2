"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import {
    AudioRecordModal,
    AudioWavePlayer,
    Button,
    Card,
    ConfirmDialog,
    EmptyState,
    InlineAlert,
    LinkButton,
    MicIcon,
    PencilIcon,
    SectionHeader,
    TrashIcon,
    useModal,
    type AudioRecordResult,
} from "@/components";

/**
 * Aba "Áudio" do painel da Acompanhante.
 *
 * Disponível apenas para `Plano_Premium` (`permiteAudio === true`).
 * A página `acompanhante/page.tsx` decide se renderiza esta aba.
 *
 * # UX
 *
 * - Sem áudio gravado: {@link EmptyState} convida a gravar. Botão
 *   primário abre {@link AudioRecordModal}.
 * - Com áudio gravado: {@link Card} branco com `<audio controls>`,
 *   botão "Regravar" (abre o mesmo modal — substituirá o áudio
 *   atual) e botão de excluir (com {@link ConfirmDialog}).
 *
 * # Backend
 *
 * - `POST /api/acompanhante/audio` — substitui o áudio (cria nova
 *   `Media` AUDIO, marca antiga como DELETED, atualiza
 *   `audioApresentacaoId`).
 * - `DELETE /api/acompanhante/audio` — zera `audioApresentacaoId` e
 *   marca a Media como DELETED.
 *
 * Ambos disparam `router.refresh()` no sucesso para a página
 * pai re-buscar `audioUrl` do `obterPerfilAcompanhante`.
 */
export interface AudioTabProps {
    /** URL pública do áudio atual, ou `null`. */
    audioUrl: string | null;
    /** MIME type do áudio (usado em `<audio type>` quando presente). */
    audioMimeType: string | null;
}

export function AudioTab({
    audioUrl,
    audioMimeType,
}: AudioTabProps): React.ReactElement {
    const router = useRouter();
    const recordModal = useModal();
    const deleteDialog = useModal();
    const [submitting, setSubmitting] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [deleting, setDeleting] = React.useState(false);
    const [deleteError, setDeleteError] = React.useState<string | null>(null);

    async function handleSubmit(result: AudioRecordResult): Promise<void> {
        setSubmitting(true);
        setError(null);
        try {
            const formData = new FormData();
            const ext = extFromMime(result.mimeType);
            const fileName = `audio.${ext}`;
            const file = new File([result.blob], fileName, {
                type: result.mimeType,
            });
            formData.append("audio", file);
            const res = await fetch("/api/acompanhante/audio", {
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
            recordModal.close();
            router.refresh();
        } catch {
            setError("Falha ao enviar. Tente novamente.");
        } finally {
            setSubmitting(false);
        }
    }

    async function handleDelete(): Promise<void> {
        setDeleting(true);
        setDeleteError(null);
        try {
            const res = await fetch("/api/acompanhante/audio", {
                method: "DELETE",
            });
            if (!res.ok) {
                setDeleteError(
                    "Não foi possível excluir agora. Tente novamente.",
                );
                return;
            }
            deleteDialog.close();
            router.refresh();
        } catch {
            setDeleteError("Falha de rede. Tente novamente.");
        } finally {
            setDeleting(false);
        }
    }

    return (
        <div className="flex flex-col gap-3">
            <SectionHeader
                title="Ouça minha voz"
                subtitle="Grave um áudio curto. Os Clientes verão um botão de play no seu perfil."
                trailing={
                    audioUrl !== null ? (
                        <LinkButton
                            onClick={recordModal.open}
                            icon={<PencilIcon size={12} />}
                            aria-label="Regravar áudio"
                        >
                            Regravar
                        </LinkButton>
                    ) : null
                }
            />

            {audioUrl !== null ? (
                <Card>
                    <div className="flex flex-col gap-3">
                        <AudioWavePlayer
                            src={audioUrl}
                            mimeType={audioMimeType ?? undefined}
                            aria-label="Reproduzir áudio de apresentação"
                        />
                        <div className="flex items-center justify-end gap-2">
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={deleteDialog.open}
                                disabled={deleting}
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
                        icon={<MicIcon size={20} />}
                        title="Nenhum áudio gravado"
                        description="Grave entre 10 segundos e 1 minuto. Você ouve antes de enviar."
                        action={
                            <Button
                                type="button"
                                variant="primary"
                                size="md"
                                onClick={recordModal.open}
                            >
                                <MicIcon size={14} />
                                Gravar áudio
                            </Button>
                        }
                    />
                </Card>
            )}

            {error !== null ? (
                <InlineAlert tone="danger">{error}</InlineAlert>
            ) : null}

            <AudioRecordModal
                open={recordModal.isOpen}
                onClose={() => {
                    recordModal.close();
                    setError(null);
                }}
                onSubmit={handleSubmit}
                submitting={submitting}
                title={audioUrl !== null ? "Regravar áudio" : "Gravar áudio"}
            />

            <ConfirmDialog
                open={deleteDialog.isOpen}
                onClose={() => {
                    deleteDialog.close();
                    setDeleteError(null);
                }}
                onConfirm={handleDelete}
                title="Excluir áudio"
                description={
                    deleteError ??
                    "O áudio será removido do seu perfil. Você pode gravar outro depois."
                }
                tone="danger"
                confirmLabel="Excluir"
                loading={deleting}
            />
        </div>
    );
}

/**
 * Deriva a extensão do arquivo a partir do MIME informado pelo
 * `MediaRecorder`. Usado só para nomear o `File` que vai no
 * `FormData` — o servidor revalida e escolhe a extensão real
 * gravada em R2 via `audioApresentacaoExt`.
 */
function extFromMime(mime: string): string {
    const main = mime.toLowerCase().split(";")[0]?.trim();
    switch (main) {
        case "audio/webm":
            return "webm";
        case "audio/ogg":
            return "ogg";
        case "audio/mp4":
            return "m4a";
        case "audio/mpeg":
            return "mp3";
        case "audio/wav":
            return "wav";
        default:
            return "webm";
    }
}

function reasonToMessage(reason: string): string {
    switch (reason) {
        case "AUDIO_INVALIDO":
            return "Áudio inválido. Tente regravar.";
        case "PLANO_INVALIDO":
            return "Áudio é exclusivo do Premium.";
        case "SEM_PLANO":
            return "Selecione um plano para gravar áudio.";
        case "TIPO_INVALIDO":
            return "Esta conta não pode gravar áudio.";
        case "NAO_AUTENTICADO":
            return "Sua sessão expirou. Faça login novamente.";
        case "AUDIO_NAO_ENCONTRADO":
            return "Áudio não encontrado.";
        default:
            return "Não foi possível enviar o áudio. Tente novamente.";
    }
}
