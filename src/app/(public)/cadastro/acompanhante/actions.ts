"use server";

/**
 * Server Actions do Sistema_de_Onboarding (multi-step UI).
 *
 * Conecta os formulários da página dinâmica
 * `src/app/(public)/cadastro/acompanhante/[step]/page.tsx` aos casos
 * de uso em `@/server/onboarding`:
 *
 *   - {@link salvarEtapaAction}: aplica um patch no `OnboardingDraft`
 *     ativo via `atualizarEtapa`. O `onboardingId` é lido do cookie
 *     opaco gravado pelo route handler de entrada
 *     (`/cadastro/acompanhante`), parseado por
 *     {@link parseOnboardingCookie}. Em sucesso, redireciona para o
 *     próximo passo (passado como campo `_next`); em falha, devolve
 *     erros por campo para `useActionState`.
 *   - {@link uploadFotoAction}: lê o `File` do `FormData` e chama
 *     `uploadFoto`, retornando o `stagedKey` em sucesso.
 *   - {@link finalizarAction}: chama `finalizar`. Em sucesso, assina o
 *     `sessionId` com {@link signSessionCookie} e redireciona para
 *     `/acompanhante/selecao-plano` (Requirement 3.11). Em falha,
 *     devolve a razão para a UI renderizar mensagem amigável.
 *
 * Estes handlers nunca relogam senha, e `salvarEtapaAction` apenas
 * persiste o que veio do passo corrente — nenhuma validação cruzada
 * entre steps acontece aqui. A revalidação completa (Property 16) é
 * feita por `finalizar` ao final do fluxo.
 *
 * Validates: Requirements 3.1, 3.2, 3.10, 3.11, 3.12.
 */

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import {
    cadastroClienteSchema,
} from "@/domain/schemas";
import {
    ALTURA_CM,
    PESO_KG,
    TAMANHO_PE,
    isCorOlhos,
    isEstiloCabelo,
    isEtnia,
    isIdioma,
    isTamanhoCabelo,
} from "@/domain/aparencia/definitions";
import { isGenero } from "@/domain/genero";
import { isAtende, isPratica } from "@/domain/atendimento";
import {
    isDiaSemana,
    isFormaPagamento,
    VALOR_HORA_CENTS,
} from "@/domain/atendimentoComercial";
import {
    validarDescricao,
    validarTelefone,
    normalizarTelefone,
} from "@/domain/validation";
import { SESSION_COOKIE_NAME } from "@/server/auth/logout";
import { signSessionCookie } from "@/server/auth/sessions";
import {
    DraftExpiredError,
    DraftNotFoundError,
    InvalidFotoPerfilError,
    atualizarEtapa,
    finalizar,
    parseOnboardingCookie,
    uploadFoto,
    ONBOARDING_COOKIE_NAME,
    type DraftPayload,
} from "@/server/onboarding";

import type {
    SalvarEtapaState,
    UploadFotoState,
    FinalizarState,
} from "./action-state";

// ---------------------------------------------------------------------------
// Helpers de cookie
// ---------------------------------------------------------------------------

/**
 * Lê o `onboardingId` ativo do cookie opaco. Tenta primeiro o helper
 * tipado de `next/headers`; em ambientes onde o cookie chega apenas no
 * header bruto (testes), cai para {@link parseOnboardingCookie}.
 */
async function getOnboardingId(): Promise<string | null> {
    const cookieStore = await cookies();
    const direct = cookieStore.get(ONBOARDING_COOKIE_NAME)?.value;
    if (typeof direct === "string" && direct.length > 0) {
        return direct;
    }
    const headerStore = await headers();
    return parseOnboardingCookie(headerStore.get("cookie"));
}

// ---------------------------------------------------------------------------
// salvarEtapaAction
// ---------------------------------------------------------------------------

/**
 * Mapa de validações por step. Cada entrada lê os campos relevantes do
 * `FormData`, retorna `{ patch, errors, values }` onde:
 *
 * - `patch` é o objeto a mesclar no `OnboardingDraft` (chaves descritas
 *   pelo design, `OnboardingData`).
 * - `errors` é o mapa `campo → mensagem` exibido na UI quando há
 *   violações.
 * - `values` é o eco dos valores submetidos para repopular o
 *   formulário em caso de erro. Aceita primitivos `string|number|
 *   boolean` e arrays de string para acomodar campos de aparência
 *   (peso/altura numéricos, switches booleanos, idiomas multi-select).
 *
 * Apenas o step 1 (identidade) e os campos com regra de domínio
 * (telefone, descrição, localidade, aparência) recebem validação aqui —
 * o step "foto" não passa por esta action (vai pelo
 * {@link uploadFotoAction}) e o step "confirmação" pula direto para
 * {@link finalizarAction}.
 */
type StepValuePrimitive =
    | string
    | number
    | boolean
    | ReadonlyArray<string>;
type StepValues = Record<string, StepValuePrimitive>;
type StepHandler = (formData: FormData) => {
    patch: DraftPayload;
    errors: Record<string, string>;
    values: StepValues;
};

const STEP_HANDLERS: Record<string, StepHandler> = {
    identidade: (formData) => {
        const nome = String(formData.get("nome") ?? "");
        const email = String(formData.get("email") ?? "");
        const identificador = String(formData.get("identificador") ?? "");
        const senha = String(formData.get("senha") ?? "");

        const parsed = cadastroClienteSchema.safeParse({
            nome,
            email,
            identificador,
            senha,
        });

        const errors: Record<string, string> = {};
        const patch: DraftPayload = {};

        if (!parsed.success) {
            for (const issue of parsed.error.issues) {
                const key = issue.path[0];
                if (typeof key === "string" && !(key in errors)) {
                    errors[key] = issue.message;
                }
            }
        } else {
            patch.nome = parsed.data.nome;
            patch.email = parsed.data.email;
            patch.identificador = parsed.data.identificador;
            patch.senha = parsed.data.senha;
        }

        // Eco dos valores (sem `senha`).
        const values = { nome, email, identificador };
        return { patch, errors, values };
    },

    telefone: (formData) => {
        const telefone = String(formData.get("telefone") ?? "");
        const errors: Record<string, string> = {};
        const patch: DraftPayload = {};

        if (!validarTelefone(telefone)) {
            errors.telefone =
                "Telefone deve ter 10 ou 11 dígitos com DDD.";
        } else {
            patch.telefone = normalizarTelefone(telefone);
        }
        return { patch, errors, values: { telefone } };
    },

    localidade: (formData) => {
        const estadoSigla = String(formData.get("estadoSigla") ?? "").trim();
        const cidadeNome = String(formData.get("cidadeNome") ?? "").trim();
        const bairroNomeRaw = String(formData.get("bairroNome") ?? "").trim();
        const errors: Record<string, string> = {};
        const patch: DraftPayload = {};

        if (!/^[A-Z]{2}$/.test(estadoSigla)) {
            errors.estadoSigla = "Selecione um estado.";
        } else {
            patch.estadoSigla = estadoSigla;
        }
        if (cidadeNome.length === 0) {
            errors.cidadeNome = "Selecione uma cidade.";
        } else if (cidadeNome.length > 120) {
            errors.cidadeNome = "Cidade muito longa.";
        } else {
            patch.cidadeNome = cidadeNome;
        }

        // O `bairroNome` só chega preenchido quando a UI confirmou
        // uma seleção da lista da API (Overpass/OSM). Aqui validamos
        // somente o tamanho como defesa e o gravamos. Vazio significa
        // "não informado" e é gravado como `null` para limpar
        // explicitamente a coluna se o usuário voltou ao passo e
        // desselecionou o bairro.
        if (bairroNomeRaw.length > 0) {
            if (bairroNomeRaw.length > 120) {
                errors.bairroNome = "Bairro muito longo.";
            } else {
                patch.bairroNome = bairroNomeRaw;
            }
        } else {
            patch.bairroNome = null;
        }

        return {
            patch,
            errors,
            values: {
                estadoSigla,
                cidadeNome,
                bairroNome: bairroNomeRaw,
            },
        };
    },

    aparencia: (formData) => {
        // Numéricos com range, enums e idiomas são **obrigatórios**.
        // Os switches (silicone, tatuagens, piercing, fumante) são
        // booleanos com default `false` quando o usuário não marcar.
        const errors: Record<string, string> = {};
        const patch: DraftPayload = {};
        const values: StepValues = {};

        // -- Numéricos com range (peso, altura, tamanho do pé) -----------
        const numericFields = [
            { key: "pesoKg" as const, range: PESO_KG, labelMin: "Peso", unit: "kg" },
            {
                key: "alturaCm" as const,
                range: ALTURA_CM,
                labelMin: "Altura",
                unit: "cm",
            },
            {
                key: "tamanhoPe" as const,
                range: TAMANHO_PE,
                labelMin: "Tamanho do pé",
                unit: "",
            },
        ];
        for (const field of numericFields) {
            const raw = String(formData.get(field.key) ?? "").trim();
            if (raw.length === 0) {
                errors[field.key] = `${field.labelMin} é obrigatório.`;
                values[field.key] = "";
                continue;
            }
            const parsed = Number(raw);
            if (!Number.isInteger(parsed)) {
                errors[field.key] = `${field.labelMin} deve ser um número inteiro.`;
            } else if (parsed < field.range.min || parsed > field.range.max) {
                errors[field.key] =
                    `${field.labelMin} deve estar entre ${field.range.min} e ${field.range.max}${field.unit ? ` ${field.unit}` : ""
                    }.`;
            } else {
                patch[field.key] = parsed;
            }
            values[field.key] = raw;
        }

        // -- Enums obrigatórios (etnia, cor olhos, cabelo) ---------------
        const enumGuards = {
            etnia: { guard: isEtnia, label: "Etnia" },
            corOlhos: { guard: isCorOlhos, label: "Cor dos olhos" },
            estiloCabelo: { guard: isEstiloCabelo, label: "Estilo do cabelo" },
            tamanhoCabelo: {
                guard: isTamanhoCabelo,
                label: "Tamanho do cabelo",
            },
        } as const;
        for (const key of Object.keys(enumGuards) as Array<keyof typeof enumGuards>) {
            const raw = String(formData.get(key) ?? "").trim();
            if (raw.length === 0) {
                errors[key] = `${enumGuards[key].label} é obrigatória.`;
                values[key] = "";
                continue;
            }
            if (!enumGuards[key].guard(raw)) {
                errors[key] = "Opção inválida.";
            } else {
                patch[key] = raw;
            }
            values[key] = raw;
        }

        // -- Switches booleanos (silicone, tatuagens, piercing, fumante) -
        // Default é `false`: campo ausente no FormData equivale a "não".
        const boolFields = [
            "temSilicone",
            "temTatuagens",
            "temPiercing",
            "fumante",
        ] as const;
        for (const key of boolFields) {
            const raw = formData.get(key);
            const checked = raw !== null;
            patch[key] = checked;
            values[key] = checked;
        }

        // -- Idiomas (multi-select) — pelo menos um é obrigatório --------
        const idiomasRaw = formData.getAll("idiomas").filter(
            (v): v is string => typeof v === "string" && v.length > 0,
        );
        const idiomasFiltrados = idiomasRaw.filter(isIdioma);
        if (idiomasRaw.length !== idiomasFiltrados.length) {
            errors.idiomas = "Idioma inválido.";
        } else if (idiomasFiltrados.length === 0) {
            errors.idiomas = "Selecione pelo menos um idioma.";
        }
        patch.idiomas = idiomasFiltrados;
        values.idiomas = idiomasFiltrados;

        // -- Gênero (single select) — obrigatório ------------------------
        const generoRaw = String(formData.get("genero") ?? "").trim();
        if (generoRaw.length === 0) {
            errors.genero = "Gênero é obrigatório.";
            values.genero = "";
        } else if (!isGenero(generoRaw)) {
            errors.genero = "Opção inválida.";
            values.genero = generoRaw;
        } else {
            patch.genero = generoRaw;
            values.genero = generoRaw;
        }

        // -- Atende (multi-select) — pelo menos um é obrigatório ---------
        const atendeRaw = formData.getAll("atendePublicos").filter(
            (v): v is string => typeof v === "string" && v.length > 0,
        );
        const atendeFiltrados = atendeRaw.filter(isAtende);
        if (atendeRaw.length !== atendeFiltrados.length) {
            errors.atendePublicos = "Opção inválida.";
        } else if (atendeFiltrados.length === 0) {
            errors.atendePublicos =
                "Selecione pelo menos um público que você atende.";
        }
        patch.atendePublicos = atendeFiltrados;
        values.atendePublicos = atendeFiltrados;

        // -- Práticas (multi-select) — opcional --------------------------
        const praticasRaw = formData.getAll("realizaPraticas").filter(
            (v): v is string => typeof v === "string" && v.length > 0,
        );
        const praticasFiltradas = praticasRaw.filter(isPratica);
        if (praticasRaw.length !== praticasFiltradas.length) {
            errors.realizaPraticas = "Prática inválida.";
        }
        patch.realizaPraticas = praticasFiltradas;
        values.realizaPraticas = praticasFiltradas;

        return { patch, errors, values };
    },

    descricao: (formData) => {
        const descricao = String(formData.get("descricao") ?? "");
        const errors: Record<string, string> = {};
        const patch: DraftPayload = {};

        if (!validarDescricao(descricao)) {
            errors.descricao =
                "Descrição deve ter entre 1 e 1000 caracteres.";
        } else {
            patch.descricao = descricao;
        }
        return { patch, errors, values: { descricao } };
    },

    valores: (formData) => {
        const errors: Record<string, string> = {};
        const patch: DraftPayload = {};
        const values: StepValues = {};

        // -- Valor da hora -----------------------------------------------
        // Recebe a string formatada do front ("350,00" ou "R$ 350,00")
        // e converte pra centavos extraindo só dígitos.
        const valorRaw = String(formData.get("valorHoraReais") ?? "").trim();
        values.valorHoraReais = valorRaw;
        if (valorRaw.length === 0) {
            errors.valorHoraCents = "Valor da hora é obrigatório.";
        } else {
            const digits = valorRaw.replace(/\D/g, "");
            if (digits.length === 0) {
                errors.valorHoraCents = "Valor da hora inválido.";
            } else {
                const cents = Number.parseInt(digits, 10);
                if (
                    !Number.isInteger(cents) ||
                    cents < VALOR_HORA_CENTS.min ||
                    cents > VALOR_HORA_CENTS.max
                ) {
                    errors.valorHoraCents = `Valor entre R$ ${VALOR_HORA_CENTS.min / 100} e R$ ${(VALOR_HORA_CENTS.max / 100).toLocaleString("pt-BR")}.`;
                } else {
                    patch.valorHoraCents = cents;
                }
            }
        }

        // -- Formas de pagamento (multi-select) — pelo menos 1 -----------
        const formasRaw = formData.getAll("formasPagamento").filter(
            (v): v is string => typeof v === "string" && v.length > 0,
        );
        const formasFiltradas = formasRaw.filter(isFormaPagamento);
        if (formasRaw.length !== formasFiltradas.length) {
            errors.formasPagamento = "Forma de pagamento inválida.";
        } else if (formasFiltradas.length === 0) {
            errors.formasPagamento =
                "Selecione pelo menos uma forma de pagamento.";
        }
        patch.formasPagamento = formasFiltradas;
        values.formasPagamento = formasFiltradas;

        // -- Dias da semana (multi-select) — pelo menos 1 ----------------
        const diasRaw = formData.getAll("diasAtende").filter(
            (v): v is string => typeof v === "string" && v.length > 0,
        );
        const diasFiltrados = diasRaw.filter(isDiaSemana);
        if (diasRaw.length !== diasFiltrados.length) {
            errors.diasAtende = "Dia inválido.";
        } else if (diasFiltrados.length === 0) {
            errors.diasAtende = "Selecione pelo menos um dia da semana.";
        }
        patch.diasAtende = diasFiltrados;
        values.diasAtende = diasFiltrados;

        return { patch, errors, values };
    },
};

/**
 * Aplica o patch do passo atual no `OnboardingDraft` e redireciona para
 * o próximo step.
 *
 * Espera no `FormData`:
 *   - `_step`: identificador textual do passo (`"identidade"`, ...).
 *   - `_next`: caminho relativo para o qual redirecionar em sucesso.
 *   - Demais campos: específicos do step (ver {@link STEP_HANDLERS}).
 *
 * Em falha de validação, retorna `{ fieldErrors, values }` para a UI
 * renderizar via `Input`/`Select` `error`/`errorMessage`. Em draft
 * expirado/ausente, devolve `formError` apontando para a entrada do
 * fluxo.
 */
export async function salvarEtapaAction(
    _prev: SalvarEtapaState,
    formData: FormData,
): Promise<SalvarEtapaState> {
    const stepKey = String(formData.get("_step") ?? "");
    const nextPath = String(formData.get("_next") ?? "");

    const handler = STEP_HANDLERS[stepKey];
    if (!handler) {
        return { formError: "Passo inválido." };
    }

    const { patch, errors, values } = handler(formData);
    if (Object.keys(errors).length > 0) {
        return { fieldErrors: errors, values };
    }

    const onboardingId = await getOnboardingId();
    if (!onboardingId) {
        return {
            formError:
                "Sessão de cadastro expirada. Reinicie o cadastro.",
            values,
        };
    }

    try {
        await atualizarEtapa(onboardingId, patch);
    } catch (error) {
        if (
            error instanceof DraftExpiredError ||
            error instanceof DraftNotFoundError
        ) {
            return {
                formError:
                    "Sessão de cadastro expirada. Reinicie o cadastro.",
                values,
            };
        }
        throw error;
    }

    if (!nextPath.startsWith("/cadastro/acompanhante/")) {
        return {
            formError: "Destino inválido.",
            values,
        };
    }
    redirect(nextPath);
}

// ---------------------------------------------------------------------------
// uploadFotoAction
// ---------------------------------------------------------------------------

/**
 * Recebe um upload de Foto_de_Perfil pelo `<form>` do step "foto",
 * grava em R2 via `uploadFoto` e retorna a `stagedKey`.
 *
 * Espera no `FormData`:
 *   - `foto`: `File` selecionado pelo usuário.
 *
 * O `mimeType` e o `sizeBytes` são extraídos do próprio `File`. A
 * validação canônica (Requirement 3.10) é responsabilidade de
 * `uploadFoto` em `@/server/onboarding`; aqui apenas mapeamos os
 * erros para mensagens amigáveis.
 */
export async function uploadFotoAction(
    _prev: UploadFotoState,
    formData: FormData,
): Promise<UploadFotoState> {
    const file = formData.get("foto");
    if (!(file instanceof File) || file.size === 0) {
        return { error: "Selecione uma imagem para enviar." };
    }

    const onboardingId = await getOnboardingId();
    if (!onboardingId) {
        return {
            error: "Sessão de cadastro expirada. Reinicie o cadastro.",
        };
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    try {
        const { stagedKey } = await uploadFoto(onboardingId, {
            mimeType: file.type,
            bytes: buffer,
        });
        // Salva os metadados da foto no payload do draft para que
        // `finalizar` encontre `fotoPerfil: { mimeType, sizeBytes }`
        // ao revalidar com o schema.
        await atualizarEtapa(onboardingId, {
            fotoPerfil: {
                mimeType: file.type,
                sizeBytes: file.size,
            },
        });
        return { ok: true, stagedKey };
    } catch (error) {
        if (error instanceof InvalidFotoPerfilError) {
            return {
                error:
                    "Foto inválida: use JPEG, PNG ou WEBP de até 10 MB.",
            };
        }
        if (
            error instanceof DraftExpiredError ||
            error instanceof DraftNotFoundError
        ) {
            return {
                error:
                    "Sessão de cadastro expirada. Reinicie o cadastro.",
            };
        }
        return {
            error: "Não foi possível enviar a foto. Tente novamente.",
        };
    }
}

// ---------------------------------------------------------------------------
// finalizarAction
// ---------------------------------------------------------------------------

const REASON_MESSAGES: Record<string, string> = {
    VALIDACAO:
        "Algum dado do cadastro está inválido. Volte às etapas anteriores e revise.",
    EMAIL_EM_USO: "Este email já está em uso.",
    IDENTIFICADOR_EM_USO: "Este identificador já está em uso.",
    PERSISTENCIA:
        "Não foi possível concluir o cadastro. Tente novamente.",
};

/**
 * Conclui o Onboarding_Acompanhante.
 *
 * Em sucesso, assina o `sessionId` retornado por `finalizar` com
 * {@link signSessionCookie} e o coloca no cookie HTTP-only de sessão
 * (Requirement 3.11), depois redireciona para
 * `/acompanhante/selecao-plano`. Em falha, retorna o estado com
 * `reason` e `error` para a UI.
 *
 * O cookie `onboardingId` é preservado para que o usuário possa tentar
 * de novo sem perder dados em caso de falha de persistência (o draft
 * não é apagado em falha — Property 15, ramo "Falha"). Em sucesso, o
 * draft já foi removido dentro da transação atômica do `finalizar`,
 * então o cookie restante torna-se inerte e expira por TTL.
 */
export async function finalizarAction(
    _prev: FinalizarState,
    _formData: FormData,
): Promise<FinalizarState> {
    const onboardingId = await getOnboardingId();
    if (!onboardingId) {
        return {
            error: "Sessão de cadastro expirada. Reinicie o cadastro.",
        };
    }

    const result = await finalizar(onboardingId);

    if (!result.ok) {
        return {
            reason: result.reason,
            error: REASON_MESSAGES[result.reason],
            detalhes: "detalhes" in result ? result.detalhes : undefined,
        };
    }

    const cookieStore = await cookies();
    cookieStore.set({
        name: SESSION_COOKIE_NAME,
        value: await signSessionCookie(result.sessionId),
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
    });

    redirect("/acompanhante/selecao-plano");
}
