"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import {
    Button,
    LocalidadePicker,
    Modal,
    type LocalidadePickerValue,
} from "@/components";

/**
 * Modal de edição da localização da Acompanhante (cidade, UF e
 * bairro opcional). Reusa o {@link LocalidadePicker} primitivo —
 * mesmo que o usuário já viu no onboarding — e envia
 * `POST /api/conta/perfil` com o subset `{ estadoSigla, cidadeNome,
 * bairroNome? }`.
 */
export interface EditarLocalizacaoModalProps {
    open: boolean;
    onClose: () => void;
    inicial: LocalidadePickerValue;
}

export function EditarLocalizacaoModal({
    open,
    onClose,
    inicial,
}: EditarLocalizacaoModalProps): React.ReactElement {
    const router = useRouter();
    const [valor, setValor] = React.useState<LocalidadePickerValue>(inicial);
    const [submitting, setSubmitting] = React.useState(false);
    const [errors, setErrors] = React.useState<Record<string, string>>({});
    const [formError, setFormError] = React.useState<string | null>(null);

    React.useEffect(() => {
        if (!open) {
            setValor(inicial);
            setErrors({});
            setFormError(null);
            setSubmitting(false);
        }
    }, [
        open,
        inicial,
    ]);

    async function handleSubmit(): Promise<void> {
        if (!valor.estadoSigla || !valor.cidadeNome) {
            setFormError("Selecione uma cidade da lista.");
            return;
        }
        setSubmitting(true);
        setErrors({});
        setFormError(null);
        try {
            const res = await fetch("/api/conta/perfil", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    estadoSigla: valor.estadoSigla,
                    cidadeNome: valor.cidadeNome,
                    bairroNome:
                        valor.bairroNome.length > 0
                            ? valor.bairroNome
                            : null,
                }),
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
            title="Editar localização"
            subtitle={
                formError ?? "Sua cidade aparece nas buscas dos Clientes."
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
                className="flex flex-col gap-4 px-5 py-4"
            >
                <LocalidadePicker
                    value={valor}
                    onChange={setValor}
                    disabled={submitting}
                    cidadeError={
                        errors.cidadeNome ?? errors.estadoSigla
                    }
                    bairroError={errors.bairroNome}
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
