"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { SESSION_COOKIE_NAME } from "@/server/auth/sessionCookieName";
import { resolveSession, verifySessionCookie } from "@/server/auth/sessions";
import { selecionar } from "@/server/planos-cliente";

/**
 * Sistema_de_Planos_Cliente — server action de seleção de plano.
 *
 * Espelha o `selecionarPlanoAction` da Acompanhante, lendo o `tipo`
 * submetido pelo `<form>`, resolvendo o `clienteId` a partir do cookie
 * de sessão e delegando ao serviço.
 *
 * Mapeamento de resultados:
 *
 * - Sucesso → `redirect("/")` (home pública). O Cliente concluiu o
 *   onboarding e pode usar a plataforma; o foco do Cliente é solicitar
 *   serviços, não administrar perfil, então a home é o destino natural.
 * - `INVALIDO` → `{ error: "Opção inválida" }`.
 * - `PERSISTENCIA` → `{ error: "Não foi possível salvar. Tente
 *   novamente." }`, preservando o estado "sem Plano vigente" para
 *   nova tentativa.
 *
 * Premissa de autenticação: o `layout.tsx` da rota `cliente` já
 * garante sessão válida com `userType=CLIENTE`. Esta action faz uma
 * checagem defensiva adicional e lança um `Error` se a sessão não
 * puder ser resolvida.
 */

/** Forma do retorno em caso de erro. Sucesso redireciona via `redirect()`. */
export type SelecionarPlanoClienteActionError = { error: string };

/**
 * Submete a seleção de plano do Cliente autenticado.
 *
 * Espera-se que o `formData` contenha:
 * - `tipo`: a string crua submetida pelo formulário. Valores aceitos
 *   são exatamente `"GRATIS"` e `"FAN"`.
 */
export async function selecionarPlanoClienteAction(
    formData: FormData,
): Promise<SelecionarPlanoClienteActionError | void> {
    const tipoRaw = formData.get("tipo");
    if (typeof tipoRaw !== "string") {
        return { error: "Opção inválida" };
    }

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

    const result = await selecionar(session.userId, tipoRaw);

    if (!result.ok) {
        if (result.reason === "INVALIDO") {
            return { error: "Opção inválida" };
        }
        if (result.reason === "DOWNGRADE_NAO_PERMITIDO") {
            return {
                error: "Você já tem um plano superior. Não é possível trocar para um plano menor.",
            };
        }
        return { error: "Não foi possível salvar. Tente novamente." };
    }

    redirect("/cliente");
}
