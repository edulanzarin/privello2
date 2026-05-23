"use server";

/**
 * Server Action do cadastro de Cliente.
 *
 * Esta action implementa a costura HTTP descrita por design.md
 * (`Sistema_de_Cadastro_Cliente`) e cumpre os Requirements 2.1, 2.2,
 * 2.9 e 2.10:
 *
 *   1. Lê os campos do formulário a partir de `FormData` e os encaminha
 *      ao serviço {@link registrar} sem reimplementar regras de
 *      validação (a validação é feita por `cadastroClienteSchema`
 *      consumido pelo serviço — Requirement 2.1).
 *   2. Em sucesso, assina o `sessionId` retornado com
 *      {@link signSessionCookie} e o coloca em um cookie HTTP-only
 *      `SESSION_COOKIE_NAME` com `Path=/`, `SameSite=Lax` e
 *      `Secure` em produção (Requirement 2.10), e redireciona para
 *      `/cliente/selecao-plano` para que o Cliente escolha entre
 *      `GRATIS` e `FAN` (`Sistema_de_Planos_Cliente`). Diferente da
 *      Acompanhante, esse plano não bloqueia acesso — é apenas uma
 *      etapa de descoberta logo após o cadastro.
 *   3. Em falha de validação (`VALIDACAO`), retorna um mapa
 *      `campo → mensagem` no formato esperado por `useActionState`
 *      para que a UI exiba a mensagem por campo via `error`/
 *      `errorMessage` no `Input` (Requirement 2.9).
 *   4. Em colisão de email/identificador, traduz `EMAIL_EM_USO` /
 *      `IDENTIFICADOR_EM_USO` em mensagens genéricas (Requirements 2.3
 *      e 2.4 da camada de UI).
 *
 * A action **não** loga senha nem ecoa de volta para a UI; apenas o
 * `nome`, `email` e `identificador` são preservados para repopular os
 * campos do formulário após uma falha.
 */

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { SESSION_COOKIE_NAME } from "@/server/auth/logout";
import { signSessionCookie } from "@/server/auth/sessions";
import { registrar } from "@/server/cadastro-cliente";

/** Campos públicos do formulário de cadastro de Cliente. */
const FIELD_NAMES = [
    "nome",
    "email",
    "identificador",
    "senha",
    "fotoPerfil",
] as const;
type FieldName = (typeof FIELD_NAMES)[number];

/** Estado consumido pelo `useActionState` na página
 * `cadastro/cliente/page.tsx`. Contém apenas erros — em sucesso a
 * action redireciona e nunca retorna.
 */
export type CadastroClienteFormState = {
    /**
     * Erros por campo. Em validação, vem do mapa `detalhes` do serviço.
     * Em colisões, é preenchido com a mensagem genérica do campo
     * correspondente. `undefined` quando o formulário ainda não foi
     * submetido ou submeteu com sucesso.
     */
    fieldErrors?: Partial<Record<FieldName, string>>;
    /**
     * Valores ecoados (sem `senha`) para repopular o formulário após
     * uma falha. Não-confidenciais por construção. A `stagedKey` da
     * Foto_de_Perfil é mantida para que o usuário não precise re-upar
     * a imagem depois de corrigir um campo de texto inválido.
     */
    values?: {
        nome?: string;
        email?: string;
        identificador?: string;
        fotoStagedKey?: string;
    };
};

/** Mensagens genéricas para colisões de unicidade (Requirements 2.3, 2.4). */
const COLLISION_MESSAGES = {
    email: "Este email já está em uso",
    identificador: "Este identificador já está em uso",
} as const;

/**
 * Server Action chamada pelo `<form action>` da página de cadastro de
 * Cliente. Em sucesso, define o cookie de sessão e redireciona para
 * `/cliente/selecao-plano`; em falha, retorna o estado com erros
 * para a UI.
 */
export async function registrarClienteAction(
    _prevState: CadastroClienteFormState,
    formData: FormData,
): Promise<CadastroClienteFormState> {
    const nome = String(formData.get("nome") ?? "");
    const email = String(formData.get("email") ?? "");
    const identificador = String(formData.get("identificador") ?? "");
    const senha = String(formData.get("senha") ?? "");

    // Foto_de_Perfil é opcional. Quando o usuário escolheu uma imagem,
    // a página já fez o upload no endpoint de staging
    // (`POST /api/cadastro/cliente/foto`) e injetou os três campos
    // hidden (`fotoStagedKey`, `fotoMimeType`, `fotoSizeBytes`) no
    // submit. Quando os três estão preenchidos e bem formados, montamos
    // o objeto `fotoPerfil` para `registrar()`. Em qualquer outro
    // estado (ausente, parcial ou inválido), seguimos sem foto — o
    // `cadastroClienteSchema` aceita `fotoPerfil` opcional, então só
    // emitiremos `VALIDACAO` se um valor foi passado e violou o
    // contrato canônico.
    const stagedKeyRaw = formData.get("fotoStagedKey");
    const mimeTypeRaw = formData.get("fotoMimeType");
    const sizeBytesRaw = formData.get("fotoSizeBytes");

    let fotoPerfil:
        | { mimeType: string; sizeBytes: number; stagedKey: string }
        | undefined;
    if (
        typeof stagedKeyRaw === "string" &&
        stagedKeyRaw.length > 0 &&
        typeof mimeTypeRaw === "string" &&
        mimeTypeRaw.length > 0 &&
        typeof sizeBytesRaw === "string"
    ) {
        const sizeBytes = Number(sizeBytesRaw);
        if (Number.isFinite(sizeBytes) && Number.isInteger(sizeBytes)) {
            fotoPerfil = {
                mimeType: mimeTypeRaw,
                sizeBytes,
                stagedKey: stagedKeyRaw,
            };
        }
    }

    const result = await registrar({
        nome,
        email,
        identificador,
        senha,
        fotoPerfil,
    });

    if (result.ok) {
        const cookieStore = await cookies();
        cookieStore.set({
            name: SESSION_COOKIE_NAME,
            value: await signSessionCookie(result.sessionId),
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
            path: "/",
        });
        // `redirect` lança internamente; nada após esta linha executa.
        // Cliente recém-cadastrado vai direto para a tela de seleção
        // de plano (`Sistema_de_Planos_Cliente`). Diferente da
        // Acompanhante, o plano não bloqueia acesso à plataforma —
        // mas oferecemos a escolha logo após o cadastro para que o
        // Cliente já comece com Grátis ou Fan ativo.
        redirect("/cliente/selecao-plano");
    }

    // Valores preservados para repopular o formulário (sem `senha`).
    // A `stagedKey` da foto é preservada para que o usuário não precise
    // re-upar a imagem após corrigir um campo de texto.
    const echoed = {
        nome,
        email,
        identificador,
        fotoStagedKey:
            typeof stagedKeyRaw === "string" && stagedKeyRaw.length > 0
                ? stagedKeyRaw
                : undefined,
    } as const;

    switch (result.reason) {
        case "VALIDACAO": {
            const detalhes = result.detalhes ?? {};
            const fieldErrors: Partial<Record<FieldName, string>> = {};
            for (const field of FIELD_NAMES) {
                const message = detalhes[field];
                if (typeof message === "string" && message.length > 0) {
                    fieldErrors[field] = message;
                }
            }
            return { fieldErrors, values: echoed };
        }
        case "EMAIL_EM_USO": {
            return {
                fieldErrors: { email: COLLISION_MESSAGES.email },
                values: echoed,
            };
        }
        case "IDENTIFICADOR_EM_USO": {
            return {
                fieldErrors: {
                    identificador: COLLISION_MESSAGES.identificador,
                },
                values: echoed,
            };
        }
    }
}
