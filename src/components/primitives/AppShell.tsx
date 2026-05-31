import * as React from "react";

import { BottomNav, type BottomNavItem } from "./BottomNav";
import { SideNav } from "./SideNav";
import { TopBar } from "./TopBar";

/**
 * Props do {@link AppShell}.
 *
 * Layout-shell padrão das páginas autenticadas e públicas com
 * navegação. Combina {@link TopBar} (logo centralizado) com
 * {@link BottomNav} (4 abas), deixando o conteúdo no meio. Cada página
 * que consumir o shell foca apenas em renderizar seu conteúdo, sem
 * precisar replicar o markup de header/nav.
 *
 * Nenhuma prop carrega nomes de entidades de domínio (Property 29).
 */
export interface AppShellProps {
    /** Itens exibidos no {@link BottomNav}. */
    navItems: ReadonlyArray<BottomNavItem>;
    /** Slot opcional alinhado à esquerda na {@link TopBar}. */
    topLeading?: React.ReactNode;
    /** Slot opcional alinhado à direita na {@link TopBar}. */
    topTrailing?: React.ReactNode;
    /**
     * Quando `true`, em telas grandes (`lg+`) renderiza uma
     * {@link SideNav} vertical à esquerda e oculta o
     * {@link BottomNav}; em mobile o comportamento é idêntico ao
     * padrão (BottomNav embaixo). Opt-in — só os painéis
     * autenticados ativam. O `topTrailing` é reaproveitado como
     * rodapé da sidebar em desktop.
     */
    desktopSidebar?: boolean;
    /** Conteúdo principal renderizado entre TopBar e BottomNav. */
    children: React.ReactNode;
}

/**
 * AppShell — combina TopBar + conteúdo + BottomNav.
 *
 * Layout-flex em coluna ocupando 100vh: a TopBar fica `sticky` no topo,
 * o `<main>` cresce para preencher o restante (com scroll próprio se
 * necessário) e o BottomNav fica `sticky` no rodapé. O `<main>` declara
 * `pb-2` apenas como espaçamento interno; o BottomNav já segura o
 * espaço inferior via altura fixa.
 *
 * # Sidebar desktop (opt-in)
 *
 * Com `desktopSidebar`, o shell vira um layout de 2 colunas em `lg+`:
 * {@link SideNav} fixa à esquerda + coluna de conteúdo (TopBar +
 * main). A TopBar e o BottomNav ganham `lg:hidden` — em desktop a
 * navegação inteira mora na sidebar (que já tem o logo). Em mobile
 * nada muda.
 */
export function AppShell({
    navItems,
    topLeading,
    topTrailing,
    desktopSidebar = false,
    children,
}: AppShellProps): React.ReactElement {
    if (desktopSidebar) {
        return (
            <div className="flex min-h-screen w-full max-w-full overflow-x-clip bg-background">
                <SideNav
                    items={navItems}
                    footer={topTrailing}
                    className="hidden lg:flex"
                />
                <div className="flex min-h-screen w-full min-w-0 flex-1 flex-col overflow-x-clip">
                    <TopBar
                        leading={topLeading}
                        trailing={topTrailing}
                        className="lg:hidden"
                    />
                    <main className="w-full max-w-full flex-1 overflow-x-clip">
                        {children}
                    </main>
                    <BottomNav items={navItems} className="lg:hidden" />
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen w-full max-w-full flex-col overflow-x-clip bg-background">
            <TopBar leading={topLeading} trailing={topTrailing} />
            <main className="w-full max-w-full flex-1 overflow-x-clip">
                {children}
            </main>
            <BottomNav items={navItems} />
        </div>
    );
}
