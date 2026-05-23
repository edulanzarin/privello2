"use client";

import * as React from "react";

import { LockIcon } from "../icons";

import { Button } from "./Button";
import { Modal } from "./Modal";
import { PasswordInput } from "./PasswordInput";

/**
 * Props do {@link PasswordChangeModal}.
 *
 * Modal especializado em troca de senha: campos para senha atual,
 * nova senha e confirmação. Validações no client (preenchimento +
 * comprimento mínimo + match), submissão via `onSubmit`.
 *
 * O componente é controlado em `open`/`onClose`. Quando o consumidor
 * passa `onSubmit`, ele recebe `{ currentPassword, newPassword }` e é
 * responsável por enviar ao servidor. Por padrão, faz `POST
 * /api/conta/senha` com payload JSON e mensagens de erro
 * pré-definidas.
 *
 * Nenhuma prop carrega nomes de entidades de domínio (Property 29).
 */
export interface PasswordChangeModalProps {
    /** Estado controlado de visibilidade. */
    open: boolean;
    /** Callback de fechamento (X, Esc, backdrop). */
    onClose: () => void;
    /**
     * Override do envio. Quando ausente, faz `POST /api/conta/senha`.
     */
    onSubmit?: (input: {
        currentPassword: string;
        newPassword: string;
    }) => Promise<void>;
    /**
     * Callback opcional disparado após o sucesso. Use para invalidar
     * caches ou disparar toasts. Quando ausente, o modal só fecha.
     */
    onSuccess?: () => void;
}

const MIN_LEN = 8;

/**
 * PasswordChangeModal — fluxo de troca de senha em modal.
 *
 * Layout: 3 PasswordInput em coluna + footer com Cancelar/Atualizar.
 * Trava ESC e backdrop durante a submissão para o usuário não
 * perder o que digitou.
 */
export function PasswordChangeModal({
    open,
    onClose,
    onSubmit,
    onSuccess,
}: PasswordChangeModalProps): React.ReactElement {
    const [current, setCurrent] = React.useState("");
    const [next, setNext] = React.useState("");
    const [confirm, setConfirm] = React.useState("");
    const [submitting, setSubmitting] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    // Limpa o estado quando o modal abre/fecha.
    React.useEffect(() => {
        if (!open) {
            setCurrent("");
            setNext("");
            setConfirm("");
            setError(null);
            setSubmitting(false);
        }
    }, [open]);

    function clientValidate(): string | null {
        if (current.length === 0) return "Informe sua senha atual.";
        if (next.length < MIN_LEN)
            return `A nova senha deve ter pelo menos ${MIN_LEN} caracteres.`;
        if (next !== confirm) return "A confirmação não confere.";
        if (next === current)
            return "A nova senha deve ser diferente da atual.";
        return null;
    }

    async function defaultSubmit(input: {
        currentPassword: string;
        newPassword: string;
    }): Promise<void> {
        const res = await fetch("/api/conta/senha", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(input),
        });
        if (!res.ok) {
            const payload = (await res.json().catch(() => null)) as
                | { reason?: string }
                | null;
            const reason = payload?.reason ?? "DESCONHECIDO";
            throw new Error(reasonToMessage(reason));
        }
    }

    async function handleSubmit(): Promise<void> {
        const validationError = clientValidate();
        if (validationError !== null) {
            setError(validationError);
            return;
        }
        setError(null);
        setSubmitting(true);
        try {
            const input = {
                currentPassword: current,
                newPassword: next,
            };
            if (onSubmit !== undefined) {
                await onSubmit(input);
            } else {
                await defaultSubmit(input);
            }
            onClose();
            onSuccess?.();
        } catch (e) {
            setError(
                e instanceof Error
                    ? e.message
                    : "Não foi possível atualizar a senha.",
            );
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <Modal
            open={open}
            onClose={submitting ? () => undefined : onClose}
            title="Trocar senha"
            subtitle={
                error ?? `Mínimo de ${MIN_LEN} caracteres. A nova senha deve ser diferente da atual.`
            }
            size="sm"
            dismissOnBackdrop={!submitting}
            dismissOnEsc={!submitting}
        >
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    void handleSubmit();
                }}
                className="flex flex-col gap-3 px-5 py-4"
            >
                <PasswordInput
                    label="Senha atual"
                    name="currentPassword"
                    autoComplete="current-password"
                    value={current}
                    onChange={(e) => setCurrent(e.target.value)}
                    disabled={submitting}
                    leadingIcon={<LockIcon size={16} />}
                    required
                />
                <PasswordInput
                    label="Nova senha"
                    name="newPassword"
                    autoComplete="new-password"
                    value={next}
                    onChange={(e) => setNext(e.target.value)}
                    disabled={submitting}
                    leadingIcon={<LockIcon size={16} />}
                    hint={`Pelo menos ${MIN_LEN} caracteres.`}
                    required
                />
                <PasswordInput
                    label="Confirmar nova senha"
                    name="confirmPassword"
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    disabled={submitting}
                    leadingIcon={<LockIcon size={16} />}
                    required
                />

                <footer className="flex flex-none items-center justify-end gap-2 pt-2">
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
                        type="submit"
                        variant="primary"
                        size="md"
                        loading={submitting}
                        disabled={submitting}
                    >
                        {submitting ? "Atualizando…" : "Atualizar"}
                    </Button>
                </footer>
            </form>
        </Modal>
    );
}

function reasonToMessage(reason: string): string {
    switch (reason) {
        case "SENHA_INVALIDA":
            return "Senha atual incorreta.";
        case "VALIDACAO":
            return "Verifique os campos e tente novamente.";
        case "NAO_AUTENTICADO":
            return "Sua sessão expirou. Faça login novamente.";
        default:
            return "Não foi possível atualizar a senha.";
    }
}
