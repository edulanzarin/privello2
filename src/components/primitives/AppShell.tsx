import * as React from "react";

import { BottomNav, type BottomNavItem } from "./BottomNav";
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
     * Conteúdo opcional renderizado entre o `<main>` e a
     * {@link BottomNav}. Tipicamente um rodapé com links
     * institucionais. Sem nomes de domínio nas props (Property 29);
     * o consumidor passa o componente real.
     */
    belowMain?: React.ReactNode;
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
 */
export function AppShell({
    navItems,
    topLeading,
    topTrailing,
    belowMain,
    children,
}: AppShellProps): React.ReactElement {
    return (
        <div className="flex min-h-screen w-full max-w-full flex-col overflow-x-clip bg-background">
            <TopBar leading={topLeading} trailing={topTrailing} />
            <main className="w-full max-w-full flex-1 overflow-x-clip">
                {children}
            </main>
            {belowMain}
            <BottomNav items={navItems} />
        </div>
    );
}
