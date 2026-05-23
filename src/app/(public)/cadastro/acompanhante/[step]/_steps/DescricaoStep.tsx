"use client";

import * as React from "react";
import Link from "next/link";
import { useActionState } from "react";

import { Button } from "@/components";

import {
    SALVAR_ETAPA_INITIAL,
    asEtapaString,
    type SalvarEtapaState,
} from "../../action-state";
import { salvarEtapaAction } from "../../actions";

/**
 * Step 4 — Descrição (Requirement 3.9).
 *
 * Texto livre entre 1 e 1000 caracteres. Usamos um `<textarea>` em vez
 * do `Input` da Biblioteca_de_Componentes (que envolve `<input>`),
 * mantendo o restante do formulário consistente. A mensagem de erro
 * abaixo do textarea segue o mesmo padrão de acessibilidade
 * (`role="alert"`, `aria-invalid` e ligação por `aria-describedby`).
 */

export interface DescricaoStepProps {
    nextPath: string;
    previousPath: string | null;
    initialDescricao: string;
}

const MAX_LEN = 1000;

export function DescricaoStep({
    nextPath,
    previousPath,
    initialDescricao,
}: DescricaoStepProps): React.ReactElement {
    const [state, formAction, pending] = useActionState<
        SalvarEtapaState,
        FormData
    >(salvarEtapaAction, SALVAR_ETAPA_INITIAL);

    const fieldErrors = state.fieldErrors ?? {};
    const values = state.values ?? {};
    const error = fieldErrors.descricao;

    const errorId = "descricao-error";
    const hintId = "descricao-hint";

    return (
        <form action={formAction} className="flex flex-col gap-4" noValidate>
            <input type="hidden" name="_step" value="descricao" />
            <input type="hidden" name="_next" value={nextPath} />

            <div className="flex flex-col gap-1.5">
                <label
                    htmlFor="descricao"
                    className="text-xs font-medium text-text-secondary"
                >
                    Descrição
                </label>
                <textarea
                    id="descricao"
                    name="descricao"
                    rows={5}
                    maxLength={MAX_LEN}
                    defaultValue={asEtapaString(values.descricao) ?? initialDescricao}
                    aria-invalid={Boolean(error) || undefined}
                    aria-describedby={
                        error ? errorId : hintId
                    }
                    className={[
                        "block w-full rounded-md border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-disabled shadow-sm transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-text-disabled resize-y",
                        error
                            ? "border-danger-400 focus-visible:ring-danger-500/30 focus-visible:border-danger-500"
                            : "border-neutral-200 focus-visible:ring-primary-500/30 focus-visible:border-primary-400",
                    ].join(" ")}
                    required
                />
                {error ? (
                    <p
                        id={errorId}
                        role="alert"
                        className="text-xs text-danger-700"
                    >
                        {error}
                    </p>
                ) : (
                    <p
                        id={hintId}
                        className="text-xs text-text-secondary"
                    >
                        Entre 1 e {MAX_LEN} caracteres.
                    </p>
                )}
            </div>

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
