"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { SESSION_COOKIE_NAME } from "@/server/auth/sessionCookieName";
import { resolveSession, verifySessionCookie } from "@/server/auth/sessions";
import { comprarFan, selecionar } from "@/server/planos-cliente";

/**
 * Sistema_de_Planos_Cliente — server actions de seleção e compra.
 *
 * Duas ações distintas:
 *
 *   - {@link selecionarPlanoClienteAction}: para opção sem custo
 *     (`GRATIS`). Idempotente; aceita `tipo` cru do formulário.
 *   - {@link comprarFanClienteAction}: para compra de Fan com
 *     duração específica (`FAN_24H`, `FAN_7D`, `FAN_30D`). Quando
 *     o Mercado Pago real estiver plugado, esta ação cria uma
 *     `Preference` e redireciona pro `init_point`. Hoje (sem
 *     credenciais MP), aplica direto `comprarFan(duracao)` —
 *     suficiente para dev/staging.
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
 * Hoje aplica direto via `comprarFan` (não há checkout MP real).
 * Quando as credenciais MP entrarem, este path cria `Preference` e
 * redireciona — `comprarFan` então é chamado pelo webhook.
 */
export async function comprarFanClienteAction(
    formData: FormData,
): Promise<SelecionarPlanoClienteActionError | void> {
    const duracaoRaw = formData.get("duracao");
    if (typeof duracaoRaw !== "string") {
        return { error: "Opção inválida" };
    }

    const userId = await resolverClienteId();
    const result = await comprarFan(userId, duracaoRaw);

    if (!result.ok) {
        if (result.reason === "INVALIDO") {
            return { error: "Opção inválida" };
        }
        return { error: "Não foi possível processar agora. Tente novamente." };
    }

    redirect("/cliente");
}
