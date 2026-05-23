"use client";

import * as React from "react";

import { Button } from "./Button";
import { AudioRecorder, type AudioRecording } from "./AudioRecorder";
import { Modal } from "./Modal";

/**
 * Resultado consolidado entregue por {@link AudioRecordModal} no
 * `onSubmit`. Contém o blob da gravação e metadados úteis para o
 * caller construir o `FormData` do upload.
 */
export type AudioRecordResult = {
    /** Blob do áudio. */
    blob: Blob;
    /** MIME type efetivo (pode incluir `;codecs=...`). */
    mimeType: string;
    /** Duração medida em segundos. */
    durationSeconds: number;
};

/**
 * Props do {@link AudioRecordModal}.
 *
 * Modal de gravação de áudio reutilizável. Espelha a API de
 * {@link import("./MediaUploadModal").MediaUploadModal} (mesmo
 * shape `open/onClose/onSubmit`, mesmo estilo de footer com
 * Cancelar/Enviar) para que callers troquem entre os dois sem
 * reescrever orquestração.
 *
 * O fluxo:
 * 1. Usuário abre o modal (controlado por `open`).
 * 2. {@link AudioRecorder} cuida do start/stop/preview.
 * 3. Usuário clica "Enviar" → `onSubmit` dispara com o resultado.
 *
 * Reseta o estado interno toda vez que o modal abre, evitando
 * vazar gravações antigas entre aberturas.
 *
 * Nenhuma prop carrega nomes de entidades de domínio (Property 29).
 */
export interface AudioRecordModalProps {
    /** Estado controlado de visibilidade. */
    open: boolean;
    /** Callback de fechamento (X, Esc, backdrop). */
    onClose: () => void;
    /** Callback ao confirmar com gravação válida. */
    onSubmit: (result: AudioRecordResult) => void | Promise<void>;
    /** Título do modal. Padrão: `"Gravar áudio"`. */
    title?: React.ReactNode;
    /** Subtítulo opcional abaixo do título. */
    subtitle?: React.ReactNode;
    /** Duração mínima em segundos. Padrão: 10. */
    minSeconds?: number;
    /** Duração máxima em segundos. Padrão: 60. */
    maxSeconds?: number;
    /** Quando `true`, mostra estado loading no botão de envio. */
    submitting?: boolean;
    /** Texto do botão de envio. Padrão: `"Enviar"`. */
    submitLabel?: React.ReactNode;
}

/**
 * AudioRecordModal — fluxo completo de gravação em modal.
 */
export function AudioRecordModal({
    open,
    onClose,
    onSubmit,
    title = "Gravar áudio",
    subtitle,
    minSeconds = 10,
    maxSeconds = 60,
    submitting = false,
    submitLabel = "Enviar",
}: AudioRecordModalProps): React.ReactElement {
    const [recording, setRecording] = React.useState<AudioRecording | null>(
        null,
    );

    React.useEffect(() => {
        if (!open) {
            // Limpa qualquer gravação pendente quando o modal fecha.
            if (recording?.previewUrl) {
                URL.revokeObjectURL(recording.previewUrl);
            }
            setRecording(null);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const canSubmit = recording !== null && !submitting;

    function handleSubmit(): void {
        if (!canSubmit || recording === null) return;
        void onSubmit({
            blob: recording.blob,
            mimeType: recording.mimeType,
            durationSeconds: recording.durationSeconds,
        });
    }

    return (
        <Modal
            open={open}
            onClose={submitting ? () => undefined : onClose}
            title={title}
            subtitle={subtitle}
            size="md"
            dismissOnBackdrop={!submitting}
            dismissOnEsc={!submitting}
        >
            <div className="flex flex-col gap-4 px-5 py-4">
                <AudioRecorder
                    value={recording}
                    onChange={setRecording}
                    minSeconds={minSeconds}
                    maxSeconds={maxSeconds}
                    disabled={submitting}
                />
            </div>

            <footer className="flex flex-none items-center justify-end gap-2 border-t border-neutral-200 px-5 py-3">
                <Button
                    type="button"
                    variant="ghost"
                    size="md"
                    onClick={onClose}
                    disabled={submitting}
                >
                    Cancelar
                </Button>
                <Button
                    type="button"
                    variant="primary"
                    size="md"
                    onClick={handleSubmit}
                    disabled={!canSubmit}
                    loading={submitting}
                >
                    {submitting ? "Enviando…" : submitLabel}
                </Button>
            </footer>
        </Modal>
    );
}
