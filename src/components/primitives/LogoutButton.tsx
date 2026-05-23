"use client";

import * as React from "react";

import { LinkButton } from "./LinkButton";

/**
 * Props do {@link LogoutButton}.
 *
 * Botão que invoca `POST /api/auth/logout` e redireciona o navegador
 * para `redirectTo` (default: `"/"`). Encerra a sessão tanto no
 * servidor (revoga em `sessions`) quanto no cliente (cookie limpo
 * pelo handler) — ver `src/server/auth/logout.ts`.
 *
 * Centralizar como primitivo evita que cada painel reinvente o
 * `fetch + redirect`. O comportamento é idempotente (chamar o
 * endpoint duas vezes não lança).
 *
 * Nenhuma prop carrega nomes de entidades de domínio (Property 29).
 */
export interface LogoutButtonProps {
    /**
     * URL para onde o navegador é levado após o logout. Padrão: `"/"`.
     */
    redirectTo?: string;
    /** Texto do botão. Padrão: `"Sair"`. */
    label?: React.ReactNode;
    /** Ícone opcional exibido à esquerda do label. */
    icon?: React.ReactNode;
    /**
     * Variante visual:
     *
     * - `"row"` (padrão): linha completa estilo {@link import("./InfoRow").InfoRow},
     *   com ícone tonal `danger`, texto à esquerda e seta à direita. Combina
     *   com listas de configurações.
     * - `"button"`: botão pequeno com borda fina e hover destacado em
     *   `danger`. Use em headers (ex.: como `actions` do
     *   {@link import("./ProfileHeader").ProfileHeader}).
     */
    variant?: "row" | "button";
    /** Classes extras aplicadas ao container. */
    className?: string;
}

/**
 * LogoutButton — encerra a sessão e redireciona.
 *
 * Lida com:
 * - Estado `pending` (desabilita durante a requisição).
 * - Falha silenciosa: o endpoint é idempotente, então mesmo erro
 *   transitório de rede não impede o redirect (a sessão fica
 *   revogada por TTL e o cookie já é descartado quando o usuário
 *   chega na home não autenticada).
 */
export function LogoutButton({
    redirectTo = "/",
    label = "Sair",
    icon,
    variant = "row",
    className,
}: LogoutButtonProps): React.ReactElement {
    const [pending, setPending] = React.useState(false);

    async function handleLogout(): Promise<void> {
        if (pending) return;
        setPending(true);
        try {
            await fetch("/api/auth/logout", { method: "POST" });
        } catch {
            // Idempotente — segue para o redirect mesmo em falha de rede.
        }
        // Navegação completa para o middleware ver a ausência do cookie.
        window.location.href = redirectTo;
    }

    if (variant === "button") {
        return (
            <LinkButton
                tone="danger"
                onClick={handleLogout}
                disabled={pending}
                icon={icon ?? <DefaultLogoutIcon />}
                collapseToIcon
                aria-label={pending ? "Saindo" : "Sair"}
                className={className}
            >
                {pending ? "Saindo…" : label}
            </LinkButton>
        );
    }

    // variant = "row"
    const rowClass = [
        "group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-150 hover:bg-danger-50/50 focus-visible:bg-danger-50/60 focus-visible:outline-none disabled:opacity-60",
        className ?? "",
    ]
        .filter(Boolean)
        .join(" ");
    return (
        <button
            type="button"
            onClick={handleLogout}
            disabled={pending}
            className={rowClass}
        >
            <span
                aria-hidden="true"
                className="inline-flex h-8 w-8 flex-none items-center justify-center rounded-full bg-danger-50 text-danger-600"
            >
                {icon ?? <DefaultLogoutIcon />}
            </span>
            <span className="flex min-w-0 flex-1 text-sm font-medium text-danger-700">
                {pending ? "Saindo…" : label}
            </span>
            <span
                aria-hidden="true"
                className="text-xs font-medium text-danger-400 transition-colors group-hover:text-danger-600"
            >
                ›
            </span>
        </button>
    );
}

/**
 * Ícone default — porta com seta de saída. Inline para evitar que o
 * primitivo dependa de um ícone específico do pack autoral, mantendo
 * o LogoutButton consumível mesmo se o pack mudar.
 */
function DefaultLogoutIcon(): React.ReactElement {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.25"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <path d="M9 5H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h3" />
            <path d="m16 17 5-5-5-5" />
            <path d="M21 12H10" />
        </svg>
    );
}
