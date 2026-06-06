import Link from "next/link";

/**
 * Rodapé institucional do site.
 *
 * Renderizado dentro do {@link AppShell}, acima da {@link BottomNav}.
 * Mostra links pra páginas institucionais (Sobre, Termos,
 * Privacidade) — exigência prática pra qualquer site de produção
 * (Stripe, App Stores, LGPD).
 *
 * Mantido fora de `primitives/` porque tem termos institucionais
 * específicos da Privello (nome da marca, links nomeados). O lint
 * de primitivos proíbe esses termos.
 */
export function SiteFooter(): React.ReactElement {
    const ano = new Date().getFullYear();
    return (
        <footer className="border-t border-border/60 bg-surface/40 px-4 pb-24 pt-6 text-xs text-text-secondary sm:px-6">
            <div className="mx-auto flex w-full max-w-5xl flex-col items-center justify-between gap-3 sm:flex-row">
                <p className="text-center sm:text-left">
                    © {ano} Privello — Todos os direitos reservados.
                </p>
                <nav className="flex items-center gap-4">
                    <Link
                        href="/sobre"
                        className="transition-colors hover:text-text-primary"
                    >
                        Sobre
                    </Link>
                    <Link
                        href="/termos"
                        className="transition-colors hover:text-text-primary"
                    >
                        Termos
                    </Link>
                    <Link
                        href="/privacidade"
                        className="transition-colors hover:text-text-primary"
                    >
                        Privacidade
                    </Link>
                </nav>
            </div>
            <p className="mt-3 text-center text-[10px] uppercase tracking-wide text-text-tertiary sm:text-right">
                Conteúdo destinado exclusivamente a maiores de 18 anos
            </p>
        </footer>
    );
}
