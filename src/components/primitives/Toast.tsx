"use client";

import * as React from "react";

import { CheckIcon, XIcon } from "../icons";

/**
 * Tom visual de um toast. Espelha o vocabulário do `InlineAlert`.
 */
export type ToastTone = "success" | "danger" | "info";

/**
 * Toast já materializado na fila (com id interno pra animar/remover).
 */
interface ToastItem {
    id: number;
    tone: ToastTone;
    message: string;
    /** ms até auto-dismiss. `0` = não some sozinho. */
    duration: number;
}

/**
 * Opções aceitas por {@link ToastApi.show} e helpers.
 */
export interface ToastOptions {
    /** Duração até sumir (ms). Padrão: 3500. `0` desabilita. */
    duration?: number;
}

/**
 * API exposta por {@link useToast}. Métodos disparam um toast e
 * devolvem o `id` (útil pra dismiss manual).
 */
export interface ToastApi {
    show: (tone: ToastTone, message: string, opts?: ToastOptions) => number;
    success: (message: string, opts?: ToastOptions) => number;
    danger: (message: string, opts?: ToastOptions) => number;
    info: (message: string, opts?: ToastOptions) => number;
    dismiss: (id: number) => void;
}

const ToastContext = React.createContext<ToastApi | null>(null);

const DEFAULT_DURATION = 3500;

/**
 * Provider global de toasts. Monte uma vez perto da raiz (`layout`).
 * Renderiza o {@link Toaster} (stack fixo) e expõe a API via
 * contexto pra `useToast()`.
 *
 * Nenhuma prop carrega nomes de entidades de domínio (Property 29).
 */
export function ToastProvider({
    children,
}: {
    children: React.ReactNode;
}): React.ReactElement {
    const [toasts, setToasts] = React.useState<ReadonlyArray<ToastItem>>([]);
    const nextId = React.useRef(1);
    const timers = React.useRef<Map<number, ReturnType<typeof setTimeout>>>(
        new Map(),
    );

    const dismiss = React.useCallback((id: number) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
        const timer = timers.current.get(id);
        if (timer) {
            clearTimeout(timer);
            timers.current.delete(id);
        }
    }, []);

    const show = React.useCallback(
        (tone: ToastTone, message: string, opts?: ToastOptions): number => {
            const id = nextId.current++;
            const duration = opts?.duration ?? DEFAULT_DURATION;
            setToasts((prev) => {
                // Cap em 4 visíveis — descarta o mais antigo.
                const next = [...prev, { id, tone, message, duration }];
                return next.length > 4 ? next.slice(next.length - 4) : next;
            });
            if (duration > 0) {
                const timer = setTimeout(() => dismiss(id), duration);
                timers.current.set(id, timer);
            }
            return id;
        },
        [dismiss],
    );

    // Limpa timers pendentes ao desmontar.
    React.useEffect(() => {
        const map = timers.current;
        return () => {
            for (const t of map.values()) clearTimeout(t);
            map.clear();
        };
    }, []);

    const api = React.useMemo<ToastApi>(
        () => ({
            show,
            success: (m, o) => show("success", m, o),
            danger: (m, o) => show("danger", m, o),
            info: (m, o) => show("info", m, o),
            dismiss,
        }),
        [show, dismiss],
    );

    return (
        <ToastContext.Provider value={api}>
            {children}
            <Toaster toasts={toasts} onDismiss={dismiss} />
        </ToastContext.Provider>
    );
}

/**
 * Hook pra disparar toasts. Lança se usado fora do
 * {@link ToastProvider} (erro de montagem, não de runtime do
 * usuário).
 */
export function useToast(): ToastApi {
    const ctx = React.useContext(ToastContext);
    if (ctx === null) {
        throw new Error("useToast precisa de um <ToastProvider> ancestral.");
    }
    return ctx;
}

const TONE_CLASSES: Record<ToastTone, string> = {
    success: "border-success-200 bg-white text-success-800",
    danger: "border-danger-200 bg-white text-danger-800",
    info: "border-[#ec7b5b]/30 bg-white text-[color:var(--accent-deep)]",
};

const TONE_ICON_CLASSES: Record<ToastTone, string> = {
    success: "bg-success-500 text-white",
    danger: "bg-danger-600 text-white",
    info: "bg-gradient-to-br from-[color:var(--accent)] to-[color:var(--accent-deep)] text-white",
};

/**
 * Toaster — stack fixo de toasts no canto inferior (acima do
 * BottomNav). Cada toast entra com `slide-up`. Renderizado pelo
 * provider; não precisa ser usado diretamente.
 */
function Toaster({
    toasts,
    onDismiss,
}: {
    toasts: ReadonlyArray<ToastItem>;
    onDismiss: (id: number) => void;
}): React.ReactElement | null {
    if (toasts.length === 0) return null;

    return (
        <div
            aria-live="polite"
            aria-atomic="false"
            className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-3 sm:bottom-6"
        >
            {toasts.map((t) => (
                <div
                    key={t.id}
                    role="status"
                    className={[
                        "pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl border px-3 py-2.5 shadow-[0_8px_28px_-8px_rgba(0,0,0,0.22)] animate-slide-up",
                        TONE_CLASSES[t.tone],
                    ].join(" ")}
                >
                    <span
                        aria-hidden="true"
                        className={[
                            "inline-flex h-6 w-6 flex-none items-center justify-center rounded-full",
                            TONE_ICON_CLASSES[t.tone],
                        ].join(" ")}
                    >
                        {t.tone === "success" ? (
                            <CheckIcon size={13} />
                        ) : t.tone === "danger" ? (
                            <XIcon size={13} />
                        ) : (
                            <span className="text-[0.7rem] font-bold">i</span>
                        )}
                    </span>
                    <span className="min-w-0 flex-1 text-sm text-text-primary">
                        {t.message}
                    </span>
                    <button
                        type="button"
                        onClick={() => onDismiss(t.id)}
                        aria-label="Fechar"
                        className="flex h-6 w-6 flex-none items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-neutral-100 hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ec7b5b]/40"
                    >
                        <XIcon size={13} />
                    </button>
                </div>
            ))}
        </div>
    );
}
