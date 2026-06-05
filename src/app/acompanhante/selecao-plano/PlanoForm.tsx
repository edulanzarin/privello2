"use client";

import * as React from "react";
import { useActionState } from "react";

import { ArrowRightIcon, Button, type ButtonVariant } from "@/components";

import {
    comprarPlanoAcompanhanteAction,
    type ComprarPlanoActionError,
} from "./actions";

type FormState = ComprarPlanoActionError | null;

async function reducer(
    _prev: FormState,
    formData: FormData,
): Promise<FormState> {
    const result = await comprarPlanoAcompanhanteAction(formData);
    return result ?? null;
}

/**
 * Props do {@link PlanoForm}.
 */
export interface PlanoFormProps {
    /** Valor do `PlanoTipo` submetido pela action (`BASICO` ou `PREMIUM`). */
    tipo: string;
    /** Rótulo exibido no botão de confirmação. */
    label: string;
    /**
     * Variante visual do botão. Padrão: `"primary"`. Permite à página
     * controlar a hierarquia visual entre cards (ex.: Premium em
     * `primary`, Básico em `secondary`).
     */
    variant?: ButtonVariant;
    /**
     * Quando `true`, o botão fica desabilitado e o formulário não
     * dispara nada. Usado para o cartão do "plano atual" e para
     * downgrades (que o servidor recusaria de qualquer forma).
     */
    disabled?: boolean;
}

/**
 * Formulário client-side de seleção de um plano específico.
 *
 * Cada cartão da página de Selecao_de_Plano renderiza uma instância
 * própria deste componente, permitindo que mensagens de erro fiquem
 * confinadas ao plano clicado.
 */
export function PlanoForm({
    tipo,
    label,
    variant = "primary",
    disabled = false,
}: PlanoFormProps): React.ReactElement {
    const [state, formAction, isPending] = useActionState<FormState, FormData>(
        reducer,
        null,
    );

    const inactive = disabled || isPending;

    return (
        <form action={formAction} className="space-y-2">
            <input type="hidden" name="tipo" value={tipo} />
            <Button
                type="submit"
                size="lg"
                variant={variant}
                className="w-full transition-transform duration-200 ease-spring hover:translate-x-0.5 active:scale-[0.98]"
                loading={isPending}
                disabled={inactive}
            >
                {label}
                {!inactive ? (
                    <ArrowRightIcon
                        size={16}
                        className="transition-transform duration-200 ease-spring group-hover:translate-x-0.5"
                    />
                ) : null}
            </Button>
            {state?.error ? (
                <p
                    role="alert"
                    aria-live="polite"
                    className="text-sm text-danger-600"
                >
                    {state.error}
                </p>
            ) : null}
        </form>
    );
}
