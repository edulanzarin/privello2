import * as React from "react";

import { Logo } from "./Logo";

/**
 * Props do {@link TopBar}.
 *
 * Barra superior fina e sticky. Mostra o {@link Logo} centralizado e
 * oferece slots opcionais nas extremidades para botões/links de
 * navegação contextual (ex.: "Voltar", "Sair").
 *
 * Nenhuma prop carrega nomes de entidades de domínio (Property 29).
 */
export interface TopBarProps {
    /** Conteúdo opcional alinhado à esquerda (ex.: botão "Voltar"). */
    leading?: React.ReactNode;
    /** Conteúdo opcional alinhado à direita (ex.: botão "Sair"). */
    trailing?: React.ReactNode;
    /** Classes extras aplicadas ao `<header>`. */
    className?: string;
}

/**
 * TopBar — cabeçalho fixo da aplicação autenticada/pública.
 *
 * Características:
 * - `position: sticky` em `top-0`, permanece visível durante o scroll.
 * - Borda inferior sutil para separar do conteúdo abaixo.
 * - {@link Logo} centralizado horizontalmente.
 * - Altura fixa em `h-14` para coexistir com o {@link BottomNav} sem
 *   competir por espaço.
 */
export function TopBar({
    leading,
    trailing,
    className,
}: TopBarProps): React.ReactElement {
    const composed = [
        "sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b border-neutral-200 bg-surface/90 px-4 backdrop-blur-sm",
        className ?? "",
    ]
        .filter(Boolean)
        .join(" ");

    return (
        <header className={composed}>
            <div className="flex flex-1 justify-start">{leading}</div>
            <div className="flex flex-none items-center justify-center">
                <Logo />
            </div>
            <div className="flex flex-1 justify-end">{trailing}</div>
        </header>
    );
}
