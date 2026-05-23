"use client";

import * as React from "react";
import Link from "next/link";
import { useActionState } from "react";

import { Button, Input, PhoneIcon } from "@/components";

import {
    SALVAR_ETAPA_INITIAL,
    asEtapaString,
    type SalvarEtapaState,
} from "../../action-state";
import { salvarEtapaAction } from "../../actions";

/**
 * Step 2 — Telefone (Requirement 3.8).
 *
 * Aceita números brasileiros com DDD. A normalização para
 * somente-dígitos é feita pela Server Action via
 * `normalizarTelefone`; aqui apenas exibimos um hint de máscara.
 */

export interface TelefoneStepProps {
    nextPath: string;
    /** Caminho do passo anterior (sempre presente em step 2..6). */
    previousPath: string | null;
    /** Telefone já salvo no draft (em formato somente-dígitos). */
    initialTelefone: string;
}

export function TelefoneStep({
    nextPath,
    previousPath,
    initialTelefone,
}: TelefoneStepProps): React.ReactElement {
    const [state, formAction, pending] = useActionState<
        SalvarEtapaState,
        FormData
    >(salvarEtapaAction, SALVAR_ETAPA_INITIAL);

    const fieldErrors = state.fieldErrors ?? {};
    const values = state.values ?? {};

    /**
     * Formata visualmente para (XX) XXXXX-XXXX conforme digita.
     * Só aceita dígitos; o valor enviado ao servidor continua sendo
     * a string formatada, mas `normalizarTelefone` na action já
     * extrai só os dígitos antes de persistir.
     */
    function formatPhone(raw: string): string {
        const digits = raw.replace(/\D/g, "").slice(0, 11);
        if (digits.length === 0) return "";
        if (digits.length <= 2) return `(${digits}`;
        if (digits.length <= 7)
            return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
        return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    }

    const [displayValue, setDisplayValue] = React.useState(() =>
        formatPhone(asEtapaString(values.telefone) ?? initialTelefone),
    );

    function handleChange(e: React.ChangeEvent<HTMLInputElement>): void {
        setDisplayValue(formatPhone(e.target.value));
    }

    return (
        <form action={formAction} className="flex flex-col gap-4" noValidate>
            <input type="hidden" name="_step" value="telefone" />
            <input type="hidden" name="_next" value={nextPath} />

            <Input
                label="Telefone"
                name="telefone"
                type="tel"
                autoComplete="tel"
                inputMode="tel"
                placeholder="(47) 98801-2328"
                value={displayValue}
                onChange={handleChange}
                hint="Pode ser alterado depois nas configurações."
                error={Boolean(fieldErrors.telefone)}
                errorMessage={fieldErrors.telefone}
                leadingIcon={<PhoneIcon size={16} />}
                required
            />

            {state.formError ? (
                <p role="alert" className="text-xs text-danger-700">
                    {state.formError}
                </p>
            ) : null}

            <div className="mt-2 flex items-center justify-between gap-3">
                {previousPath !== null ? (
                    <Link
                        href={previousPath}
                        className="text-xs font-medium text-text-secondary hover:text-text-primary"
                    >
                        ← Voltar
                    </Link>
                ) : (
                    <span />
                )}
                <Button type="submit" loading={pending}>
                    {pending ? "Salvando…" : "Continuar"}
                </Button>
            </div>
        </form>
    );
}
