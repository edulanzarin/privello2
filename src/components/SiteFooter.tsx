import Link from "next/link";

import { Logo } from "./primitives/Logo";

/**
 * Rodapé institucional do site.
 *
 * Renderizado dentro do {@link AppShell}, acima da {@link BottomNav}.
 * Mostra links pra páginas institucionais (Sobre, Termos,
 * Privacidade) — exigência prática pra qualquer site de produção
 * (Stripe, App Stores, LGPD).
 *
 * Visual alinhado ao tema: hairline superior, fundo `transparent`
 * (segue o `bg-background` lavanda quente da shell), tipografia
 * pequena em `text-text-tertiary`. Padding inferior reservado pra
 * que o último item não fique colado na BottomNav.
 *
 * Mantido fora de `primitives/` porque tem termos institucionais
 * específicos da Privello (nome da marca, links nomeados). O lint
 * de primitivos proíbe esses termos.
 */
export function SiteFooter(): React.ReactElement {
    const ano = new Date().getFullYear();
    return (
        <footer className="mt-12 border-t border-[color:var(--hairline)] px-4 pb-28 pt-8 sm:px-6">
            <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-5 text-center">
                {/* Logo */}
                <Logo variant="wordmark" size={20} />

                {/* Links institucionais */}
                <nav
                    aria-label="Links institucionais"
                    className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm font-medium text-text-secondary"
                >
                    <Link
                        href="/sobre"
                        className="transition-colors hover:text-accent-deep"
                    >
                        Sobre
                    </Link>
                    <span aria-hidden="true" className="text-text-tertiary">
                        ·
                    </span>
                    <Link
                        href="/termos"
                        className="transition-colors hover:text-accent-deep"
                    >
                        Termos
                    </Link>
                    <span aria-hidden="true" className="text-text-tertiary">
                        ·
                    </span>
                    <Link
                        href="/privacidade"
                        className="transition-colors hover:text-accent-deep"
                    >
                        Privacidade
                    </Link>
                </nav>

                {/* Aviso 18+ */}
                <span
                    className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-accent-deep"
                    role="img"
                    aria-label="Conteúdo destinado exclusivamente a maiores de 18 anos"
                >
                    <span aria-hidden="true">+18</span>
                    <span className="font-medium normal-case tracking-normal">
                        Conteúdo para maiores de idade
                    </span>
                </span>

                {/* Copyright */}
                <p className="text-xs text-text-tertiary">
                    © {ano} Privello. Todos os direitos reservados.
                </p>
            </div>
        </footer>
    );
}
