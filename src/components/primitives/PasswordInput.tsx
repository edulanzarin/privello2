"use client";

import * as React from "react";

import { EyeIcon, EyeOffIcon } from "../icons";

import { Input, type InputProps } from "./Input";

/**
 * Props do {@link PasswordInput}.
 *
 * Estende {@link InputProps} omitindo as props que o
 * `PasswordInput` controla internamente:
 * - `type` (sempre `"password"` ou `"text"` conforme a visibilidade);
 * - `trailingIcon` (sempre o botão de mostrar/ocultar).
 *
 * Todas as outras props (label, value, onChange, error, leadingIcon,
 * autoComplete, disabled, required, etc.) são repassadas ao Input
 * subjacente, preservando a API completa da Biblioteca_de_Componentes.
 *
 * Nenhuma prop carrega nomes de entidades de domínio (Property 29).
 */
export interface PasswordInputProps
    extends Omit<InputProps, "type" | "trailingIcon"> {
    /**
     * Rótulo acessível do botão de toggle quando a senha está oculta.
     * Padrão: `"Mostrar senha"`.
     */
    showLabel?: string;
    /**
     * Rótulo acessível do botão de toggle quando a senha está visível.
     * Padrão: `"Ocultar senha"`.
     */
    hideLabel?: string;
}

/**
 * PasswordInput — input de senha com toggle de visibilidade.
 *
 * Encapsula o padrão repetido pelas telas de auth/cadastro: um `Input`
 * tipo `password` com um botão de "olho" no `trailingIcon` que alterna
 * entre `password` e `text`.
 *
 * Acessibilidade:
 * - O botão de toggle declara `aria-label` apropriado para o estado
 *   atual (`showLabel`/`hideLabel`).
 * - `aria-pressed` espelha o estado de visibilidade.
 * - Quando `disabled`, o botão sai do tab order (`tabIndex={-1}`) e
 *   ignora cliques.
 */
export function PasswordInput({
    disabled = false,
    showLabel = "Mostrar senha",
    hideLabel = "Ocultar senha",
    ...rest
}: PasswordInputProps): React.ReactElement {
    const [visible, setVisible] = React.useState(false);

    return (
        <Input
            {...rest}
            type={visible ? "text" : "password"}
            disabled={disabled}
            trailingIcon={
                <button
                    type="button"
                    onClick={() => setVisible((prev) => !prev)}
                    className="pointer-events-auto -m-1 rounded p-1 text-text-secondary transition-colors hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/40"
                    aria-label={visible ? hideLabel : showLabel}
                    aria-pressed={visible}
                    tabIndex={disabled ? -1 : 0}
                    disabled={disabled}
                >
                    {visible ? (
                        <EyeOffIcon size={16} />
                    ) : (
                        <EyeIcon size={16} />
                    )}
                </button>
            }
        />
    );
}
