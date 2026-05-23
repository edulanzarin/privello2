"use client";

import * as React from "react";

import { Button } from "./Button";
import { MediaUpload, type MediaSelection } from "./MediaUpload";
import { Modal } from "./Modal";

/**
 * Resultado consolidado entregue por {@link MediaUploadModal} no
 * `onSubmit`. Contém o arquivo selecionado e os campos opcionais que
 * o consumidor pediu (descrição por enquanto; tags etc. podem ser
 * estendidos depois).
 */
export type MediaUploadResult = {
    /** Arquivo nativo a ser enviado ao servidor. */
    file: File;
    /** Tipo discriminado (foto ou vídeo). */
    type: "photo" | "video";
    /**
     * Texto descritivo opcional. Quando o consumidor não habilita
     * o campo via `showDescription`, esta propriedade vem como
     * string vazia.
     */
    description: string;
};

/**
 * Props do {@link MediaUploadModal}.
 *
 * Modal de upload reutilizável para qualquer cenário que envolva
 * "selecionar mídia + enviar": galeria de Acompanhante, Reels,
 * troca de Foto_de_Perfil, anexos em comentários futuros.
 *
 * O componente é controlado:
 * - `open` / `onClose` — estado de visibilidade.
 * - `onSubmit(result)` — chamado quando o usuário confirma. O
 *   consumidor é responsável por enviar ao servidor e fechar o
 *   modal (chamando `onClose` ou alterando `open`).
 *
 * Nenhuma prop carrega nomes de entidades de domínio (Property 29).
 */
export interface MediaUploadModalProps {
    /** Estado controlado de visibilidade. */
    open: boolean;
    /** Callback de fechamento (X, Esc, backdrop). */
    onClose: () => void;
    /**
     * Callback ao confirmar. Recebe o resultado consolidado. O
     * consumidor decide se fecha o modal manualmente após o
     * sucesso/erro do upload.
     */
    onSubmit: (result: MediaUploadResult) => void | Promise<void>;
    /** Título do modal. Padrão: `"Adicionar mídia"`. */
    title?: React.ReactNode;
    /** Subtítulo opcional abaixo do título. */
    subtitle?: React.ReactNode;
    /**
     * Tipos aceitos:
     * - `"photo"`: apenas fotos.
     * - `"video"`: apenas vídeos.
     * - `"any"` (padrão): ambos.
     */
    accept?: "photo" | "video" | "any";
    /** Tamanho máximo em bytes. */
    maxBytes?: number;
    /**
     * Quando `true`, exibe o campo de descrição. Padrão: `true`.
     * Use `false` em fluxos sem descrição (troca de Foto_de_Perfil).
     */
    showDescription?: boolean;
    /** Texto do botão de envio. Padrão: `"Publicar"`. */
    submitLabel?: React.ReactNode;
    /** Quando `true`, o botão de envio mostra estado loading. */
    submitting?: boolean;
    /**
     * Limite de caracteres da descrição. Padrão: `150`. O caller
     * pode passar valor diferente quando o backend impõe outro
     * (ex.: `GALERIA_DESCRICAO_MAX` para galeria de mídia).
     */
    maxDescription?: number;
}

const MAX_DESCRIPTION_DEFAULT = 50;

/**
 * MediaUploadModal — fluxo completo de upload em modal.
 *
 * Combina {@link Modal} (chrome) + {@link MediaUpload} (preview e
 * detecção) + textarea de descrição opcional + botão de envio. O
 * fluxo:
 *
 * 1. Usuário abre o modal (controlado por `open`).
 * 2. Usuário escolhe a mídia (drag/drop ou click). Preview ao vivo.
 * 3. Usuário (opcionalmente) escreve a descrição.
 * 4. Usuário clica "Publicar" → `onSubmit` dispara com o resultado.
 *
 * O componente reseta o estado interno toda vez que o modal abre,
 * para evitar dados velhos de tentativas anteriores.
 */
export function MediaUploadModal({
    open,
    onClose,
    onSubmit,
    title = "Adicionar mídia",
    subtitle,
    accept = "any",
    maxBytes,
    showDescription = true,
    submitLabel = "Publicar",
    submitting = false,
    maxDescription = MAX_DESCRIPTION_DEFAULT,
}: MediaUploadModalProps): React.ReactElement {
    const [selection, setSelection] = React.useState<MediaSelection | null>(
        null,
    );
    const [description, setDescription] = React.useState("");

    // Limpa o estado ao abrir/fechar para que o próximo open sempre
    // comece limpo.
    React.useEffect(() => {
        if (!open) {
            setSelection(null);
            setDescription("");
        }
    }, [open]);

    const canSubmit =
        selection !== null &&
        !submitting &&
        description.length <= maxDescription;

    function handleSubmit(): void {
        if (!canSubmit || selection === null) return;
        void onSubmit({
            file: selection.file,
            type: selection.type,
            description: description.trim(),
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
                <MediaUpload
                    value={selection}
                    onChange={setSelection}
                    accept={accept}
                    maxBytes={maxBytes}
                    disabled={submitting}
                />

                {showDescription ? (
                    <div className="flex flex-col gap-1.5">
                        <label
                            htmlFor="media-upload-description"
                            className="flex items-center justify-between text-xs font-medium text-text-secondary"
                        >
                            <span>Descrição</span>
                            <span
                                className={
                                    description.length > maxDescription
                                        ? "text-danger-700"
                                        : "text-text-disabled"
                                }
                            >
                                {description.length}/{maxDescription}
                            </span>
                        </label>
                        <textarea
                            id="media-upload-description"
                            rows={3}
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            disabled={submitting}
                            placeholder="Conte algo sobre essa mídia. Opcional."
                            className={[
                                "block w-full resize-none rounded-md border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-disabled shadow-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-text-disabled",
                                description.length > maxDescription
                                    ? "border-danger-400 focus-visible:ring-danger-500/30 focus-visible:border-danger-500"
                                    : "border-neutral-200 focus-visible:ring-primary-500/30 focus-visible:border-primary-400",
                            ].join(" ")}
                        />
                    </div>
                ) : null}
            </div>

            {/* Footer fixo com ações */}
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
