"use client";

import * as React from "react";

import { XIcon } from "../icons";

/**
 * Tipo do evento `beforeinstallprompt` em browsers Chromium-based.
 * Não está nos `lib.dom.d.ts` porque é proposta de spec — declaramos
 * o shape mínimo aqui pra evitar `any`.
 */
interface BeforeInstallPromptEvent extends Event {
    readonly platforms: ReadonlyArray<string>;
    readonly userChoice: Promise<{
        outcome: "accepted" | "dismissed";
        platform: string;
    }>;
    prompt(): Promise<void>;
}

/**
 * Props do {@link InstallPromptBanner}.
 *
 * Banner discreto no rodapé sugerindo instalar o site como app
 * (PWA). Comportamento depende do browser:
 *
 * - **Chromium (Android, desktop)**: o navegador dispara o evento
 *   `beforeinstallprompt`. Capturamos, mostramos o banner com botão
 *   "Instalar". Clicar chama `evt.prompt()` que abre o diálogo
 *   nativo. O usuário decide.
 * - **iOS Safari**: não tem evento. Detectamos UA e mostramos uma
 *   variante diferente do banner com botão "Como instalar?" que
 *   abre instruções (caller fornece via prop ou mostra modal).
 *
 * "Dispensado" é persistido em localStorage por 30 dias — usuário
 * que recusou não vê de novo na hora.
 *
 * Quando já está rodando como instalado (`display-mode: standalone`),
 * o banner se auto-oculta — não faz sentido oferecer "instalar" pra
 * quem já instalou.
 *
 * Nenhuma prop carrega nomes de entidades de domínio (Property 29).
 */
export interface InstallPromptBannerProps {
    /**
     * Texto principal. Default genérico — caller pode sobrescrever
     * pra falar do produto especificamente.
     */
    title?: string;
    /** Subtítulo. */
    description?: string;
    /**
     * Callback chamado ao clicar em "Como instalar?" (variante iOS).
     * Tipicamente abre um modal com screenshots do "Compartilhar →
     * Adicionar à tela inicial".
     */
    onShowInstructions?: () => void;
    /** Classes extras no banner. */
    className?: string;
}

const STORAGE_KEY = "pv:install-dismissed";
/** Duração da "dispensa" em dias. */
const DISMISS_DAYS = 30;

function isDismissed(): boolean {
    if (typeof window === "undefined") return false;
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return false;
        const ts = Number.parseInt(raw, 10);
        if (!Number.isFinite(ts)) return false;
        const diffMs = Date.now() - ts;
        const diffDays = diffMs / (24 * 60 * 60 * 1000);
        return diffDays < DISMISS_DAYS;
    } catch {
        return false;
    }
}

function markDismissed(): void {
    if (typeof window === "undefined") return;
    try {
        window.localStorage.setItem(STORAGE_KEY, String(Date.now()));
    } catch {
        // localStorage indisponível — best-effort.
    }
}

function isStandaloneApp(): boolean {
    if (typeof window === "undefined") return false;
    const standaloneMQ = window.matchMedia?.("(display-mode: standalone)");
    if (standaloneMQ?.matches) return true;
    // iOS expõe `navigator.standalone`.
    const nav = window.navigator as unknown as { standalone?: boolean };
    return nav.standalone === true;
}

function isIOS(): boolean {
    if (typeof window === "undefined") return false;
    const ua = window.navigator.userAgent.toLowerCase();
    return /iphone|ipad|ipod/.test(ua) && !("MSStream" in window);
}

/**
 * InstallPromptBanner — sugere instalar o site como PWA.
 *
 * Renderiza um banner fixo no rodapé. Hidden por padrão, aparece
 * com `slide-up` quando o evento `beforeinstallprompt` dispara
 * (Chromium) ou quando detectamos iOS Safari sem standalone. Após
 * dispensar, fica suprimido por 30 dias via localStorage.
 */
export function InstallPromptBanner({
    title = "Adicione à tela inicial",
    description = "Acesse mais rápido e sem barra do navegador.",
    onShowInstructions,
    className,
}: InstallPromptBannerProps): React.ReactElement | null {
    const [evt, setEvt] = React.useState<BeforeInstallPromptEvent | null>(null);
    const [showIos, setShowIos] = React.useState(false);
    const [hidden, setHidden] = React.useState(true);

    React.useEffect(() => {
        if (isStandaloneApp()) return;
        if (isDismissed()) return;

        const handler = (e: Event): void => {
            // Em Chromium o evento traz `prompt()`. Bloqueamos o
            // banner nativo (que algumas versões mostram de regra)
            // pra ter UX consistente.
            e.preventDefault();
            setEvt(e as BeforeInstallPromptEvent);
            setHidden(false);
        };
        window.addEventListener("beforeinstallprompt", handler);

        // iOS Safari: sem evento, mas damos uma sugestão visual após
        // 5s de uso pra não atrapalhar primeira impressão.
        let iosTimer: ReturnType<typeof setTimeout> | null = null;
        if (isIOS()) {
            iosTimer = setTimeout(() => {
                setShowIos(true);
                setHidden(false);
            }, 5000);
        }

        return () => {
            window.removeEventListener("beforeinstallprompt", handler);
            if (iosTimer !== null) clearTimeout(iosTimer);
        };
    }, []);

    function handleInstall(): void {
        if (!evt) return;
        void evt.prompt();
        void evt.userChoice.then(() => {
            // Esconde regardless do outcome — instalou ou rejeitou,
            // banner some.
            setEvt(null);
            setHidden(true);
            markDismissed();
        });
    }

    function handleDismiss(): void {
        markDismissed();
        setHidden(true);
    }

    if (hidden) return null;

    const composed = [
        "fixed inset-x-3 bottom-3 z-40 mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-[#ec7b5b]/30 bg-surface-elevated px-4 py-3 shadow-[0_8px_32px_-8px_rgba(0,0,0,0.18)] backdrop-blur-md animate-slide-up",
        className ?? "",
    ]
        .filter(Boolean)
        .join(" ");

    return (
        <div role="dialog" aria-label="Instalar Privello" className={composed}>
            <div className="flex flex-1 flex-col gap-0.5">
                <span className="text-sm font-semibold tracking-tight text-text-primary">
                    {title}
                </span>
                <span className="text-xs text-text-secondary">
                    {description}
                </span>
            </div>
            {showIos ? (
                <button
                    type="button"
                    onClick={onShowInstructions}
                    className="flex-none rounded-full bg-gradient-to-br from-[color:var(--accent)] to-[color:var(--accent-deep)] px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition-transform hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ec7b5b]/40"
                >
                    Como?
                </button>
            ) : (
                <button
                    type="button"
                    onClick={handleInstall}
                    disabled={!evt}
                    className="flex-none rounded-full bg-gradient-to-br from-[color:var(--accent)] to-[color:var(--accent-deep)] px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition-transform hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ec7b5b]/40 disabled:opacity-60"
                >
                    Instalar
                </button>
            )}
            <button
                type="button"
                onClick={handleDismiss}
                aria-label="Dispensar"
                className="flex h-7 w-7 flex-none items-center justify-center rounded-full text-text-secondary hover:bg-neutral-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ec7b5b]/40"
            >
                <XIcon size={14} />
            </button>
        </div>
    );
}
