"use client";

import * as React from "react";
import { useActionState } from "react";

import {
    AtIcon,
    Button,
    Input,
    LockIcon,
    MailIcon,
    PasswordInput,
    UserIcon,
} from "@/components";

import {
    SALVAR_ETAPA_INITIAL,
    asEtapaString,
    type SalvarEtapaState,
} from "../../action-state";
import { salvarEtapaAction } from "../../actions";

/**
 * Step 1 — Identidade do Onboarding_Acompanhante.
 *
 * Coleta `nome`, `email`, `identificador` e `senha` (Requirement 3.1
 * + reuso das regras do Requirement 2 conforme Property 16). O label
 * "Identificador" aparece para o usuário como "Nome de usuário" para
 * deixar claro o uso, mas o campo do form mantém `name="identificador"`
 * para preservar o contrato com a Server Action.
 */

export interface IdentidadeStepProps {
    /** Caminho relativo do próximo step (`/cadastro/acompanhante/2`). */
    nextPath: string;
    /** Eco de valores já salvos no draft, para repopular o form. */
    initialValues: {
        nome: string;
        email: string;
        identificador: string;
    };
}

export function IdentidadeStep({
    nextPath,
    initialValues,
}: IdentidadeStepProps): React.ReactElement {
    const [state, formAction, pending] = useActionState<
        SalvarEtapaState,
        FormData
    >(salvarEtapaAction, SALVAR_ETAPA_INITIAL);

    const fieldErrors = state.fieldErrors ?? {};
    const values = state.values ?? {};

    // Verificação de disponibilidade em tempo real
    const [emailTaken, setEmailTaken] = React.useState(false);
    const [identTaken, setIdentTaken] = React.useState(false);

    async function checkAvailability(
        type: "email" | "identificador",
        value: string,
    ): Promise<void> {
        const trimmed = value.trim();
        if (trimmed.length < 3) {
            if (type === "email") setEmailTaken(false);
            else setIdentTaken(false);
            return;
        }
        try {
            const res = await fetch(
                `/api/check-availability?type=${type}&value=${encodeURIComponent(trimmed)}`,
            );
            if (res.ok) {
                const { available } = (await res.json()) as { available: boolean };
                if (type === "email") setEmailTaken(!available);
                else setIdentTaken(!available);
            }
        } catch {
            // Silencioso — a validação final no finalizar pega de qualquer forma
        }
    }

    return (
        <form action={formAction} className="flex flex-col gap-4" noValidate>
            <input type="hidden" name="_step" value="identidade" />
            <input type="hidden" name="_next" value={nextPath} />

            <Input
                label="Nome completo"
                name="nome"
                type="text"
                autoComplete="name"
                placeholder="Como você se chama?"
                defaultValue={asEtapaString(values.nome) ?? initialValues.nome}
                error={Boolean(fieldErrors.nome)}
                errorMessage={fieldErrors.nome}
                leadingIcon={<UserIcon size={16} />}
                required
            />
            <Input
                label="Email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="seu@email.com"
                defaultValue={asEtapaString(values.email) ?? initialValues.email}
                error={Boolean(fieldErrors.email) || emailTaken}
                errorMessage={
                    fieldErrors.email ??
                    (emailTaken ? "Este email já está em uso." : undefined)
                }
                leadingIcon={<MailIcon size={16} />}
                onBlur={(e) => checkAvailability("email", e.target.value)}
                required
            />
            <Input
                label="Nome de usuário"
                name="identificador"
                type="text"
                autoComplete="username"
                placeholder="seu_usuario"
                defaultValue={
                    asEtapaString(values.identificador) ??
                    initialValues.identificador
                }
                hint="3 a 30 caracteres. Letras, números e underscore."
                error={Boolean(fieldErrors.identificador) || identTaken}
                errorMessage={
                    fieldErrors.identificador ??
                    (identTaken ? "Este nome de usuário já está em uso." : undefined)
                }
                leadingIcon={<AtIcon size={16} />}
                onBlur={(e) => checkAvailability("identificador", e.target.value)}
                required
            />
            <PasswordInput
                label="Senha"
                name="senha"
                autoComplete="new-password"
                placeholder="Crie uma senha"
                hint="Entre 8 e 128 caracteres."
                error={Boolean(fieldErrors.senha)}
                errorMessage={fieldErrors.senha}
                leadingIcon={<LockIcon size={16} />}
                disabled={pending}
                required
            />

            {state.formError ? (
                <p role="alert" className="text-xs text-danger-700">
                    {state.formError}
                </p>
            ) : null}

            <Button type="submit" loading={pending} className="w-full">
                {pending ? "Salvando…" : "Continuar"}
            </Button>
        </form>
    );
}
