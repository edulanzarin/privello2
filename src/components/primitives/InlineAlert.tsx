"use client";

import * as React from "react";

/**
 * Tom visual do {@link InlineAlert}. Discrimina mensagens de sucesso,
 * informação, alerta e erro, com paleta tonal vinculada ao design
 * system.
 */
export type InlineAlertTone = "danger" | "warning" | "info" | "success";

/**
 * Props do {@link InlineAlert}.
 *
 * Mensagem inline com `role="alert"` e fundo tonal sutil. Substitui
 * o padrão `<p role="alert" className="rounded-md border border-... bg-.../40 ...">`
 * repetido em formulários, modais e abas. Aceita conteúdo livre via
 * `children` ou string simples.
 *
 * Nenhuma prop carrega nomes de entidades de domínio (Property 29).
 */
export interface InlineAlertProps {
    /** Tom visual. Padrão: `"danger"`. */
    tone?: InlineAlertTone;
    /** Conteúdo da mensagem. */
    children: React.ReactNode;
    /**
     * Slot opcional alinhado à direita para uma ação inline (botão,
     * link, ícone de fechar). Quando presente, o alerta vira um
     * banner com layout flex.
     */
    action?: React.ReactNode;
    /** Ícone opcional exibido antes da mensagem. */
    icon?: React.ReactNode;
    /** Classes extras aplicadas ao container. */
    className?: string;
}

const TONE_CLASSES: Record<InlineAlertTone, string> = {
    danger:
        "border-danger-200 bg-danger-50/40 text-danger-800",
    warning:
        "border-warning-200 bg-warning-50/40 text-warning-800",
    info:
        "border-primary-200 bg-primary-50/40 text-primary-800",
    success:
        "border-success-200 bg-success-50/40 text-success-800",
};

/**
 * InlineAlert — mensagem tonal `role="alert"`.
 *
 * Visual discreto: borda + fundo tonais leves, texto pequeno,
 * espaçamento padrão consistente entre todos os tons. Mantém
 * `aria-live="polite"` implícito via `role="alert"` (assistive
 * technologies anunciam mudanças automaticamente).
 */
export function InlineAlert({
    tone = "danger",
    children,
    action,
    icon,
    className,
}: InlineAlertProps): React.ReactElement {
    const composed = [
        "rounded-md border px-3 py-2 text-xs",
        TONE_CLASSES[tone],
        className ?? "",
    ]
        .filter(Boolean)
        .join(" ");

    // Quando há ícone ou ação, vira um banner flex; senão, mantém o
    // formato antigo (parágrafo simples) por compat visual com os
    // formulários que já usam InlineAlert sem layout extra.
    if (icon != null || action != null) {
        return (
            <div role="alert" className={composed}>
                <div className="flex items-start gap-2">
                    {icon != null ? (
                        <span aria-hidden="true" className="mt-0.5 shrink-0">
                            {icon}
                        </span>
                    ) : null}
                    <div className="min-w-0 flex-1">{children}</div>
                    {action != null ? (
                        <div className="shrink-0">{action}</div>
                    ) : null}
                </div>
            </div>
        );
    }

    return (
        <p role="alert" className={composed}>
            {children}
        </p>
    );
}
