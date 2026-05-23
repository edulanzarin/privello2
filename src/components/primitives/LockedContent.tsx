import * as React from "react";

import { LockIcon } from "../icons";

/**
 * Props do {@link LockedContent}.
 *
 * Wrapper de gate visual: renderiza `children` borrado + overlay
 * com mensagem e CTA. Pensado para conteúdo que está visualmente
 * "lá" mas que o usuário não pode ler (ex.: avaliações para
 * anônimo, comentários para Cliente Grátis).
 *
 * IMPORTANTE: este componente é apenas visual. A proteção real do
 * conteúdo é responsabilidade do servidor — só renderize aqui
 * placeholders/dados falsos, nunca o conteúdo real. O blur via CSS
 * é trivial de remover via DevTools, então **NUNCA** use isto pra
 * esconder dados que não devem chegar ao client.
 *
 * Nenhuma prop carrega nomes de entidades de domínio (Property 29).
 */
export interface LockedContentProps {
    /**
     * Conteúdo "preview" exibido borrado. Tipicamente placeholders
     * com dados falsos (lorem, traços) ou o próprio dado real
     * quando o caller decidir que pode borrar (ex.: contagem
     * agregada).
     */
    children: React.ReactNode;
    /** Título mostrado sobre o blur (ex.: "Conteúdo exclusivo"). */
    title: React.ReactNode;
    /** Texto auxiliar abaixo do título. */
    description?: React.ReactNode;
    /** Slot para CTA (botão/link "Entrar", "Virar Fan", etc). */
    action?: React.ReactNode;
    /**
     * Intensidade do blur em pixels. Padrão: 8. Aumenta para
     * conteúdo mais sensível.
     */
    blurAmount?: number;
    /** Classes extras aplicadas ao container. */
    className?: string;
}

/**
 * LockedContent — gate visual com blur + overlay.
 *
 * Estrutura:
 *   - Container `relative` com `overflow-hidden` e cantos
 *     arredondados.
 *   - Camada de conteúdo blurrado, `aria-hidden`, `pointer-events:
 *     none` (não interativo, não navegável por leitor de tela).
 *   - Camada de overlay com gradient warm sutil + ícone de
 *     cadeado + título + descrição + ação. Recebe foco normalmente.
 *
 * Acessibilidade: o conteúdo borrado é marcado `aria-hidden` para
 * que screen readers leiam apenas a mensagem do overlay. Caller
 * deve garantir que o `title` descreva o que está bloqueado.
 */
export function LockedContent({
    children,
    title,
    description,
    action,
    blurAmount = 8,
    className,
}: LockedContentProps): React.ReactElement {
    const composed = [
        "relative overflow-hidden rounded-3xl",
        className ?? "",
    ]
        .filter(Boolean)
        .join(" ");

    return (
        <div className={composed}>
            {/* Conteúdo blurrado — placeholder visual, sem interação. */}
            <div
                aria-hidden="true"
                className="pointer-events-none select-none"
                style={{
                    filter: `blur(${blurAmount}px) saturate(120%)`,
                    WebkitFilter: `blur(${blurAmount}px) saturate(120%)`,
                }}
            >
                {children}
            </div>

            {/* Overlay com mensagem e CTA. */}
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-b from-surface/60 via-surface/85 to-surface/95 px-4 py-6 text-center backdrop-blur-[2px]">
                <span
                    aria-hidden="true"
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-50 text-primary-600"
                >
                    <LockIcon size={18} />
                </span>
                <div className="flex flex-col gap-1">
                    <span className="text-sm font-semibold tracking-tight text-text-primary">
                        {title}
                    </span>
                    {description != null ? (
                        <span className="text-xs text-text-secondary">
                            {description}
                        </span>
                    ) : null}
                </div>
                {action != null ? (
                    <div className="mt-1 flex flex-none items-center">
                        {action}
                    </div>
                ) : null}
            </div>
        </div>
    );
}
