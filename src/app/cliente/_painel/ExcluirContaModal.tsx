"use client";

import * as React from "react";

import {
    Button,
    InlineAlert,
    LockIcon,
    Modal,
    PasswordInput,
} from "@/components";

/**
 * Modal de exclusão de conta — Cliente e Acompanhante usam o
 * mesmo (compartilhado via `_painel`). Pede senha atual para
 * reautenticar e exibe aviso destrutivo.
 *
 * Após sucesso, redireciona pra `/` (cookie já foi limpo pela
 * resposta do endpoint).
 */
export interface ExcluirContaModalProps {
    open: boolean;
    onClose: () => void;
}

export function ExcluirContaModal({
    open,
    onClose,
}: ExcluirContaModalProps): React.ReactElement {
    const [password, setPassword] = React.useState("");
    const [confirmText, setConfirmText] = React.useState("");
    const [submitting, setSubmitting] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
        if (!open) {
            setPassword("");
            setConfirmText("");
            setError(null);
            setSubmitting(false);
        }
    }, [open]);

    const canSubmit =
        !submitting && password.length > 0 && confirmText.trim().toUpperCase() === "EXCLUIR";

    async function handleSubmit(): Promise<void> {
        if (!canSubmit) return;
        setSubmitting(true);
        setError(null);
        try {
            const res = await fetch("/api/conta", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password }),
            });
            if (res.status === 401) {
                setError("Senha incorreta.");
                return;
            }
            if (!res.ok) {
                setError("Não foi possível excluir agora. Tente novamente.");
                return;
            }
            // Sucesso — redireciona pra home pública.
            window.location.href = "/";
        } catch {
            setError("Falha de rede. Tente novamente.");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <Modal
            open={open}
            onClose={submitting ? () => undefined : onClose}
            title="Excluir minha conta"
            subtitle="Esta ação é permanente. Não dá pra desfazer."
            size="md"
            dismissOnBackdrop={!submitting}
            dismissOnEsc={!submitting}
        >
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    void handleSubmit();
                }}
                className="flex flex-col gap-4 px-5 py-4"
            >
                <InlineAlert tone="danger">
                    <span className="block text-xs font-medium">
                        O que vai acontecer:
                    </span>
                    <ul className="ml-4 mt-1.5 list-disc text-xs leading-relaxed">
                        <li>Seu perfil será removido publicamente.</li>
                        <li>
                            Fotos, vídeos, áudio e Stories serão apagados do
                            armazenamento.
                        </li>
                        <li>
                            Avaliações, perguntas, curtidas e comentários
                            serão removidos.
                        </li>
                        <li>Sessões ativas serão encerradas.</li>
                    </ul>
                </InlineAlert>

                <PasswordInput
                    label="Senha atual"
                    name="password"
                    autoComplete="current-password"
                    placeholder="Confirme sua senha"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    leadingIcon={<LockIcon size={16} />}
                    disabled={submitting}
                    required
                />

                <div className="flex flex-col gap-1.5">
                    <label
                        htmlFor="confirm-text"
                        className="text-xs font-medium text-text-secondary"
                    >
                        Para confirmar, digite{" "}
                        <span className="font-semibold text-text-primary">
                            EXCLUIR
                        </span>{" "}
                        abaixo:
                    </label>
                    <input
                        id="confirm-text"
                        type="text"
                        autoComplete="off"
                        autoCapitalize="characters"
                        value={confirmText}
                        onChange={(e) => setConfirmText(e.target.value)}
                        disabled={submitting}
                        className="block w-full rounded-md border border-neutral-200 bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-disabled shadow-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-danger-500/30 focus-visible:border-danger-400 disabled:cursor-not-allowed disabled:bg-neutral-50"
                    />
                </div>

                {error !== null ? (
                    <InlineAlert tone="danger">{error}</InlineAlert>
                ) : null}

                <footer className="flex items-center justify-end gap-2 pt-2">
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
                        variant="danger"
                        size="md"
                        loading={submitting}
                        disabled={!canSubmit}
                    >
                        {submitting ? "Excluindo…" : "Excluir minha conta"}
                    </Button>
                </footer>
            </form>
        </Modal>
    );
}
