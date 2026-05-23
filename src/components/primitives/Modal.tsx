"use client";

import * as React from "react";

import { XIcon } from "../icons";

/**
 * Tamanho canônico do {@link Modal}.
 *
 * - `"sm"` (`max-w-md`): formulários curtos, confirmações.
 * - `"md"` (`max-w-lg`): default; uploads, edição inline.
 * - `"lg"` (`max-w-2xl`): formulários longos, comparações lado a lado.
 * - `"xl"` (`max-w-7xl`): visualizadores e galerias que precisam
 *   ocupar quase toda a viewport, mas mantendo padding lateral e
 *   cantos arredondados (vs `"full"` que vai borda a borda).
 * - `"full"`: ocupa toda a viewport, sem padding lateral. Para
 *   experiências bleed total (raro).
 */
export type ModalSize = "sm" | "md" | "lg" | "xl" | "full";

/**
 * Props do {@link Modal}.
 *
 * Modal genérico que serve como base para qualquer fluxo modal do
 * produto: upload de mídia, confirmações, formulários inline,
 * visualizadores. Centraliza:
 *
 * - Backdrop com blur, fechamento ao clicar fora.
 * - Trap mínimo de foco e bloqueio de scroll do body.
 * - Tecla `Escape` fecha (configurável).
 * - Tamanhos canônicos.
 * - Header opcional com título, subtítulo e botão de fechar.
 *
 * Conteúdo é renderizado via `children`. Para layouts mais complexos
 * (footer fixo de ações), o consumidor pode estruturar o `children`
 * livremente — o modal não impõe layout além do header.
 *
 * Nenhuma prop carrega nomes de entidades de domínio (Property 29).
 */
export interface ModalProps {
    /** Estado controlado de visibilidade. */
    open: boolean;
    /** Callback de fechamento (X, Esc, clique no backdrop). */
    onClose: () => void;
    /** Título exibido no header. Quando ausente, header é omitido. */
    title?: React.ReactNode;
    /** Subtítulo opcional abaixo do título. */
    subtitle?: React.ReactNode;
    /** Tamanho do modal. Padrão: `"md"`. */
    size?: ModalSize;
    /**
     * Quando `false`, clicar fora não fecha (só Esc/X). Útil em
     * fluxos de upload onde o usuário pode perder dados. Padrão:
     * `true`.
     */
    dismissOnBackdrop?: boolean;
    /**
     * Quando `false`, Esc não fecha. Padrão: `true`. Use `false`
     * quando há um sub-fluxo crítico (ex.: upload em progresso).
     */
    dismissOnEsc?: boolean;
    /**
     * Tom do backdrop. `"default"` (padrão) usa preto a 55% com
     * blur. `"strong"` usa preto a 85% com blur — para
     * visualizadores de mídia onde o foco deve ficar 100% no
     * conteúdo.
     */
    backdropTone?: "default" | "strong";
    /**
     * Quando `false`, o {@link Modal} não renderiza o botão de
     * fechar global no canto. Útil quando o conteúdo já tem seu
     * próprio chrome (header com X custom, toolbar full-bleed
     * etc.). Padrão: `true`.
     */
    showCloseButton?: boolean;
    /** Slot de conteúdo. */
    children: React.ReactNode;
    /** Classes extras aplicadas ao card do modal. */
    className?: string;
}

const SIZE_CLASSES: Record<ModalSize, string> = {
    sm: "max-w-md",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-7xl h-full",
    full: "max-w-none w-full h-full rounded-none",
};

/**
 * Modal — base genérica para qualquer modal do produto.
 *
 * Visual: backdrop preto translúcido com blur, card branco
 * arredondado centralizado, header opcional com título e botão de
 * fechar. Em mobile, o card vai borda a borda com padding reduzido.
 */
export function Modal({
    open,
    onClose,
    title,
    subtitle,
    size = "md",
    dismissOnBackdrop = true,
    dismissOnEsc = true,
    backdropTone = "default",
    showCloseButton = true,
    children,
    className,
}: ModalProps): React.ReactElement | null {
    React.useEffect(() => {
        if (!open) return;
        function handleKey(e: KeyboardEvent): void {
            if (e.key === "Escape" && dismissOnEsc) {
                onClose();
            }
        }
        window.addEventListener("keydown", handleKey);
        return () => window.removeEventListener("keydown", handleKey);
    }, [open, dismissOnEsc, onClose]);

    React.useEffect(() => {
        if (!open) return;
        const original = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = original;
        };
    }, [open]);

    if (!open) return null;

    const isFull = size === "full";

    const backdropClass =
        backdropTone === "strong"
            ? "bg-black/85 backdrop-blur-sm"
            : "bg-black/55 backdrop-blur-sm";

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-label={
                typeof title === "string" ? title : "Diálogo"
            }
            className={[
                "fixed inset-0 z-50 flex animate-fade-in-soft items-center justify-center",
                backdropClass,
                isFull ? "" : "p-3 sm:p-6",
            ]
                .filter(Boolean)
                .join(" ")}
        >
            {/* Backdrop clicável. Em modo `full` o card já cobre tudo,
                então o backdrop não fica acessível. */}
            <button
                type="button"
                aria-label="Fechar"
                onClick={dismissOnBackdrop ? onClose : undefined}
                tabIndex={-1}
                className="absolute inset-0 cursor-default"
            />

            {/* Botão de fechar global, sempre visível no canto. Ocultável
                via `showCloseButton={false}` quando o conteúdo já tem
                seu próprio header com X. */}
            {showCloseButton && title == null ? (
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Fechar"
                    className={[
                        "absolute z-10 inline-flex h-9 w-9 items-center justify-center rounded-full text-white backdrop-blur-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60",
                        backdropTone === "strong"
                            ? "bg-black/45 hover:bg-black/65"
                            : "bg-black/40 hover:bg-black/60",
                        // Em padding total a posição respeita o
                        // padding do container; em full vai colado.
                        isFull ? "right-3 top-3" : "right-5 top-5 sm:right-8 sm:top-8",
                    ]
                        .filter(Boolean)
                        .join(" ")}
                >
                    <XIcon size={18} />
                </button>
            ) : null}

            {/* Card principal */}
            <div
                className={[
                    "relative z-0 flex w-full flex-col overflow-hidden rounded-2xl bg-surface shadow-glassLg",
                    isFull
                        ? "h-full"
                        // Desconta o espaço da TopBar (h-14 = 56px) +
                        // BottomNav (h-16 = 64px) + folga (24px),
                        // totalizando 144px = 9rem. `dvh` respeita a
                        // barra de URL retrátil em browsers mobile.
                        : "max-h-[calc(100dvh-9rem)]",
                    SIZE_CLASSES[size],
                    className ?? "",
                ]
                    .filter(Boolean)
                    .join(" ")}
            >
                {title != null ? (
                    <header className="flex items-start justify-between gap-3 border-b border-neutral-200 px-5 py-4">
                        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                            <h2 className="truncate text-base font-semibold tracking-tight text-text-primary">
                                {title}
                            </h2>
                            {subtitle != null ? (
                                <p className="text-xs text-text-secondary">
                                    {subtitle}
                                </p>
                            ) : null}
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            aria-label="Fechar"
                            className="inline-flex h-8 w-8 flex-none items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-neutral-100 hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40"
                        >
                            <XIcon size={16} />
                        </button>
                    </header>
                ) : null}

                {/* Conteúdo: rolável quando ultrapassa o max-height. */}
                <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
                    {children}
                </div>
            </div>
        </div>
    );
}

/**
 * Hook helper que controla o estado open/close do modal.
 *
 * Encapsula o boilerplate `(open, openModal, closeModal)` que toda
 * página vai reinventar quando abrir um modal.
 *
 * @example
 * const modal = useModal();
 * return (
 *   <>
 *     <button onClick={modal.open}>Abrir</button>
 *     <Modal open={modal.isOpen} onClose={modal.close}>...</Modal>
 *   </>
 * );
 */
export function useModal(initial: boolean = false): {
    isOpen: boolean;
    open: () => void;
    close: () => void;
    toggle: () => void;
} {
    const [isOpen, setIsOpen] = React.useState(initial);
    const open = React.useCallback(() => setIsOpen(true), []);
    const close = React.useCallback(() => setIsOpen(false), []);
    const toggle = React.useCallback(() => setIsOpen((v) => !v), []);
    return { isOpen, open, close, toggle };
}
