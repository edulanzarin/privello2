"use client";

import * as React from "react";

import { Button } from "./Button";
import { Modal } from "./Modal";

/**
 * Tom da ação principal do {@link ConfirmDialog}.
 *
 * - `"primary"`: confirmação positiva ("Salvar", "Continuar").
 * - `"danger"`: ação destrutiva ("Excluir", "Encerrar conta").
 *   Aplica `Button variant="danger"` no botão de confirmação.
 */
export type ConfirmTone = "primary" | "danger";

/**
 * Props do {@link ConfirmDialog}.
 *
 * Modal pequeno (`size="sm"`) com título, descrição e dois botões:
 * cancelar e confirmar. Reusa o {@link Modal} primitivo, herdando
 * Esc/backdrop/scroll-lock. Usado para qualquer ação que precisa de
 * "tem certeza?": apagar mídia, encerrar conta, descartar
 * rascunho, sair sem salvar.
 *
 * Componente controlado: o consumidor decide quando abrir/fechar e
 * o que fazer no `onConfirm`. Quando `loading` é `true`, ambos os
 * botões ficam desabilitados e o de confirmar mostra spinner.
 *
 * Nenhuma prop carrega nomes de entidades de domínio (Property 29).
 */
export interface ConfirmDialogProps {
    open: boolean;
    onClose: () => void;
    onConfirm: () => void | Promise<void>;
    /** Título no topo do modal. */
    title: React.ReactNode;
    /** Texto descritivo abaixo do título. */
    description?: React.ReactNode;
    /** Tom da ação principal. Padrão: `"primary"`. */
    tone?: ConfirmTone;
    /** Texto do botão de confirmar. Padrão: `"Confirmar"`. */
    confirmLabel?: React.ReactNode;
    /** Texto do botão de cancelar. Padrão: `"Cancelar"`. */
    cancelLabel?: React.ReactNode;
    /** Quando `true`, desabilita os botões e aplica spinner. */
    loading?: boolean;
}

/**
 * ConfirmDialog — modal pequeno de confirmação.
 *
 * Layout: título + descrição em coluna, footer com botões alinhados
 * à direita. Em mobile o botão de confirmar fica abaixo do
 * cancelar para reforçar a ordem visual.
 */
export function ConfirmDialog({
    open,
    onClose,
    onConfirm,
    title,
    description,
    tone = "primary",
    confirmLabel = "Confirmar",
    cancelLabel = "Cancelar",
    loading = false,
}: ConfirmDialogProps): React.ReactElement {
    return (
        <Modal
            open={open}
            onClose={loading ? () => undefined : onClose}
            title={title}
            size="sm"
            dismissOnBackdrop={!loading}
            dismissOnEsc={!loading}
        >
            {description != null ? (
                <div className="px-5 py-4">
                    <p className="text-sm leading-relaxed text-text-secondary">
                        {description}
                    </p>
                </div>
            ) : null}
            <footer className="flex flex-none flex-col-reverse items-stretch gap-2 border-t border-[color:var(--hairline)] px-5 py-3 sm:flex-row sm:items-center sm:justify-end">
                <Button
                    type="button"
                    variant="ghost"
                    size="md"
                    onClick={onClose}
                    disabled={loading}
                >
                    {cancelLabel}
                </Button>
                <Button
                    type="button"
                    variant={tone === "danger" ? "danger" : "primary"}
                    size="md"
                    onClick={() => void onConfirm()}
                    loading={loading}
                >
                    {confirmLabel}
                </Button>
            </footer>
        </Modal>
    );
}
