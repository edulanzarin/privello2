"use client";

import * as React from "react";

import { CheckIcon } from "../icons";

/**
 * Props do {@link ComboboxOption}.
 *
 * Item de dropdown com três estados visuais combináveis:
 *
 * - `active`: realce de "ponto atual" (hover do mouse OU navegação
 *   por teclado). Fundo `primary-50`.
 * - `selected`: marca de "valor escolhido" (apenas em selects fixos
 *   tipo `<Select>`; autocompletes de texto livre não usam). Texto
 *   em `primary-700` + check icon à direita.
 * - desabilitado: `disabled` impede clique e atenua o item.
 *
 * Os três estados se compõem livremente (um item pode ser `active`
 * e `selected` ao mesmo tempo, por exemplo).
 *
 * Nenhuma prop carrega nomes de entidades de domínio (Property 29).
 */
export interface ComboboxOptionProps {
    /** Conteúdo principal do item (texto/ReactNode). */
    children: React.ReactNode;
    /** Acionado por click ou Enter. */
    onClick?: () => void;
    /**
     * Notifica quando o mouse entra no item, geralmente para que o
     * pai sincronize o `activeIndex` com a posição do cursor.
     */
    onMouseEnter?: () => void;
    /** Realce de "ponto atual". Padrão: `false`. */
    active?: boolean;
    /**
     * Marca de "valor selecionado" (uso em `<Select>`). Quando
     * `true`, exibe check icon à direita e tinge o texto.
     */
    selected?: boolean;
    /** Quando `true`, atenua e impede o clique. */
    disabled?: boolean;
    /**
     * Conteúdo opcional renderizado à esquerda (tipicamente um
     * ícone de domínio, ex.: pin de mapa nas listas de cidade).
     */
    leading?: React.ReactNode;
}

/**
 * ComboboxOption — linha de dropdown reusada por `Select` e por
 * autocompletes (cidade, bairro). Centraliza hover, foco de teclado
 * e marcação de "selecionado" para que qualquer ajuste visual passe
 * por um único arquivo.
 */
export function ComboboxOption({
    children,
    onClick,
    onMouseEnter,
    active = false,
    selected = false,
    disabled = false,
    leading,
}: ComboboxOptionProps): React.ReactElement {
    const cls = [
        "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
        // Active e hover compartilham o mesmo realce (`bg-primary-50`)
        // para que a navegação por mouse e teclado pareça idêntica.
        // Quando `active` é true (vindo do estado do pai, ex.: tecla
        // ArrowDown), o realce já está aplicado; o `hover:` cobre o
        // caso do mouse sem que o pai precise sincronizar.
        active
            ? "bg-accent-soft text-text-primary"
            : "text-text-primary hover:bg-accent-soft/60",
        selected ? "font-medium text-accent-deep" : "",
    ]
        .filter(Boolean)
        .join(" ");

    return (
        <li>
            <button
                type="button"
                role="option"
                aria-selected={selected}
                aria-disabled={disabled || undefined}
                disabled={disabled}
                onClick={disabled ? undefined : onClick}
                onMouseEnter={onMouseEnter}
                className={cls}
            >
                {leading != null ? (
                    <span
                        aria-hidden="true"
                        className="flex h-4 w-4 flex-none items-center justify-center text-text-disabled"
                    >
                        {leading}
                    </span>
                ) : null}
                <span className="flex-1 truncate">{children}</span>
                {selected ? (
                    <span
                        aria-hidden="true"
                        className="flex h-4 w-4 flex-none items-center justify-center text-accent-deep"
                    >
                        <CheckIcon size={14} />
                    </span>
                ) : null}
            </button>
        </li>
    );
}
