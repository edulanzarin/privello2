import * as React from "react";

import { SparklesIcon } from "../icons";

/**
 * Props do {@link OfferLayout}.
 *
 * Layout reusável das páginas de comparação de ofertas (ex.: planos
 * de Acompanhante, planos de Cliente, e quaisquer outras telas onde
 * múltiplas opções são apresentadas lado a lado para escolha).
 * Centraliza:
 *
 * - Background ambiente (gradiente + dois blobs animados).
 * - Cabeçalho central com pílula opcional, título e subtítulo.
 * - Grid responsivo (1 col mobile, até 2 cols desktop) que
 *   acomoda os cartões via `children`.
 * - Texto auxiliar opcional abaixo do grid.
 *
 * As animações respeitam `prefers-reduced-motion` (regra global em
 * `globals.css`).
 *
 * Nenhuma prop carrega nomes de entidades de domínio (Property 29).
 */
export interface OfferLayoutProps {
    /** Texto da pílula no topo do cabeçalho. */
    eyebrow?: React.ReactNode;
    /** Título principal. */
    title: React.ReactNode;
    /** Subtítulo curto exibido abaixo do título. */
    subtitle?: React.ReactNode;
    /** Texto auxiliar opcional renderizado abaixo do grid de cartões. */
    footer?: React.ReactNode;
    /** Conteúdo principal — tipicamente uma sequência de {@link OfferCard}. */
    children: React.ReactNode;
}

/**
 * OfferLayout — molde da tela de comparação de ofertas.
 *
 * Visual: viewport inteira, conteúdo centralizado, gradiente suave
 * de fundo e blobs animados em pontas opostas. Cabeçalho central,
 * grid `1 col` em mobile e `2 cols` em desktop.
 */
export function OfferLayout({
    eyebrow,
    title,
    subtitle,
    footer,
    children,
}: OfferLayoutProps): React.ReactElement {
    return (
        <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-16">
            <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-[#fff0eb]/70 via-white to-[color:var(--accent-soft)]"
            />
            <div
                aria-hidden="true"
                className="pointer-events-none absolute -top-40 -left-32 -z-10 h-[28rem] w-[28rem] rounded-full bg-[#ec7b5b]/30 blur-3xl animate-blob-1"
            />
            <div
                aria-hidden="true"
                className="pointer-events-none absolute -bottom-40 -right-32 -z-10 h-[32rem] w-[32rem] rounded-full bg-[#c5523a]/25 blur-3xl animate-blob-2"
            />

            <div className="w-full max-w-5xl animate-fade-in">
                <header className="mb-10 text-center">
                    {eyebrow != null ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/60 bg-white/60 px-3 py-1 text-[0.7rem] font-medium uppercase tracking-wider text-text-secondary shadow-glass backdrop-blur-md">
                            <SparklesIcon size={12} className="text-[color:var(--accent-deep)]" />
                            {eyebrow}
                        </span>
                    ) : null}
                    <h1 className="mt-4 text-3xl font-semibold tracking-tight text-text-primary md:text-4xl">
                        {title}
                    </h1>
                    {subtitle != null ? (
                        <p className="mt-2 text-sm text-text-secondary md:text-base">
                            {subtitle}
                        </p>
                    ) : null}
                </header>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    {children}
                </div>

                {footer != null ? (
                    <p className="mt-8 text-center text-xs text-text-secondary">
                        {footer}
                    </p>
                ) : null}
            </div>
        </main>
    );
}
