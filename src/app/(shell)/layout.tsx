import { AppShell } from "@/components";
import { buildNavItems } from "@/components/shell/navItems";
import { getCurrentSession } from "@/server/auth/currentSession";

/**
 * Layout do route group `(shell)`.
 *
 * Aplica o {@link AppShell} (TopBar com {@link Logo} centralizado +
 * {@link BottomNav} de 4 abas) em todas as páginas do grupo. Páginas
 * dentro deste route group ficam responsáveis apenas pelo seu próprio
 * conteúdo — não declaram navegação nem cabeçalho.
 *
 * # Adaptação por `userType`
 *
 * O layout resolve a sessão atual via {@link getCurrentSession} e
 * passa o `userType` (ou `null` para anônimos) para
 * {@link buildNavItems}, que monta os itens da `BottomNav`. A aba
 * "Conta" é renomeada para "Criar Conta" e aponta para `/cadastro`
 * quando o visitante não está autenticado.
 *
 * # Diferença para os layouts `cliente`/`acompanhante`
 *
 * Este layout **não força redirecionamento** — é a casa de páginas
 * públicas (home, busca, reels) que aceitam visitantes anônimos. As
 * áreas `acompanhante` e `cliente` continuam com seus próprios
 * layouts contendo redirects condicionais (incluindo o redirect
 * baseado em `planoVigente` para Acompanhante, Requirements 5.5/5.10).
 */
export default async function ShellLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await getCurrentSession();
    const navItems = buildNavItems({
        userType: session?.userType ?? null,
        identificador: session?.identificador,
    });

    return <AppShell navItems={navItems}>{children}</AppShell>;
}
