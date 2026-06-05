"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { SESSION_COOKIE_NAME } from "@/server/auth/sessionCookieName";
import { resolveSession, verifySessionCookie } from "@/server/auth/sessions";
import { criarPagamentoPlano } from "@/server/planos";
import type { PlanoTipo } from "@/domain/plano/definitions";

export type ComprarPlanoActionError = { error: string };

async function resolverAcompanhanteId(): Promise<string> {
    const cookieStore = await cookies();
    const rawCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    const sessionId = await verifySessionCookie(rawCookie);
    if (sessionId === null) throw new Error("Sessão inválida ou ausente.");
    const session = await resolveSession(sessionId);
    if (session === null) throw new Error("Sessão inválida ou ausente.");
    return session.userId;
}

/**
 * Inicia o checkout do Stripe para compra de Plano Básico ou Premium.
 *
 * Espera no `formData`:
 *   - `tipo`: `"BASICO"` ou `"PREMIUM"`.
 *
 * Em sucesso redireciona pro checkout do Stripe.
 * O webhook do Stripe ativa o plano após pagamento aprovado.
 */
export async function comprarPlanoAcompanhanteAction(
    formData: FormData,
): Promise<ComprarPlanoActionError | void> {
    const tipoRaw = formData.get("tipo");
    if (tipoRaw !== "BASICO" && tipoRaw !== "PREMIUM") {
        return { error: "Opção inválida" };
    }

    const userId = await resolverAcompanhanteId();

    const baseUrl =
        process.env.NEXT_PUBLIC_SITE_URL ||
        process.env.NEXT_PUBLIC_APP_URL ||
        "http://localhost:3000";

    const result = await criarPagamentoPlano({
        userId,
        plano: tipoRaw as PlanoTipo,
        baseUrl,
    });

    if (!result.ok) {
        if (result.reason === "PAGAMENTO_NAO_CONFIGURADO") {
            return { error: "Pagamento não configurado. Contate o suporte." };
        }
        if (result.reason === "PLANO_INVALIDO") {
            return { error: "Opção inválida" };
        }
        return { error: "Não foi possível processar agora. Tente novamente." };
    }

    redirect(result.checkoutUrl);
}
