import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { AppShell } from "@/components";
import { buildNavItems } from "@/components/shell/navItems";
import { resolveSession, verifySessionCookie } from "@/server/auth/sessions";

/**
 * Layout do route group `(cliente)`.
 *
 * # Por que a checagem profunda acontece aqui
 *
 * `src/middleware.ts` valida apenas a **assinatura HMAC** do cookie de
 * sessão, porque o Edge Runtime onde o middleware roda não tem acesso
 * ao Prisma Client. Este layout é um Server Component que executa no
 * runtime Node.js e portanto pode:
 *
 * 1. Resolver a sessão completa via `resolveSession` (que confirma
 *    expiração e revogação contra a tabela `sessions` no Postgres —
 *    Requirements 1.5 e 1.7).
 * 2. Diferenciar o tipo do usuário (`CLIENTE` x `ACOMPANHANTE` —
 *    Requirement 1.6) e expulsar quem não for `CLIENTE` para `/login`.
 *
 * Após as checagens, o conteúdo é envolvido pelo {@link AppShell},
 * herdando a TopBar com {@link import("@/components").Logo}
 * centralizada e a {@link import("@/components").BottomNav} de quatro
 * abas — mesma navegação das demais áreas, com a aba "Conta" apontando
 * para `/cliente`.
 *
 * Cobre os Requirements 1.6 e 1.7 para o segmento `(cliente)`.
 */
export default async function ClienteLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    // O middleware já verificou a assinatura e injetou `x-session-id`
    // quando válida. Em casos extremos (matcher dessincronizado, build
    // sem middleware), relemos o cookie diretamente como fallback.
    const headerStore = await headers();
    const headerSessionId = headerStore.get("x-session-id");

    let sessionId: string | null = headerSessionId;
    if (!sessionId) {
        const cookieStore = await cookies();
        sessionId = await verifySessionCookie(
            cookieStore.get("sessionId")?.value,
        );
    }

    if (!sessionId) {
        redirect("/login");
    }

    const session = await resolveSession(sessionId);
    if (!session || session.userType !== "CLIENTE") {
        redirect("/login");
    }

    const navItems = buildNavItems("CLIENTE");
    return <AppShell navItems={navItems}>{children}</AppShell>;
}
