"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { SESSION_COOKIE_NAME } from "@/server/auth/sessionCookieName";
import { resolveSession, verifySessionCookie } from "@/server/auth/sessions";
import { criarPagamentoFan, selecionar } from "@/server/planos-cliente";
import type { PlanoClienteDuracao } from "@/domain/plano-cliente/definitions";

/**
 * Sistema_de_Planos_Cliente — server actions de seleção e compra.
 *
 * Duas ações distintas:
 *
 *   - {@link selecionarPlanoClienteAction}: para opção sem custo
 *     (`GRATIS`). Idempotente; aceita `tipo` cru do formulário.
 *   - {@link comprarFanClienteAction}: para compra de Fan com
 *     duração específica (`FAN_24H`, `FAN_7D`, `FAN_30D`). Cria
 *     um checkout session do Stripe e redireciona o usuário.
 *     O webhook do Stripe ativa o plano após pagamento aprovado.
 *
 * Premissa de autenticação: o `layout.tsx` da rota `cliente` já
 * garante sessão válida com `userType=CLIENTE`. Estas actions
 * fazem uma checagem defensiva adicional e lançam `Error` se a
 * sessão não puder ser resolvida.
 */

/** Forma do retorno em caso de erro. Sucesso redireciona. */
export type SelecionarPlanoClienteActionError = { error: string };

async function resolverClienteId(): Promise<string> {
    const cookieStore = await cookies();
    const rawCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    const sessionId = await verifySessionCookie(rawCookie);
    if (sessionId === null) {
        throw new Error("Sessão inválida ou ausente.");
    }
    const session = await resolveSession(sessionId);
    if (session === null) {
        throw new Error("Sessão inválida ou ausente.");
    }
    return session.userId;
}

/**
 * Submete a seleção do plano `GRATIS` (idempotente).
 *
 * Espera no `formData`:
 *   - `tipo`: a string `"GRATIS"`. Outros valores caem em
 *     `INVALIDO`.
 */
export async function selecionarPlanoClienteAction(
    formData: FormData,
): Promise<SelecionarPlanoClienteActionError | void> {
    const tipoRaw = formData.get("tipo");
    if (typeof tipoRaw !== "string") {
        return { error: "Opção inválida" };
    }

    const userId = await resolverClienteId();
    const result = await selecionar(userId, tipoRaw);

    if (!result.ok) {
        if (result.reason === "INVALIDO") {
            return { error: "Opção inválida" };
        }
        if (result.reason === "DOWNGRADE_NAO_PERMITIDO") {
            return {
                error: "Você ainda tem Fan ativo. Aguarde expirar para voltar pro Grátis.",
            };
        }
        return { error: "Não foi possível salvar. Tente novamente." };
    }

    redirect("/cliente");
}

/**
 * Submete a compra de uma duração de Fan.
 *
 * Espera no `formData`:
 *   - `duracao`: chave da duração (`FAN_24H` | `FAN_7D` | `FAN_30D`).
 *
 * Cria um checkout session do Stripe e redireciona o usuário.
 * O webhook do Stripe ativa o plano após pagamento aprovado.
 */
export async function comprarFanClienteAction(
    formData: FormData,
): Promise<SelecionarPlanoClienteActionError | void> {
    const duracaoRaw = formData.get("duracao");
    if (typeof duracaoRaw !== "string") {
        return { error: "Opção inválida" };
    }

    if (duracaoRaw !== "FAN_24H" && duracaoRaw !== "FAN_7D" && duracaoRaw !== "FAN_30D") {
        return { error: "Opção inválida" };
    }

    const userId = await resolverClienteId();
    
    // Busca o email do usuário para preencher no checkout.
    const cookieStore = await cookies();
    const rawCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    const sessionId = await verifySessionCookie(rawCookie);
    if (sessionId === null) {
        return { error: "Sessão inválida" };
    }
    const session = await resolveSession(sessionId);
    if (session === null) {
        return { error: "Sessão inválida" };
    }
    
    // Determina o baseUrl para o checkout.
    const baseUrl =
        process.env.NEXT_PUBLIC_SITE_URL ||
        process.env.NEXT_PUBLIC_APP_URL ||
        "http://localhost:3000";

    const result = await criarPagamentoFan({
        userId,
        duracao: duracaoRaw as PlanoClienteDuracao,
        baseUrl,
    });

    if (!result.ok) {
        if (result.reason === "DURACAO_INVALIDA") {
            return { error: "Opção inválida" };
        }
        if (result.reason === "PAGAMENTO_NAO_CONFIGURADO") {
            return { error: "Pagamento não configurado. Contate o suporte." };
        }
        return { error: "Não foi possível processar agora. Tente novamente." };
    }

    // Redireciona pro checkout do Stripe.
    redirect(result.checkoutUrl);
}
