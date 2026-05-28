import * as React from "react";

import { LockIcon } from "../icons";

/**
 * Props do {@link LockedContent}.
 *
 * Wrapper de gate visual estilo LinkedIn/Instagram: renderiza
 * `children` borrado em camada de fundo + overlay translúcido com
 * mensagem e CTA. Pensado para conteúdo que está visualmente "lá"
 * mas que o usuário não pode ler (ex.: avaliações para anônimo,
 * comentários para Cliente Grátis, perguntas para não-fan).
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
     * Intensidade do blur em pixels. Padrão: 10. Aumenta para
     * conteúdo mais sensível.
     */
    blurAmount?: number;
    /**
     * Tom do hero (cadeado + glow). Padrão: `"accent"` (warm).
     * `"neutral"` cai pro hero monocromático em telas mais
     * frias.
     */
    tone?: "accent" | "neutral";
    /** Classes extras aplicadas ao container. */
    className?: string;
}

/**
 * LockedContent — gate visual com blur + overlay glass.
 *
 * Estrutura:
 *   - Container `relative` com `overflow-hidden` e cantos
 *     arredondados.
 *   - Camada de conteúdo blurrado, `aria-hidden`, `pointer-events:
 *     none` (não interativo, não navegável por leitor de tela).
 *   - Gradiente fade vertical (opaco no fundo) que mascara
 *     suavemente o conteúdo borrado — efeito LinkedIn.
 *   - Painel central glass com hero (ícone com glow), título,
 *     descrição e CTA.
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
    blurAmount = 10,
    tone = "accent",
    className,
}: LockedContentProps): React.ReactElement {
    const composed = [
        "relative overflow-hidden rounded-3xl",
        className ?? "",
    ]
        .filter(Boolean)
        .join(" ");

    const heroClasses =
        tone === "accent"
            ? "bg-[color:var(--accent-soft)] text-[color:var(--accent-deep)] ring-4 ring-[color:var(--accent)]/15"
            : "bg-neutral-100 text-text-primary ring-4 ring-neutral-200";

    return (
        <div className={composed}>
            {/* Conteúdo blurrado — placeholder visual, sem interação. */}
            <div
                aria-hidden="true"
                className="pointer-events-none select-none paywall-blur"
                style={{
                    filter: `blur(${blurAmount}px) saturate(0.85)`,
                    WebkitFilter: `blur(${blurAmount}px) saturate(0.85)`,
                }}
            >
                {children}
            </div>

            {/* Fade vertical sutil — escurece o blur de cima pra
                baixo pra dar foco no painel central. */}
            <div
                aria-hidden="true"
                className="paywall-fade pointer-events-none absolute inset-0"
            />

            {/* Painel glass centralizado. */}
            <div className="absolute inset-0 flex items-center justify-center p-4">
                <div className="glass-surface-strong flex max-w-sm flex-col items-center gap-3 rounded-3xl px-6 py-5 text-center">
                    <span
                        aria-hidden="true"
                        className={`flex h-12 w-12 items-center justify-center rounded-full ${heroClasses}`}
                    >
                        <LockIcon size={20} />
                    </span>
                    <div className="flex flex-col gap-1">
                        <span className="text-base font-semibold tracking-tight text-text-primary">
                            {title}
                        </span>
                        {description != null ? (
                            <span className="text-xs leading-relaxed text-text-secondary">
                                {description}
                            </span>
                        ) : null}
                    </div>
                    {action != null ? (
                        <div className="mt-1 flex flex-none items-center gap-2">
                            {action}
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    );
}
