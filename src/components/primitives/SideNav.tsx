"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Logo } from "./Logo";
import { isNavItemActive, type BottomNavItem } from "./BottomNav";

/**
 * Props do {@link SideNav}.
 *
 * Navegação lateral vertical para desktop (≥lg). Reusa o mesmo
 * {@link BottomNavItem} do {@link import("./BottomNav").BottomNav} —
 * a heurística de "rota ativa" é compartilhada via
 * {@link isNavItemActive}, então mobile e desktop ficam consistentes.
 *
 * Nenhuma prop carrega nomes de entidades de domínio (Property 29).
 */
export interface SideNavProps {
    /** Lista de itens, na ordem em que serão exibidos. */
    items: ReadonlyArray<BottomNavItem>;
    /** Slot opcional renderizado no rodapé da sidebar (ex.: sino). */
    footer?: React.ReactNode;
    /** Classes extras aplicadas ao `<aside>` (ex.: `hidden lg:flex`). */
    className?: string;
}

/**
 * SideNav — barra de navegação lateral fixa para desktop.
 *
 * Espelha o {@link import("./BottomNav").BottomNav} em formato
 * vertical: logo no topo, itens empilhados (ícone + label lado a
 * lado), e um slot opcional de rodapé. Fica `sticky` ocupando a
 * altura total da viewport.
 *
 * Pensado para ser renderizado pelo {@link import("./AppShell").AppShell}
 * apenas em `lg+` (o consumidor passa `className="hidden lg:flex"`),
 * enquanto o BottomNav some no mesmo breakpoint.
 *
 * Acessibilidade:
 * - `<nav aria-label="Navegação lateral">`.
 * - Item ativo recebe `aria-current="page"`.
 * - Ícones decorativos (`aria-hidden`); o `label` é o nome acessível.
 */
export function SideNav({
    items,
    footer,
    className,
}: SideNavProps): React.ReactElement {
    const pathname = usePathname() ?? "";

    return (
        <aside
            aria-label="Navegação lateral"
            className={[
                "sticky top-0 z-30 h-screen w-60 flex-col border-r border-[var(--hairline)] bg-[rgba(251,249,246,0.94)] px-3 py-5",
                className ?? "",
            ]
                .filter(Boolean)
                .join(" ")}
        >
            <div className="flex items-center px-2 pb-6">
                <Link
                    href="/"
                    aria-label="Início"
                    className="rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ec7b5b]/40"
                >
                    <Logo />
                </Link>
            </div>

            <nav className="flex-1">
                <ul className="flex flex-col gap-1">
                    {items.map((item) => {
                        const isActive = isNavItemActive(pathname, item);
                        return (
                            <li key={item.href}>
                                <Link
                                    href={item.href}
                                    aria-current={
                                        isActive ? "page" : undefined
                                    }
                                    className={[
                                        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-200",
                                        isActive
                                            ? "bg-[#fff0eb] text-[color:var(--accent-deep)]"
                                            : "text-text-secondary hover:bg-[#ec7b5b]/8 hover:text-text-primary",
                                    ].join(" ")}
                                >
                                    <span
                                        aria-hidden="true"
                                        className="flex flex-none items-center justify-center"
                                    >
                                        {isActive
                                            ? item.activeIcon ?? item.icon
                                            : item.icon}
                                    </span>
                                    <span className="truncate">
                                        {item.label}
                                    </span>
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            </nav>

            {footer != null ? (
                <div className="mt-auto border-t border-[var(--hairline)] px-1 pt-4">
                    {footer}
                </div>
            ) : null}
        </aside>
    );
}
