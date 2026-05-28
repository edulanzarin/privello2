"use client";

import * as React from "react";
import { useActionState } from "react";

import { ArrowRightIcon, Button, type ButtonVariant } from "@/components";

import {
    comprarFanClienteAction,
    selecionarPlanoClienteAction,
    type SelecionarPlanoClienteActionError,
} from "./actions";

type FormState = SelecionarPlanoClienteActionError | null;

async function selecionarReducer(
    _prev: FormState,
    formData: FormData,
): Promise<FormState> {
    const result = await selecionarPlanoClienteAction(formData);
    return result ?? null;
}

async function comprarReducer(
    _prev: FormState,
    formData: FormData,
): Promise<FormState> {
    const result = await comprarFanClienteAction(formData);
    return result ?? null;
}

export interface PlanoClienteFormProps {
    /** Valor submetido — `tipo` ou `duracao` dependendo do `mode`. */
    value: string;
    /**
     * Modo de submit:
     *   - `"selecionar"`: chama {@link selecionarPlanoClienteAction}.
     *     Usado pra `GRATIS`.
     *   - `"comprar"`: chama {@link comprarFanClienteAction}. Usado
     *     pras 3 durações de Fan.
     */
    mode: "selecionar" | "comprar";
    /** Rótulo exibido no botão. */
    label: string;
    /** Variante visual do botão. Padrão: `"primary"`. */
    variant?: ButtonVariant;
    /** Quando `true`, botão fica desabilitado (plano atual). */
    disabled?: boolean;
}

/**
 * Formulário client-side de seleção/compra de plano de Cliente.
 *
 * Cada `OfferCard` da página de seleção renderiza uma instância
 * própria desta forma, permitindo que mensagens de erro fiquem
 * confinadas ao card clicado.
 */
export function PlanoForm({
    value,
    mode,
    label,
    variant = "primary",
    disabled = false,
}: PlanoClienteFormProps): React.ReactElement {
    const [state, formAction, isPending] = useActionState<FormState, FormData>(
        mode === "comprar" ? comprarReducer : selecionarReducer,
        null,
    );

    const inactive = disabled || isPending;
    const inputName = mode === "comprar" ? "duracao" : "tipo";

    return (
        <form action={formAction} className="space-y-2">
            <input type="hidden" name={inputName} value={value} />
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
