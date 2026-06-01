"use client";

import * as React from "react";

import { LockIcon, PencilIcon } from "../icons";

/**
 * Props do {@link InfoRow}.
 *
 * Linha densa "ícone · rótulo · valor · ação" usada em painéis para
 * exibir e (quando aplicável) editar campos do usuário. Substitui o
 * padrão `<li>` repetido em PerfilTab/ConfiguracoesTab e padroniza a
 * affordance de edição em todo o produto.
 *
 * Estados:
 * - **read-only** (padrão): só exibe o valor.
 * - **editable**: exibe um lápis sutil à direita; clique chama
 *   `onEdit` ou navega para `editHref`. Hover destaca a linha.
 * - **locked**: exibe um cadeado discreto à direita, indicando que o
 *   campo é imutável (ex.: `@username` único, email após verificação).
 *   Tooltip via `lockedReason`.
 *
 * Nenhuma prop carrega nomes de entidades de domínio (Property 29).
 */
export interface InfoRowProps {
    /** Ícone tonal exibido em círculo à esquerda. Opcional. */
    icon?: React.ReactNode;
    /** Rótulo do campo. */
    label: React.ReactNode;
    /** Valor do campo. */
    value: React.ReactNode;
    /**
     * Quando fornecido, a linha vira interativa: hover destacado,
     * cursor pointer, ícone de lápis à direita. O callback é
     * disparado no clique e na tecla Enter/Space.
     */
    onEdit?: () => void;
    /**
     * Alternativa a `onEdit`: vira a linha em um `<a>` para um link
     * de edição. Use para navegação para uma sub-rota
     * (`/cliente/conta/email`, por exemplo).
     */
    editHref?: string;
    /**
     * Quando `true`, marca a linha como imutável (ícone de cadeado).
     * Tem prioridade sobre `onEdit`/`editHref`. Padrão: `false`.
     */
    locked?: boolean;
    /**
     * Texto exibido como `title` no ícone de cadeado, explicando por
     * que o campo está travado. Default: `"Campo não editável"`.
     */
    lockedReason?: string;
    /**
     * Quando `true`, o `label` fica visualmente oculto (mantido como
     * `aria-label` para leitores de tela). Útil quando o `icon` já
     * comunica o tipo do campo e o espaço é estreito (mobile,
     * cabeçalhos densos).
     */
    hideLabel?: boolean;
    /** Classes extras aplicadas ao container. */
    className?: string;
}

/**
 * InfoRow — linha de informação com affordance de edição opcional.
 *
 * Visual: ícone tonal `primary-50` à esquerda, rótulo em uppercase
 * pequeno, valor à direita em peso medium. Quando editável, hover
 * pinta o fundo e revela o lápis. Quando bloqueado, mantém um
 * cadeadinho discreto sempre visível.
 */
export function InfoRow({
    icon,
    label,
    value,
    onEdit,
    editHref,
    locked = false,
    lockedReason = "Campo não editável",
    hideLabel = false,
    className,
}: InfoRowProps): React.ReactElement {
    const isInteractive = !locked && (onEdit !== undefined || editHref !== undefined);

    const composed = [
        "group flex items-center gap-3 px-4 py-3 transition-colors duration-150",
        isInteractive
            ? "cursor-pointer hover:bg-accent-soft/60 focus-visible:bg-accent-soft/70 focus-visible:outline-none"
            : "",
        className ?? "",
    ]
        .filter(Boolean)
        .join(" ");

    const inner = (
        <>
            {icon != null ? (
                <span
                    aria-hidden="true"
                    className="inline-flex h-8 w-8 flex-none items-center justify-center rounded-full bg-accent-soft text-accent-deep"
                >
                    {icon}
                </span>
            ) : null}
            <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                <span
                    className={
                        hideLabel
                            ? "sr-only"
                            : "text-xs uppercase tracking-wider text-text-secondary"
                    }
                >
                    {label}
                </span>
                <span
                    className={[
                        "truncate text-sm font-medium text-text-primary",
                        hideLabel ? "flex-1 text-left" : "",
                    ]
                        .filter(Boolean)
                        .join(" ")}
                >
                    {value}
                </span>
            </div>
            {locked ? (
                <span
                    aria-label={lockedReason}
                    title={lockedReason}
                    className="inline-flex h-6 w-6 flex-none items-center justify-center rounded-full text-text-disabled"
                >
                    <LockIcon size={12} />
                </span>
            ) : isInteractive ? (
                <span
                    aria-hidden="true"
                    className="inline-flex h-6 w-6 flex-none items-center justify-center rounded-full text-text-disabled transition-colors group-hover:bg-accent-soft group-hover:text-accent-deep group-focus-visible:bg-accent-soft group-focus-visible:text-accent-deep"
                >
                    <PencilIcon size={12} />
                </span>
            ) : null}
        </>
    );

    if (locked) {
        return (
            <div aria-disabled="true" className={composed}>
                {inner}
            </div>
        );
    }

    if (editHref !== undefined) {
        return (
            <a href={editHref} className={composed}>
                {inner}
            </a>
        );
    }

    if (onEdit !== undefined) {
        return (
            <button
                type="button"
                onClick={onEdit}
                className={`${composed} w-full text-left`}
            >
                {inner}
            </button>
        );
    }

    return <div className={composed}>{inner}</div>;
}
