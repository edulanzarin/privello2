"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { resolveSession, verifySessionCookie } from "@/server/auth/sessions";
import { selecionar } from "@/server/planos";

/**
 * Sistema_de_Planos — server action de Selecao_de_Plano.
 *
 * Esta é a ponte HTTP entre o formulário em
 * `src/app/(acompanhante)/selecao-plano/page.tsx` e o caso de uso
 * `selecionar(acompanhanteId, tipo)` em `src/server/planos/index.ts`.
 *
 * A action lê o `tipo` enviado pelo `<form>`, resolve o
 * `acompanhanteId` a partir do cookie de sessão (assinado por
 * {@link verifySessionCookie}; resolvido por {@link resolveSession}) e
 * delega ao serviço.
 *
 * Mapeamento de resultados, conforme Requirements 5.4, 5.8, 5.9 e 5.10:
 *
 * - Sucesso → `redirect("/acompanhante")` (Requirement 5.10).
 * - `INVALIDO` → `{ error: "Opção inválida" }` (Requirement 5.8).
 * - `PERSISTENCIA` → `{ error: "Não foi possível salvar. Tente
 *   novamente." }` (Requirement 5.9), preservando o estado
 *   "sem Plano vigente" para nova tentativa.
 *
 * Premissa de autenticação: o `layout.tsx` do route group
 * `(acompanhante)` (task 12.1) já garante que apenas Acompanhantes
 * autenticadas chegam aqui. Esta action faz uma checagem defensiva
 * adicional e lança um `Error` se, mesmo assim, a sessão não puder ser
 * resolvida — situação que indica adulteração do cookie ou expiração
 * fora da janela do middleware.
 */

/**
 * Nome do cookie que carrega o `sessionId` assinado emitido por
 * `signSessionCookie`. Mantido em sincronia com:
 * - `SESSION_COOKIE_NAME` em `src/app/api/auth/login/route.ts`,
 * - `SESSION_COOKIE_NAME` em `src/server/auth/logout.ts`.
 */
const SESSION_COOKIE_NAME = "sessionId";

/**
 * Forma do retorno em caso de erro da action. Em caso de sucesso a
 * action redireciona via `redirect()` e portanto não retorna valor.
 */
export type SelecionarPlanoActionError = { error: string };

/**
 * Submete a Selecao_de_Plano da Acompanhante autenticada.
 *
 * Espera-se que o `formData` contenha:
 * - `tipo`: a string crua submetida pelo formulário. Valores aceitos
 *   pelo serviço são exatamente `"BASICO"` e `"PREMIUM"`.
 *
 * @param formData Dados do `<form>` submetido pela página.
 * @returns `void` em caso de sucesso (após `redirect`); ou
 *          `{ error: string }` quando o serviço sinaliza falha.
 */
export async function selecionarPlanoAction(
    formData: FormData,
): Promise<SelecionarPlanoActionError | void> {
    const tipoRaw = formData.get("tipo");
    if (typeof tipoRaw !== "string") {
        return { error: "Opção inválida" };
    }

    const cookieStore = await cookies();
    const rawCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    const sessionId = await verifySessionCookie(rawCookie);
    if (sessionId === null) {
        // Em condições normais o middleware/layout impede chegar aqui;
        // tratamos como erro programático se ocorrer.
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

    redirect("/acompanhante");
}
