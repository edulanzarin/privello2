"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import {
    Button,
    Input,
    Modal,
    UserIcon,
    type ModalProps,
} from "@/components";

/**
 * Modal de edição do perfil do Cliente.
 *
 * Concentra todos os campos editáveis em um único formulário (hoje:
 * apenas `nome`; `@username` e email são imutáveis). O usuário
 * altera o que quiser e confirma uma vez. Faz `POST /api/conta/perfil`
 * com o patch parcial e dispara `router.refresh()` no sucesso.
 *
 * Específico do painel do Cliente porque o conjunto de campos varia
 * entre Cliente e Acompanhante. A versão da Acompanhante vive em
 * `src/app/acompanhante/_painel/EditarPerfilModal.tsx`.
 */
export interface EditarPerfilModalProps {
    open: ModalProps["open"];
    onClose: ModalProps["onClose"];
    inicial: {
        nome: string;
    };
}

export function EditarPerfilModal({
    open,
    onClose,
    inicial,
}: EditarPerfilModalProps): React.ReactElement {
    const router = useRouter();
    const [nome, setNome] = React.useState(inicial.nome);
    const [submitting, setSubmitting] = React.useState(false);
    const [errors, setErrors] = React.useState<Record<string, string>>({});
    const [formError, setFormError] = React.useState<string | null>(null);

    React.useEffect(() => {
        if (!open) {
            setNome(inicial.nome);
            setErrors({});
            setFormError(null);
            setSubmitting(false);
        }
    }, [open, inicial.nome]);

    async function handleSubmit(): Promise<void> {
        setSubmitting(true);
        setErrors({});
        setFormError(null);
        try {
            const res = await fetch("/api/conta/perfil", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ nome }),
            });
            const payload = (await res.json().catch(() => null)) as
                | {
                    ok?: boolean;
                    reason?: string;
                    detalhes?: Record<string, string>;
                }
                | null;

            if (!res.ok || !payload?.ok) {
                if (payload?.detalhes) setErrors(payload.detalhes);
                else
                    setFormError(
                        "Não foi possível salvar. Tente novamente.",
                    );
                return;
            }

            onClose();
            router.refresh();
        } catch {
            setFormError("Falha de rede. Tente novamente.");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <Modal
            open={open}
            onClose={submitting ? () => undefined : onClose}
            title="Editar perfil"
            subtitle={
                formError ?? "Atualize seus dados. Email e usuário não podem ser alterados."
            }
            size="md"
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
                <Input
                    label="Nome"
                    name="nome"
                    autoComplete="name"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    disabled={submitting}
                    leadingIcon={<UserIcon size={16} />}
                    error={Boolean(errors.nome)}
                    errorMessage={errors.nome}
                    required
                />

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
                        variant="primary"
                        size="md"
                        loading={submitting}
                        disabled={submitting}
                    >
                        {submitting ? "Salvando…" : "Salvar"}
                    </Button>
                </footer>
            </form>
        </Modal>
    );
}
