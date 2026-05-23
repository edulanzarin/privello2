"use client";

import * as React from "react";
import { useActionState } from "react";

import { ArrowRightIcon, Button, type ButtonVariant } from "@/components";

import {
    selecionarPlanoClienteAction,
    type SelecionarPlanoClienteActionError,
} from "./actions";

/**
 * Estado renderizado pelo formulário da seleção de plano de Cliente.
 *
 * Estrutura idêntica ao formulário da Acompanhante; vive em arquivo
 * separado porque cada um chama uma Server Action diferente
 * (`selecionar` em `@/server/planos-cliente` vs `@/server/planos`).
 */
type FormState = SelecionarPlanoClienteActionError | null;

async function reducer(
    _prev: FormState,
    formData: FormData,
): Promise<FormState> {
    const result = await selecionarPlanoClienteAction(formData);
    return result ?? null;
}

export interface PlanoClienteFormProps {
    /** Valor do `PlanoClienteTipo` submetido (`GRATIS` ou `FAN`). */
    tipo: string;
    /** Rótulo exibido no botão de confirmação. */
    label: string;
    /** Variante visual do botão. Padrão: `"primary"`. */
    variant?: ButtonVariant;
    /**
     * Quando `true`, o botão fica desabilitado e o formulário não
     * dispara nada. Usado para o cartão do "plano atual" e para
     * downgrades (que o servidor recusaria de qualquer forma).
     */
    disabled?: boolean;
}

/**
 * Formulário client-side de seleção de um plano específico de Cliente.
 *
 * Cada {@link import("@/components").OfferCard} da página de seleção
 * renderiza uma instância própria deste componente, permitindo que
 * mensagens de erro fiquem confinadas ao card clicado.
 */
export function PlanoForm({
    tipo,
    label,
    variant = "primary",
    disabled = false,
}: PlanoClienteFormProps): React.ReactElement {
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
