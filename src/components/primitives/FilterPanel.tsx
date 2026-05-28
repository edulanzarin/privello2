"use client";

import * as React from "react";

import { ChevronLeftIcon, XIcon } from "../icons";

import { LinkButton } from "./LinkButton";

/**
 * Props do {@link FilterPanel}.
 *
 * Container reutilizável para painel lateral de filtros em listagens.
 * Em desktop (lg+) renderiza como sidebar inline ocupando coluna
 * própria; em mobile vira drawer overlay deslizando da esquerda
 * quando `open` for `true`. O caller controla o estado de
 * visibilidade.
 *
 * Caller passa as seções de filtro como `children` — o componente
 * só fornece o chrome (header com título, botão de fechar, botão de
 * "limpar tudo" opcional, footer com CTA de aplicar/fechar).
 *
 * Nenhum nome de domínio nas props (Property 29).
 */
export interface FilterPanelProps {
    /** Controla a visibilidade do drawer mobile. */
    open: boolean;
    /** Callback chamado ao fechar (clique no backdrop, X, Esc). */
    onClose: () => void;
    /** Título exibido no header. */
    title?: React.ReactNode;
    /**
     * Número de filtros ativos. Quando > 0, exibe um pill no header
     * e habilita o botão "Limpar".
     */
    activeCount?: number;
    /** Callback do "Limpar tudo". Quando ausente, o botão some. */
    onClear?: () => void;
    /** Classes extras aplicadas ao container do conteúdo. */
    className?: string;
    /** Conteúdo (seções de filtro). */
    children: React.ReactNode;
    /**
     * Conteúdo opcional do footer. Quando ausente, o footer
     * renderiza apenas um botão "Ver resultados" que chama `onClose`.
     */
    footer?: React.ReactNode;
}

/**
 * FilterPanel — sidebar de filtros (desktop) / drawer (mobile).
 *
 * Em desktop (lg+) ocupa um lado da grade, sem overlay. Em mobile
 * desliza por cima do conteúdo principal com backdrop. Trava o
 * scroll do body quando aberto em mobile, idêntico ao Modal.
 *
 * Estrutura:
 *
 *   - Header: título + contador de filtros ativos + LinkButton
 *     "Limpar" (quando aplicável) + IconButton X (fecha em mobile).
 *   - Body: scroll vertical com as seções (children).
 *   - Footer: opcional. Default é o CTA "Ver resultados" em mobile.
 */
export function FilterPanel({
    open,
    onClose,
    title = "Filtros",
    activeCount = 0,
    onClear,
    className,
    children,
    footer,
}: FilterPanelProps): React.ReactElement {
    // Trava scroll do body só em mobile aberto.
    React.useEffect(() => {
        if (typeof window === "undefined") return;
        if (!open) return;
        if (window.matchMedia("(min-width: 1024px)").matches) return;

        const original = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = original;
        };
    }, [open]);

    // Fecha com Esc em mobile.
    React.useEffect(() => {
        if (!open) return;
        function onKey(e: KeyboardEvent): void {
            if (e.key === "Escape") onClose();
        }
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [open, onClose]);

    const composed = ["flex flex-col gap-5", className ?? ""]
        .filter(Boolean)
        .join(" ");

    return (
        <>
            {/* Backdrop mobile (desktop não usa overlay). */}
            <div
                aria-hidden="true"
                onClick={onClose}
                className={[
                    "fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-200 lg:hidden",
                    open
                        ? "opacity-100 pointer-events-auto"
                        : "pointer-events-none opacity-0",
                ].join(" ")}
            />

            {/* Painel: drawer mobile + sidebar desktop. Em desktop é
                sempre visível independente de `open`. */}
            <aside
                role="dialog"
                aria-modal="true"
                aria-label={typeof title === "string" ? title : "Filtros"}
                className={[
                    // Mobile: drawer fixo deslizando da esquerda.
                    "fixed inset-y-0 left-0 z-50 flex w-[88vw] max-w-sm flex-col border-r border-border bg-surface shadow-xl transition-transform duration-200",
                    // Desktop: sidebar inline na grade.
                    "lg:static lg:inset-auto lg:z-auto lg:w-full lg:max-w-none lg:translate-x-0 lg:shadow-none lg:rounded-3xl lg:border lg:border-border",
                    open ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
                ].join(" ")}
            >
                {/* Header */}
                <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 lg:px-5 lg:py-4">
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-text-secondary hover:bg-surface-muted hover:text-text-primary lg:hidden"
                            aria-label="Fechar filtros"
                        >
                            <ChevronLeftIcon size={16} />
                        </button>
                        <h2 className="text-sm font-semibold uppercase tracking-wider text-text-primary">
                            {title}
                        </h2>
                        {activeCount > 0 ? (
                            <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-gradient-to-br from-[color:var(--accent)] to-[color:var(--accent-deep)] px-1.5 text-[0.65rem] font-semibold text-white shadow-[0_2px_8px_-2px_rgba(197,82,58,0.45)]">
                                {activeCount}
                            </span>
                        ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                        {onClear && activeCount > 0 ? (
                            <LinkButton onClick={onClear}>Limpar</LinkButton>
                        ) : null}
                        <button
                            type="button"
                            onClick={onClose}
                            className="hidden h-8 w-8 items-center justify-center rounded-full text-text-secondary hover:bg-surface-muted hover:text-text-primary lg:hidden"
                            aria-label="Fechar filtros"
                        >
                            <XIcon size={16} />
                        </button>
                    </div>
                </header>

                {/* Body com scroll */}
                <div className={["flex-1 overflow-y-auto px-4 py-4 lg:px-5", composed].join(" ")}>
                    {children}
                </div>

                {/* Footer opcional (apenas mobile por default — desktop
                    aplica filtros automaticamente em onChange). */}
                {footer ? (
                    <footer className="border-t border-border px-4 py-3 lg:hidden">
                        {footer}
                    </footer>
                ) : null}
            </aside>
        </>
    );
}
