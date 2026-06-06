import { cookies, headers } from "next/headers";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AppShell, SiteFooter } from "@/components";
import { buildNavItems } from "@/components/shell/navItems";
import { NotificationBell } from "@/components/shell/NotificationBell";
import { SESSION_COOKIE_NAME } from "@/server/auth/sessionCookieName";
import { resolveSession, verifySessionCookie } from "@/server/auth/sessions";
import { obterVigente } from "@/server/planos";
import { db } from "@/lib/db";

/**
 * Painel privado da Acompanhante — `noindex` por defesa em profundidade.
 */
export const metadata: Metadata = {
    title: "Conta · Privello",
    robots: { index: false, follow: false },
};

/**
 * Layout do route group `(acompanhante)`.
 *
 * # Por que a checagem profunda acontece aqui
 *
 * `src/middleware.ts` roda no Edge Runtime e não pode acessar o Prisma
 * Client. Logo, ele apenas valida a assinatura HMAC do cookie de
 * sessão e redireciona para `/login` quando a assinatura está
 * ausente/inválida em rotas protegidas. As checagens que dependem do
 * banco de dados ficam aqui:
 *
 * 1. Resolução completa da sessão via `resolveSession` — confirma
 *    expiração e revogação (Requirements 1.5, 1.7) e expõe `userType`
 *    (Requirement 1.6).
 * 2. Verificação do plano vigente via `obterVigente`. Conforme os
 *    Requirements 5.5 e 5.10, com regra adicional de upgrade:
 *    - **Sem plano** (`planoVigente === null`): só pode acessar
 *      `/acompanhante/selecao-plano`. Outras rotas redirecionam pra
 *      lá (caminho do onboarding).
 *    - **Com plano que ainda permite upgrade** (`BASICO`): pode
 *      acessar tudo, inclusive a página de planos para fazer
 *      upgrade pro Premium.
 *    - **Com plano máximo** (`PREMIUM`): pode acessar tudo **exceto**
 *      `/acompanhante/selecao-plano` — não há upgrade possível, e
 *      downgrade ativo é proibido. A página redireciona pra home.
 *
 * Após as checagens, o conteúdo é envolvido pelo {@link AppShell}
 * (mesma TopBar e {@link import("@/components").BottomNav} usados em
 * `(shell)`), reaproveitando a navegação global da plataforma e
 * garantindo paridade visual com Cliente e visitantes anônimos.
 *
 * O `pathname` da requisição é lido do header `x-pathname`, que o
 * middleware injeta antes de delegar para os layouts (já que Server
 * Components não recebem o pathname como prop).
 */

const SELECAO_PLANO_PATH = "/acompanhante/selecao-plano";
const ACOMPANHANTE_HOME = "/acompanhante";

export default async function AcompanhanteLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const headerStore = await headers();
    const headerSessionId = headerStore.get("x-session-id");
    const pathname = headerStore.get("x-pathname") ?? "";
    const search = headerStore.get("x-search") ?? "";

    let sessionId: string | null = headerSessionId;
    if (!sessionId) {
        const cookieStore = await cookies();
        sessionId = await verifySessionCookie(
            cookieStore.get(SESSION_COOKIE_NAME)?.value,
        );
    }

    if (!sessionId) {
        redirect("/login");
    }

    const session = await resolveSession(sessionId);
    if (!session || session.userType !== "ACOMPANHANTE") {
        redirect("/login");
    }

    const planoVigente = await obterVigente(session.userId);
    const isOnSelecaoPlano = pathname === SELECAO_PLANO_PATH;

    if (planoVigente === null && !isOnSelecaoPlano) {
        // Sem plano: só pode estar na página de seleção. Preserva o
        // `?payment=...` pra que, após um PIX pendente, a página de
        // seleção mostre o aviso "pagamento recebido, aguarde".
        const params = new URLSearchParams(search);
        const payment = params.get("payment") ?? params.get("status");
        const destino = payment
            ? `${SELECAO_PLANO_PATH}?payment=${encodeURIComponent(payment)}`
            : SELECAO_PLANO_PATH;
        redirect(destino);
    }
    if (planoVigente !== null && isOnSelecaoPlano) {
        // Com plano: só permite acessar a página de seleção quando
        // ainda há upgrade possível. Para o Premium (plano máximo)
        // não faz sentido entrar na página — manda pra home.
        if (planoVigente.tipo === "PREMIUM") {
            redirect(ACOMPANHANTE_HOME);
        }
        // Para Básico, deixa entrar (vai poder upgrade pra Premium).
    }

    // Identificador é necessário para a aba "Perfil público" da
    // BottomNav apontar para o slug correto. Lemos por `userId` aqui
    // porque a `Session` só carrega o id opaco.
    const user = await db.user.findUnique({
        where: { id: session.userId },
        select: { identificador: true },
    });

    const navItems = buildNavItems({
        userType: "ACOMPANHANTE",
        identificador: user?.identificador,
    });
    return (
        <AppShell
            navItems={navItems}
            topTrailing={<NotificationBell />}
            belowMain={<SiteFooter />}
        >
            {children}
        </AppShell>
    );
}
