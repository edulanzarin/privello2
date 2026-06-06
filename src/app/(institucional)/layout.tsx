import { AppShell, SiteFooter } from "@/components";
import { buildNavItems } from "@/components/shell/navItems";
import { getCurrentSession } from "@/server/auth/currentSession";

/**
 * Layout das páginas institucionais (`/sobre`, `/termos`,
 * `/privacidade`, `/contato`).
 *
 * Diferente do `(shell)`, **não bloqueia Acompanhantes** — tanto
 * Cliente quanto Acompanhante quanto anônimo precisam conseguir ler
 * Termos, Privacidade etc. (inclusive por exigência legal — LGPD,
 * direitos do titular).
 *
 * Reusa o {@link AppShell} (mesma TopBar e BottomNav das demais
 * áreas) pra que a navegação fique consistente.
 */
export default async function InstitucionalLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await getCurrentSession();
    const navItems = buildNavItems({
        userType: session?.userType ?? null,
        identificador: session?.identificador,
    });

    return (
        <AppShell navItems={navItems} belowMain={<SiteFooter />}>
            {children}
        </AppShell>
    );
}
