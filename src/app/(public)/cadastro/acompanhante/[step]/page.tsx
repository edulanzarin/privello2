/**
 * Renderizador dinâmico dos passos do Onboarding_Acompanhante.
 *
 * Esta rota mapeia `/cadastro/acompanhante/<n>` para um dos seis
 * componentes de passo:
 *
 *   1. identidade  — nome, email, identificador, senha (Req 3.1, 3.7)
 *   2. telefone    — DDD + número (Req 3.8)
 *   3. localidade  — estado e cidade via `/api/localidades` (Req 4.4)
 *   4. descricao   — texto 1..1000 (Req 3.9)
 *   5. foto        — Foto_de_Perfil em R2 staged (Req 3.10)
 *   6. confirmacao — chama `finalizar` (Req 3.11)
 *
 * É um Server Component: lê o `OnboardingDraft` ativo via
 * {@link obter} para que cada passo possa pré-preencher os campos com
 * o que já foi salvo (Requirement 3.2 — voltar não perde dados). Se
 * o cookie `onboardingId` estiver ausente ou o draft tiver expirado,
 * redireciona para `/cadastro/acompanhante`, que cria um novo draft.
 *
 * O step inválido (fora de 1..6) cai num 404 via `notFound()`.
 *
 * # Layout
 *
 * Consome o {@link AuthCard} e o {@link StepProgress} da
 * Biblioteca_de_Componentes para herdar o mesmo wrapper visual de
 * `/login`, `/cadastro` e `/cadastro/cliente` (Requirement 6.6). O
 * título e o subtítulo de cada passo vivem **aqui** (não nos
 * componentes de step) para que sejam renderizados pelo header do
 * `AuthCard`, mantendo a tipografia e o espaçamento idênticos aos das
 * demais telas.
 *
 * Validates: Requirements 3.1, 3.2, 3.11, 3.12, 4.4.
 */

import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { AuthCard, StepProgress } from "@/components";
import {
    obter,
    parseOnboardingCookie,
    ONBOARDING_COOKIE_NAME,
    type DraftPayload,
} from "@/server/onboarding";

import { ConfirmacaoStep } from "./_steps/ConfirmacaoStep";
import { AparenciaStep } from "./_steps/AparenciaStep";
import { DescricaoStep } from "./_steps/DescricaoStep";
import { FotoStep } from "./_steps/FotoStep";
import { IdentidadeStep } from "./_steps/IdentidadeStep";
import { LocalidadeStep } from "./_steps/LocalidadeStep";
import { TelefoneStep } from "./_steps/TelefoneStep";
import { ValoresStep } from "./_steps/ValoresStep";

/** Total de passos exibidos na UI (1..TOTAL_STEPS). */
const TOTAL_STEPS = 8;

/** Identificadores textuais dos passos, em ordem. */
const STEP_KEYS = [
    "identidade",
    "telefone",
    "localidade",
    "aparencia",
    "valores",
    "descricao",
    "foto",
    "confirmacao",
] as const;

type StepKey = (typeof STEP_KEYS)[number];

/**
 * Texto exibido no header do `AuthCard` para cada passo. Mantido aqui
 * (e não nos componentes de step) para que a tipografia siga o padrão
 * das demais telas de auth/cadastro sem que cada step precise replicar
 * markup de header.
 */
const STEP_COPY: Readonly<Record<StepKey, { title: string; subtitle: string }>> = {
    identidade: {
        title: "Seus dados",
        subtitle: "Comece informando seus dados de acesso.",
    },
    telefone: {
        title: "Telefone",
        subtitle: "Número que os clientes usarão para entrar em contato.",
    },
    localidade: {
        title: "Cidade onde atende",
        subtitle: "Onde os clientes poderão encontrar você.",
    },
    aparencia: {
        title: "Sobre você",
        subtitle:
            "Conte um pouco sobre suas características pessoais. Você pode editar depois no painel.",
    },
    valores: {
        title: "Atendimento",
        subtitle:
            "Valor da hora, formas de pagamento e dias em que atende.",
    },
    descricao: {
        title: "Descrição",
        subtitle: "Conte um pouco sobre você.",
    },
    foto: {
        title: "Foto de perfil",
        subtitle:
            "Essa será a primeira impressão dos clientes. Pode ser alterada depois.",
    },
    confirmacao: {
        title: "Confirmar cadastro",
        subtitle:
            "Confira se está tudo certo. Em seguida você escolherá um plano.",
    },
};

/**
 * Lê o `onboardingId` do cookie. Tenta primeiro o helper tipado de
 * `cookies()`; se ausente, faz parse do header bruto via
 * {@link parseOnboardingCookie} (defesa contra ambientes de teste).
 */
async function readOnboardingId(): Promise<string | null> {
    const store = await cookies();
    const direct = store.get(ONBOARDING_COOKIE_NAME)?.value;
    if (typeof direct === "string" && direct.length > 0) {
        return direct;
    }
    return parseOnboardingCookie(null);
}

function pickString(payload: DraftPayload, key: string): string | undefined {
    const value = payload[key];
    return typeof value === "string" ? value : undefined;
}

/**
 * Extrai os valores já salvos para os campos do step "Aparência".
 * Cada campo é independente — qualquer combinação parcial é válida
 * porque o step inteiro é opcional. Tipos numéricos são preservados
 * para que o `<Input type="number">` os exiba sem reformatação;
 * enums vêm como strings.
 */
function pickAparenciaInitialValues(
    payload: DraftPayload,
): Record<string, unknown> {
    return {
        pesoKg: typeof payload.pesoKg === "number" ? payload.pesoKg : undefined,
        alturaCm:
            typeof payload.alturaCm === "number" ? payload.alturaCm : undefined,
        tamanhoPe:
            typeof payload.tamanhoPe === "number"
                ? payload.tamanhoPe
                : undefined,
        etnia: typeof payload.etnia === "string" ? payload.etnia : undefined,
        corOlhos:
            typeof payload.corOlhos === "string" ? payload.corOlhos : undefined,
        estiloCabelo:
            typeof payload.estiloCabelo === "string"
                ? payload.estiloCabelo
                : undefined,
        tamanhoCabelo:
            typeof payload.tamanhoCabelo === "string"
                ? payload.tamanhoCabelo
                : undefined,
        temSilicone:
            typeof payload.temSilicone === "boolean"
                ? payload.temSilicone
                : undefined,
        temTatuagens:
            typeof payload.temTatuagens === "boolean"
                ? payload.temTatuagens
                : undefined,
        temPiercing:
            typeof payload.temPiercing === "boolean"
                ? payload.temPiercing
                : undefined,
        fumante:
            typeof payload.fumante === "boolean" ? payload.fumante : undefined,
        idiomas: Array.isArray(payload.idiomas)
            ? (payload.idiomas as unknown[]).filter(
                (v): v is string => typeof v === "string",
            )
            : undefined,
    };
}

/**
 * Extrai os valores já salvos no draft pra rehidratar o step
 * "Valores" (atendimento comercial).
 */
function pickValoresInitialValues(
    payload: DraftPayload,
): { valorHoraCents?: number; formasPagamento?: ReadonlyArray<string>; diasAtende?: ReadonlyArray<string> } {
    return {
        valorHoraCents:
            typeof payload.valorHoraCents === "number"
                ? payload.valorHoraCents
                : undefined,
        formasPagamento: Array.isArray(payload.formasPagamento)
            ? (payload.formasPagamento as unknown[]).filter(
                (v): v is string => typeof v === "string",
            )
            : undefined,
        diasAtende: Array.isArray(payload.diasAtende)
            ? (payload.diasAtende as unknown[]).filter(
                (v): v is string => typeof v === "string",
            )
            : undefined,
    };
}

/**
 * Coordenadas do passo atual: número (1..6), rótulo textual e
 * caminho relativo para o próximo passo.
 */
type StepCoords = {
    number: number;
    key: StepKey;
    nextPath: string;
};

function resolveStep(stepParam: string): StepCoords | null {
    const number = Number(stepParam);
    if (!Number.isInteger(number) || number < 1 || number > TOTAL_STEPS) {
        return null;
    }
    return {
        number,
        key: STEP_KEYS[number - 1],
        nextPath: `/cadastro/acompanhante/${Math.min(number + 1, TOTAL_STEPS)}`,
    };
}

export default async function StepPage({
    params,
}: {
    params: Promise<{ step: string }>;
}) {
    const { step } = await params;
    const coords = resolveStep(step);
    if (coords === null) {
        notFound();
    }

    const onboardingId = await readOnboardingId();
    if (onboardingId === null) {
        redirect("/cadastro/acompanhante");
    }

    const draft = await obter(onboardingId);
    if (draft === null) {
        // Cookie aponta para um draft inexistente ou expirado: cria
        // um novo via rota de entrada.
        redirect("/cadastro/acompanhante");
    }

    const previousPath =
        coords.number > 1
            ? `/cadastro/acompanhante/${coords.number - 1}`
            : null;
    const copy = STEP_COPY[coords.key];

    return (
        <AuthCard
            aboveCard={
                <StepProgress current={coords.number} total={TOTAL_STEPS} />
            }
            title={copy.title}
            subtitle={copy.subtitle}
        >
            {coords.key === "identidade" && (
                <IdentidadeStep
                    nextPath={coords.nextPath}
                    initialValues={{
                        nome: pickString(draft.data, "nome") ?? "",
                        email: pickString(draft.data, "email") ?? "",
                        identificador:
                            pickString(draft.data, "identificador") ?? "",
                    }}
                />
            )}
            {coords.key === "telefone" && (
                <TelefoneStep
                    nextPath={coords.nextPath}
                    previousPath={previousPath}
                    initialTelefone={pickString(draft.data, "telefone") ?? ""}
                />
            )}
            {coords.key === "localidade" && (
                <LocalidadeStep
                    nextPath={coords.nextPath}
                    previousPath={previousPath}
                    initialEstado={pickString(draft.data, "estadoSigla") ?? ""}
                    initialCidade={pickString(draft.data, "cidadeNome") ?? ""}
                    initialBairro={pickString(draft.data, "bairroNome") ?? ""}
                />
            )}
            {coords.key === "aparencia" && (
                <AparenciaStep
                    nextPath={coords.nextPath}
                    previousPath={previousPath}
                    initialValues={pickAparenciaInitialValues(draft.data)}
                />
            )}
            {coords.key === "valores" && (
                <ValoresStep
                    nextPath={coords.nextPath}
                    previousPath={previousPath}
                    initialValues={pickValoresInitialValues(draft.data) as {
                        valorHoraCents?: number;
                        formasPagamento?: ReadonlyArray<
                            "DINHEIRO" | "PIX" | "CARTAO_CREDITO" | "CARTAO_DEBITO" | "TRANSFERENCIA"
                        >;
                        diasAtende?: ReadonlyArray<
                            "SEG" | "TER" | "QUA" | "QUI" | "SEX" | "SAB" | "DOM"
                        >;
                    }}
                />
            )}
            {coords.key === "descricao" && (
                <DescricaoStep
                    nextPath={coords.nextPath}
                    previousPath={previousPath}
                    initialDescricao={pickString(draft.data, "descricao") ?? ""}
                />
            )}
            {coords.key === "foto" && (
                <FotoStep
                    nextPath={coords.nextPath}
                    previousPath={previousPath}
                    stagedKey={draft.stagedKey}
                />
            )}
            {coords.key === "confirmacao" && (
                <ConfirmacaoStep
                    previousPath={previousPath}
                    draftData={draft.data}
                    stagedKey={draft.stagedKey}
                />
            )}
        </AuthCard>
    );
}
