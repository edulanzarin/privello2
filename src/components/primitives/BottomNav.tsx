"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Item exibido pelo {@link BottomNav}.
 *
 * Cada item carrega um `href` (destino da navegação), um `label`
 * textual exibido abaixo do ícone e um par de ícones inativo/ativo.
 * O `match` permite controlar a heurística de "rota ativa": quando
 * presente, o item é considerado ativo se o pathname atual estiver
 * em `match`. Caso contrário, a comparação cai em prefixo do `href`.
 *
 * Nenhuma prop carrega nomes de entidades de domínio (Property 29).
 */
export interface BottomNavItem {
    href: string;
    label: string;
    /** Ícone exibido no estado inativo. */
    icon: React.ReactNode;
    /**
     * Ícone exibido no estado ativo. Quando ausente, reusa `icon` com
     * tom de cor diferente.
     */
    activeIcon?: React.ReactNode;
    /**
     * Lista de pathnames adicionais que devem marcar este item como
     * ativo. O `href` em si já entra na comparação.
     */
    match?: readonly string[];
}

export interface BottomNavProps {
    /** Lista de itens, na ordem em que serão exibidos. */
    items: ReadonlyArray<BottomNavItem>;
}

/**
 * BottomNav — barra de navegação inferior persistente.
 *
 * Visível em mobile e desktop (deliberadamente; simplifica e segue o
 * padrão de apps modernos). Em desktop ocupa a largura total da tela e
 * é centralizada via container interno.
 *
 * Acessibilidade:
 * - `<nav role="navigation" aria-label="Navegação principal">`.
 * - O item ativo recebe `aria-current="page"`.
 * - Ícones decorativos (`aria-hidden="true"`); o texto do `label` é o
 *   nome acessível do link.
 */
export function BottomNav({ items }: BottomNavProps): React.ReactElement {
    const pathname = usePathname() ?? "";

    return (
        <nav
            aria-label="Navegação principal"
            className="sticky bottom-0 z-30"
            style={{
                // Glass mais suave que o `glass-bar` (que era forte
                // demais no rodapé): fundo quase sólido + blur leve,
                // pra o conteúdo atrás não vazar competindo com os
                // ícones.
                background: "rgba(251, 249, 246, 0.94)",
                backdropFilter: "blur(8px)",
                WebkitBackdropFilter: "blur(8px)",
                borderTop: "1px solid var(--hairline)",
                borderBottom: "none",
            }}
        >
            <ul className="mx-auto flex max-w-3xl items-stretch">
                {items.map((item) => {
                    const isActive = matchesItem(pathname, item);
                    return (
                        <li key={item.href} className="flex-1">
                            <Link
                                href={item.href}
                                aria-current={isActive ? "page" : undefined}
                                className={[
                                    "relative flex h-16 flex-col items-center justify-center gap-1 text-[0.65rem] font-medium tracking-tight transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/40",
                                    isActive
                                        ? "text-[color:var(--accent-deep)]"
                                        : "text-text-disabled hover:text-text-primary",
                                ].join(" ")}
                            >
                                {/* Accent dot acima do ícone, só
                                    quando ativo. */}
                                {isActive ? (
                                    <span
                                        aria-hidden="true"
                                        className="absolute top-2 h-1 w-1 rounded-full bg-[color:var(--accent)]"
                                    />
                                ) : null}
                                <span aria-hidden="true">
                                    {isActive
                                        ? item.activeIcon ?? item.icon
                                        : item.icon}
                                </span>
                                <span>{item.label}</span>
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </nav>
    );
}

/**
 * Decide se o item está ativo dado o `pathname` atual. A regra é:
 *
 * - Match exato com `href`: ativo.
 * - Pathname listado em `match`: ativo.
 * - Pathname começa com `href + "/"`: ativo (cobre rotas filhas).
 *
 * O caso especial de `"/"` é tratado para que apenas o pathname
 * exatamente igual a `"/"` ative o item raiz, evitando que ele "engula"
 * todas as rotas.
 */
function matchesItem(pathname: string, item: BottomNavItem): boolean {
    if (item.match?.includes(pathname)) {
        return true;
    }
    if (item.href === "/") {
        return pathname === "/";
    }
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
