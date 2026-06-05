import { headers } from "next/headers";
import { redirect } from "next/navigation";

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
 * {@link buildNavItems}, que monta os itens da `BottomNav`.
 *
 * # Restrição da Acompanhante
 *
 * Uma Acompanhante autenticada **não** navega nas abas públicas
 * (home, busca, reels, perfis de outras Acompanhantes). O escopo dela
 * é o próprio painel (`/acompanhante/*`, que cobre planos/boost) e o
 * **próprio** perfil público (`/acompanhantes/<seu-identificador>`).
 * Qualquer outra rota do `(shell)` redireciona para `/acompanhante`.
 *
 * Visitantes anônimos e Clientes continuam com acesso livre às páginas
 * públicas — este grupo é a casa deles.
 *
 * O `pathname` vem do header `x-pathname` injetado pelo middleware
 * (Server Components não recebem o pathname como prop).
 */

const ACOMPANHANTE_HOME = "/acompanhante";

export default async function ShellLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await getCurrentSession();

    // Gate da Acompanhante: só pode ver o próprio perfil público.
    if (session?.userType === "ACOMPANHANTE") {
        const headerStore = await headers();
        const rawPath = headerStore.get("x-pathname") ?? "";
        // Normaliza: tira trailing slash, decodifica e baixa a caixa
        // (identificador é case-insensitive — Requirement 2.4).
        const pathname = decodeURIComponent(rawPath)
            .replace(/\/+$/, "")
            .toLowerCase();
        const proprioPerfil =
            `/acompanhantes/${session.identificador}`.toLowerCase();

        // Permite apenas o próprio perfil público. Qualquer outra
        // rota pública (home, busca, reels, perfil de terceiros) é
        // redirecionada para o painel dela.
        if (pathname !== proprioPerfil) {
            redirect(ACOMPANHANTE_HOME);
        }
    }

    const navItems = buildNavItems({
        userType: session?.userType ?? null,
        identificador: session?.identificador,
    });

    return <AppShell navItems={navItems}>{children}</AppShell>;
}
