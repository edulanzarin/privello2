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
    LinkButton,
    MicIcon,
    PencilIcon,
    SectionHeader,
    TrashIcon,
    useModal,
    useToast,
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
    /**
     * TopicAudios já gravados — áudios curtos por tópico (T07).
     * Map `topicKind → { url, mimeType }`. Tópicos sem entrada
     * mostram "gravar" no UI.
     */
    topicAudios?: ReadonlyArray<{
        topicKind: string;
        url: string;
        mimeType: string;
    }>;
}

export function AudioTab({
    audioUrl,
    audioMimeType,
    topicAudios = [],
}: AudioTabProps): React.ReactElement {
    const router = useRouter();
    const toast = useToast();
    const recordModal = useModal();
    const deleteDialog = useModal();
    const [submitting, setSubmitting] = React.useState(false);
    const [deleting, setDeleting] = React.useState(false);
    const [deleteError, setDeleteError] = React.useState<string | null>(null);

    // -----------------------------------------------------------------
    // TopicAudios — modal compartilhado, controla qual tópico abriu.
    // -----------------------------------------------------------------
    const [topicAtivo, setTopicAtivo] = React.useState<string | null>(null);
    const [topicSubmitting, setTopicSubmitting] = React.useState(false);

    const topicMap = React.useMemo(() => {
        const m = new Map<string, { url: string; mimeType: string }>();
        for (const t of topicAudios) {
            m.set(t.topicKind, { url: t.url, mimeType: t.mimeType });
        }
        return m;
    }, [topicAudios]);

    async function handleSubmit(result: AudioRecordResult): Promise<void> {
        setSubmitting(true);
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
                toast.danger(reasonToMessage(payload?.reason ?? "DESCONHECIDO"));
                return;
            }
            recordModal.close();
            router.refresh();
        } catch {
            toast.danger("Falha ao enviar. Tente novamente.");
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

    async function handleTopicSubmit(
        topicKind: string,
        result: AudioRecordResult,
    ): Promise<void> {
        setTopicSubmitting(true);
        try {
            const formData = new FormData();
            const ext = extFromMime(result.mimeType);
            const fileName = `topic.${ext}`;
            const file = new File([result.blob], fileName, {
                type: result.mimeType,
            });
            formData.append("audio", file);
            const res = await fetch(
                `/api/acompanhante/audio/topic/${encodeURIComponent(topicKind.toLowerCase())}`,
                { method: "POST", body: formData },
            );
            if (!res.ok) {
                const payload = (await res.json().catch(() => null)) as
                    | { reason?: string }
                    | null;
                toast.danger(reasonToMessage(payload?.reason ?? "DESCONHECIDO"));
                return;
            }
            setTopicAtivo(null);
            router.refresh();
        } catch {
            toast.danger("Falha ao enviar. Tente novamente.");
        } finally {
            setTopicSubmitting(false);
        }
    }

    async function handleTopicDelete(topicKind: string): Promise<void> {
        try {
            const res = await fetch(
                `/api/acompanhante/audio/topic/${encodeURIComponent(topicKind.toLowerCase())}`,
                { method: "DELETE" },
            );
            if (!res.ok) return;
            router.refresh();
        } catch {
            // best-effort
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

            <AudioRecordModal
                open={recordModal.isOpen}
                onClose={() => {
                    recordModal.close();
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

            {/* TopicAudios — áudios curtos por tópico (T07).
                Acompanhante grava ≤30s respondendo perguntas comuns
                ("Preço", "Atende casal?", "Disponibilidade" etc).
                Aparecem como FAQ sonora no perfil público. */}
            <SectionHeader
                title="Perguntas frequentes em áudio"
                subtitle="Grave respostas curtas (até 30s) para as perguntas mais comuns. Vão aparecer como FAQ sonora no seu perfil."
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {TOPIC_AUDIO_OPTIONS.map((opt) => {
                    const existente = topicMap.get(opt.kind) ?? null;
                    return (
                        <Card key={opt.kind}>
                            <div className="flex flex-col gap-2.5">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-sm font-semibold text-text-primary">
                                        {opt.label}
                                    </span>
                                    {existente !== null ? (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                void handleTopicDelete(opt.kind);
                                            }}
                                            className="text-[0.65rem] text-text-secondary hover:text-danger-700 focus:outline-none"
                                        >
                                            Remover
                                        </button>
                                    ) : null}
                                </div>
                                {existente !== null ? (
                                    <AudioWavePlayer
                                        src={existente.url}
                                        mimeType={existente.mimeType}
                                        aria-label={`Áudio de ${opt.label}`}
                                    />
                                ) : null}
                                <Button
                                    type="button"
                                    variant={
                                        existente !== null ? "ghost" : "primary"
                                    }
                                    size="sm"
                                    onClick={() => {
                                        setTopicAtivo(opt.kind);
                                    }}
                                >
                                    <MicIcon size={12} />
                                    {existente !== null ? "Regravar" : "Gravar"}
                                </Button>
                            </div>
                        </Card>
                    );
                })}
            </div>

            <AudioRecordModal
                open={topicAtivo !== null}
                onClose={() => {
                    setTopicAtivo(null);
                }}
                onSubmit={async (result) => {
                    if (topicAtivo === null) return;
                    await handleTopicSubmit(topicAtivo, result);
                }}
                submitting={topicSubmitting}
                title={
                    topicAtivo !== null
                        ? `Gravar áudio: ${TOPIC_AUDIO_LABEL_MAP[topicAtivo] ?? topicAtivo}`
                        : "Gravar áudio"
                }
                minSeconds={3}
                maxSeconds={30}
            />
        </div>
    );
}

const TOPIC_AUDIO_OPTIONS: ReadonlyArray<{ kind: string; label: string }> = [
    { kind: "PRECO", label: "Preço" },
    { kind: "CASAL", label: "Atende casal?" },
    { kind: "DISPONIBILIDADE", label: "Disponibilidade" },
    { kind: "LOCAL", label: "Local de atendimento" },
    { kind: "PRATICAS", label: "Práticas" },
    { kind: "PAGAMENTO", label: "Pagamento" },
];

const TOPIC_AUDIO_LABEL_MAP: Record<string, string> = TOPIC_AUDIO_OPTIONS.reduce(
    (acc, opt) => {
        acc[opt.kind] = opt.label;
        return acc;
    },
    {} as Record<string, string>,
);

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
