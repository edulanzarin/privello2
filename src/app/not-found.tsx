import type { Metadata } from "next";
import Link from "next/link";

import { Logo, SearchIcon } from "@/components";

/**
 * Página 404 customizada.
 *
 * Renderizada quando uma rota não casa com nenhuma página, e quando
 * `notFound()` é chamado dentro de Server Components.
 *
 * Marcada `noindex` (não polui o SERP com URLs inexistentes) e com
 * dois CTAs claros: voltar pra home ou abrir a busca de
 * acompanhantes — onde o usuário provavelmente queria ir.
 */
export const metadata: Metadata = {
    title: "Página não encontrada",
    description:
        "A página que você buscou não foi encontrada. Volte para a Privello ou explore acompanhantes verificadas.",
    robots: { index: false, follow: false },
};

const PRIMARY_BUTTON_CLASS =
    "inline-flex h-11 items-center justify-center gap-2 rounded-full bg-gradient-to-br from-accent to-accent-deep px-5 text-sm font-medium text-white shadow-[0_4px_12px_-4px_rgba(197,82,58,0.45)] transition-transform duration-200 hover:translate-y-[-1px] hover:shadow-[0_6px_18px_-4px_rgba(197,82,58,0.55)] active:translate-y-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40";

const SECONDARY_BUTTON_CLASS =
    "inline-flex h-11 items-center justify-center gap-2 rounded-full border border-border bg-surface px-5 text-sm font-medium text-text-primary transition-colors duration-200 hover:border-accent/35 hover:text-accent-deep focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40";

export default function NotFoundPage() {
    return (
        <main className="flex min-h-screen flex-col items-center justify-center px-6 py-12 text-center">
            <Logo variant="wordmark" size={32} />

            <p
                aria-hidden="true"
                className="mt-10 text-7xl font-bold tracking-tight text-accent-deep sm:text-8xl"
            >
                404
            </p>

            <h1 className="mt-4 text-2xl font-semibold tracking-tight text-text-primary sm:text-3xl">
                Página não encontrada
            </h1>

            <p className="mt-3 max-w-md text-base text-text-secondary">
                O endereço que você acessou não existe, foi removido ou está
                indisponível. Use os atalhos abaixo para continuar.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="/" className={PRIMARY_BUTTON_CLASS}>
                    Voltar para a Home
                </Link>
                <Link href="/acompanhantes" className={SECONDARY_BUTTON_CLASS}>
                    <SearchIcon size={16} />
                    Explorar acompanhantes
                </Link>
            </div>
        </main>
    );
}
