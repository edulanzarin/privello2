import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { db } from "@/lib/db";
import { getCurrentSession } from "@/server/auth/currentSession";

/**
 * Layout do painel admin.
 *
 * Bloqueia tudo abaixo de `/admin/...` pra usuários não-admin.
 * Visitante anônimo ou Cliente/Acompanhante comum sem flag
 * `User.isAdmin = true` vê redirect pra `/`. Não distingue 401 de
 * 403 propositalmente — não revelamos a existência da rota.
 *
 * Não há RBAC sofisticado no MVP: uma única flag boolean basta pra
 * conceder acesso a triagem de Verificações + Denúncias.
 */
export default async function AdminLayout({
    children,
}: {
    children: ReactNode;
}) {
    const session = await getCurrentSession();
    if (!session) {
        redirect("/");
    }
    const user = await db.user.findUnique({
        where: { id: session.userId },
        select: { isAdmin: true },
    });
    if (!user || !user.isAdmin) {
        redirect("/");
    }
    return <>{children}</>;
}
