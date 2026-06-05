/**
 * Sistema_de_Planos — serviço de Selecao_de_Plano.
 *
 * Implementa o trecho do design (`Sistema_de_Planos`) responsável por
 * registrar e ler o Plano vigente de uma Acompanhante. As regras dos
 * planos (limites, Stories, prioridade em busca) vivem na constante
 * imutável `PLANO_DEFINITIONS` em `src/domain/plano/definitions.ts` —
 * este módulo apenas coordena a persistência, sem duplicar essas regras.
 *
 * Garantias mantidas por este módulo (Requirements 5.4, 5.6, 5.8, 5.9 e
 * Properties 23, 24, 25):
 *
 * - {@link selecionar} rejeita qualquer string fora de
 *   `{ "BASICO", "PREMIUM" }` com `{ ok: false, reason: "INVALIDO" }` e
 *   não toca no banco de dados.
 * - {@link selecionar} é idempotente: quando o plano vigente da
 *   Acompanhante já é igual ao solicitado, retorna `{ ok: true }` sem
 *   reescrever `planoVigente`/`planoSelecionadoEm`. Combinado com a
 *   persistência atômica do `update`, isso satisfaz a Property 25
 *   (retentativas seguras).
 * - Falhas de I/O do banco são contidas em `try/catch` e traduzidas
 *   para `{ ok: false, reason: "PERSISTENCIA" }`. Como `selecionar`
 *   só escreve em uma única linha (ou não escreve, no caso idempotente),
 *   o estado anterior — incluindo `planoVigente = null` — é preservado.
 * - {@link obterVigente} devolve a definição imutável do plano (ou
 *   `null` se a Acompanhante ainda não escolheu / não existe). Erros
 *   de banco são propagados para que o chamador trate explicitamente,
 *   evitando confundir "sem plano" com "leitura falhou".
 */

import { randomUUID } from "node:crypto";

import { Prisma } from "@prisma/client";

import {
    PLANO_DEFINITIONS,
    isPlanoTipo,
    podeAlterarPlano,
    type PlanoDefinition,
    type PlanoTipo,
} from "@/domain/plano/definitions";
import { db } from "@/lib/db";
import {
    StripeError,
    createStripeClient,
    type StripeClient,
} from "@/lib/payments/stripe";

// ---------------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------------

/**
 * Resultado de {@link selecionar}.
 *
 * - `INVALIDO`: a string submetida não corresponde a `BASICO` nem a
 *   `PREMIUM` (Requirement 5.8).
 * - `DOWNGRADE_NAO_PERMITIDO`: o usuário tentou trocar para um plano
 *   de tier inferior ao atual. Downgrade ativo é proibido — só
 *   acontece passivamente quando o plano expira.
 * - `PERSISTENCIA`: falha no banco impediu a gravação (Requirement 5.9).
 *   Quando a Acompanhante ainda não tinha plano, ela permanece sem
 *   plano vigente e pode tentar novamente sem refazer o onboarding.
 */
export type SelecionarPlanoResult =
    | { ok: true }
    | {
        ok: false;
        reason: "INVALIDO" | "DOWNGRADE_NAO_PERMITIDO" | "PERSISTENCIA";
    };

/** Opções injetáveis (relógio); úteis em testes determinísticos. */
export type SelecionarPlanoOptions = {
    /** Override do relógio. Default: `new Date()`. */
    now?: Date;
};

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

/**
 * Lista os planos disponíveis para a Selecao_de_Plano.
 *
 * Retorna referências aos objetos congelados de
 * {@link PLANO_DEFINITIONS}; consumidores não devem mutá-los.
 */
export function listar(): readonly PlanoDefinition[] {
    return [PLANO_DEFINITIONS.BASICO, PLANO_DEFINITIONS.PREMIUM] as const;
}

/**
 * Registra `tipo` como plano vigente de `acompanhanteId`.
 *
 * Comportamento:
 *
 * 1. Se `tipo` não for exatamente `"BASICO"` nem `"PREMIUM"`, retorna
 *    `{ ok: false, reason: "INVALIDO" }` sem tocar no banco.
 * 2. Lê o plano atual; se já for igual ao solicitado, retorna
 *    `{ ok: true }` sem reescrever (idempotência — Property 25 e seção
 *    "Concorrência e Retentativas" do design).
 * 3. Caso contrário, atualiza `planoVigente` e `planoSelecionadoEm`.
 * 4. Qualquer erro vindo do Prisma — incluindo Acompanhante inexistente
 *    — é capturado e traduzido para `{ ok: false, reason: "PERSISTENCIA" }`.
 *    Como nenhuma escrita é confirmada nesse caso, o estado anterior
 *    (`planoVigente`) é preservado.
 *
 * @param acompanhanteId Identificador (User.id) da Acompanhante.
 * @param tipo           Valor submetido pela usuária (string crua).
 * @param opts           Opções injetáveis (relógio).
 */
export async function selecionar(
    acompanhanteId: string,
    tipo: string,
    opts: SelecionarPlanoOptions = {},
): Promise<SelecionarPlanoResult> {
    if (!isPlanoTipo(tipo)) {
        return { ok: false, reason: "INVALIDO" };
    }

    const now = opts.now ?? new Date();

    try {
        const current = await db.acompanhanteProfile.findUnique({
            where: { userId: acompanhanteId },
            select: { planoVigente: true },
        });

        if (current === null) {
            // Sem perfil de Acompanhante para esse id: tratamos como
            // falha de persistência. O caller pode tentar novamente
            // ou redirecionar; o estado "sem plano" continua.
            return { ok: false, reason: "PERSISTENCIA" };
        }

        if (current.planoVigente === tipo) {
            // Idempotência: nada a fazer. Não reescrevemos
            // `planoSelecionadoEm` para manter o instante original da
            // primeira escolha.
            return { ok: true };
        }

        // Bloqueia downgrade ativo (`tier(novo) < tier(atual)`).
        // Quem já tem o Premium não pode "voltar" pro Básico
        // pagando — o downgrade só acontece passivamente quando o
        // plano expira (em ciclo futuro de pagamentos).
        if (!podeAlterarPlano(current.planoVigente, tipo)) {
            return { ok: false, reason: "DOWNGRADE_NAO_PERMITIDO" };
        }

        await db.acompanhanteProfile.update({
            where: { userId: acompanhanteId },
            data: {
                planoVigente: tipo satisfies PlanoTipo,
                planoSelecionadoEm: now,
            },
            select: { userId: true },
        });

        return { ok: true };
    } catch {
        return { ok: false, reason: "PERSISTENCIA" };
    }
}

/**
 * Lê o plano vigente de `acompanhanteId` aplicando expiração lazy.
 *
 * Quando `planoVigente` está preenchido mas `planoExpiraEm <= now`,
 * retorna `null` (sem plano ativo). O banco não é tocado — o GC
 * ou a próxima compra corrige fisicamente. Erros do Prisma são
 * propagados para que o chamador possa distinguir explicitamente
 * "sem plano" de "leitura falhou".
 */
export async function obterVigente(
    acompanhanteId: string,
    opts: { now?: Date } = {},
): Promise<PlanoDefinition | null> {
    const now = opts.now ?? new Date();

    const profile = await db.acompanhanteProfile.findUnique({
        where: { userId: acompanhanteId },
        select: { planoVigente: true, planoExpiraEm: true },
    });

    if (!profile || profile.planoVigente === null) {
        return null;
    }

    // Lazy expiry: se já expirou, trata como sem plano.
    if (
        profile.planoExpiraEm !== null &&
        profile.planoExpiraEm.getTime() <= now.getTime()
    ) {
        return null;
    }

    return PLANO_DEFINITIONS[profile.planoVigente];
}

// ---------------------------------------------------------------------------
// Checkout do plano (Stripe)
// ---------------------------------------------------------------------------

let stripeClientSingleton: StripeClient | null = null;

function getStripeClient(): StripeClient {
    if (!stripeClientSingleton) {
        stripeClientSingleton = createStripeClient();
    }
    return stripeClientSingleton;
}

export type CriarPagamentoPlanoInput = {
    userId: string;
    plano: PlanoTipo;
    baseUrl: string;
    payerEmail?: string;
};

export type CriarPagamentoPlanoResult =
    | { ok: true; checkoutUrl: string; paymentId: string }
    | {
        ok: false;
        reason:
            | "PERFIL_NAO_ENCONTRADO"
            | "PAGAMENTO_NAO_CONFIGURADO"
            | "PLANO_INVALIDO"
            | "PERSISTENCIA";
    };

/**
 * Cria um `PlanoAcompanhantePayment` em `PENDING`, gera a checkout
 * session no Stripe e devolve a URL de checkout.
 */
export async function criarPagamentoPlano(
    input: CriarPagamentoPlanoInput,
): Promise<CriarPagamentoPlanoResult> {
    const profile = await db.acompanhanteProfile.findUnique({
        where: { userId: input.userId },
        select: { userId: true },
    });
    if (!profile) {
        return { ok: false, reason: "PERFIL_NAO_ENCONTRADO" };
    }

    const stripe = getStripeClient();
    if (!stripe.isConfigured()) {
        return { ok: false, reason: "PAGAMENTO_NAO_CONFIGURADO" };
    }

    if (!isPlanoTipo(input.plano)) {
        return { ok: false, reason: "PLANO_INVALIDO" };
    }

    const definicao = PLANO_DEFINITIONS[input.plano];
    const externalReference = `plano_${randomUUID()}`;
    let payment;
    try {
        payment = await db.planoAcompanhantePayment.create({
            data: {
                userId: input.userId,
                amountCents: definicao.precoCents,
                currency: "BRL",
                plano: input.plano,
                status: "PENDING",
                externalReference,
            },
            select: { id: true },
        });
    } catch {
        return { ok: false, reason: "PERSISTENCIA" };
    }

    const baseUrl = input.baseUrl.replace(/\/$/, "");
    const successUrl = `${baseUrl}/acompanhante?payment=success&ref=${externalReference}`;
    const cancelUrl = `${baseUrl}/acompanhante/selecao-plano?payment=cancel&ref=${externalReference}`;

    const nomeFormatado =
        input.plano === "PREMIUM" ? "Plano Premium" : "Plano Básico";
    const precoFormatado = `R$ ${(definicao.precoCents / 100).toFixed(2).replace(".", ",")}`;

    let session;
    try {
        session = await stripe.createCheckoutSession({
            items: [
                {
                    name: `${nomeFormatado} · Privello`,
                    description: `30 dias de acesso ${nomeFormatado.toLowerCase()} na plataforma — ${precoFormatado}/mês`,
                    quantity: 1,
                    unitAmountCents: definicao.precoCents,
                    currency: "brl",
                },
            ],
            clientReferenceId: externalReference,
            successUrl,
            cancelUrl,
            customerEmail: input.payerEmail,
            metadata: { userId: input.userId, plano: input.plano },
        });
    } catch (err) {
        try {
            await db.planoAcompanhantePayment.update({
                where: { id: payment.id },
                data: { status: "REJECTED" },
            });
        } catch {
            // best-effort.
        }
        if (err instanceof StripeError && err.code === "STRIPE_NOT_CONFIGURED") {
            return { ok: false, reason: "PAGAMENTO_NAO_CONFIGURADO" };
        }
        return { ok: false, reason: "PERSISTENCIA" };
    }

    try {
        await db.planoAcompanhantePayment.update({
            where: { id: payment.id },
            data: { stripeSessionId: session.id },
        });
    } catch {
        // best-effort: webhook ainda chega via client_reference_id.
    }

    return {
        ok: true,
        checkoutUrl: session.url,
        paymentId: payment.id,
    };
}

// ---------------------------------------------------------------------------
// Ativar plano (chamado pelo webhook)
// ---------------------------------------------------------------------------

/**
 * Aplica a compra de 30 dias do plano para `userId`.
 *
 * Se já tem plano ativo (`planoExpiraEm > now`), **estende** — comprar
 * enquanto ainda ativo acumula os 30 dias. O plano alvo não pode ser
 * inferior ao atual ainda ativo (downgrade ativo proibido).
 */
async function ativarPlano(
    userId: string,
    plano: PlanoTipo,
    opts: { now?: Date; client?: Prisma.TransactionClient } = {},
): Promise<{ ok: true; expiraEm: Date } | { ok: false; reason: "PERSISTENCIA" | "DOWNGRADE_ATIVO" }> {
    const now = opts.now ?? new Date();
    const client = opts.client ?? db;

    try {
        const current = await client.acompanhanteProfile.findUnique({
            where: { userId },
            select: { planoVigente: true, planoExpiraEm: true },
        });

        if (!current) {
            return { ok: false, reason: "PERSISTENCIA" };
        }

        // Verifica se ainda tem plano ativo (não expirado).
        const planoAindaAtivo =
            current.planoVigente !== null &&
            current.planoExpiraEm !== null &&
            current.planoExpiraEm.getTime() > now.getTime();

        // Bloqueia downgrade de plano ainda ativo.
        if (
            planoAindaAtivo &&
            !podeAlterarPlano(current.planoVigente, plano)
        ) {
            return { ok: false, reason: "DOWNGRADE_ATIVO" };
        }

        // Extensão cumulativa: base é maior entre now e expiraEm atual.
        const baseMs = Math.max(
            now.getTime(),
            current.planoExpiraEm?.getTime() ?? 0,
        );
        const expiraEm = new Date(baseMs + PLANO_DEFINITIONS[plano].duracaoMs);

        await client.acompanhanteProfile.update({
            where: { userId },
            data: {
                planoVigente: plano,
                planoSelecionadoEm: now,
                planoExpiraEm: expiraEm,
            },
            select: { userId: true },
        });

        return { ok: true, expiraEm };
    } catch {
        return { ok: false, reason: "PERSISTENCIA" };
    }
}

// ---------------------------------------------------------------------------
// Processar webhook do plano
// ---------------------------------------------------------------------------

export type ProcessarWebhookPlanoResult =
    | { ok: true; applied: boolean }
    | { ok: false; reason: "PAGAMENTO_NAO_ENCONTRADO" | "PERSISTENCIA" };

/**
 * Reconcilia o status de um pagamento de plano via webhook do Stripe.
 *
 * Idempotente: webhook duplicado com mesmo `paymentIntentId` e status
 * diferente de `PENDING` não aplica novamente.
 */
export async function processarWebhookPlano(
    session: {
        clientReferenceId: string | null;
        paymentStatus: string;
        paymentIntentId: string | null;
    },
    options: { now?: Date } = {},
): Promise<ProcessarWebhookPlanoResult> {
    if (!session.clientReferenceId) {
        return { ok: false, reason: "PAGAMENTO_NAO_ENCONTRADO" };
    }

    const local = await db.planoAcompanhantePayment.findUnique({
        where: { externalReference: session.clientReferenceId },
        select: {
            id: true,
            status: true,
            stripePaymentIntentId: true,
            userId: true,
            plano: true,
        },
    });
    if (!local) {
        return { ok: false, reason: "PAGAMENTO_NAO_ENCONTRADO" };
    }

    // Idempotência: webhook duplicado.
    if (
        local.stripePaymentIntentId === session.paymentIntentId &&
        local.status !== "PENDING"
    ) {
        return { ok: true, applied: false };
    }

    const now = options.now ?? new Date();

    if (session.paymentStatus === "paid") {
        try {
            await db.$transaction(async (tx) => {
                const result = await ativarPlano(local.userId, local.plano as PlanoTipo, { now, client: tx });
                if (!result.ok) {
                    throw new Error(`ativarPlano failed: ${result.reason}`);
                }

                await tx.planoAcompanhantePayment.update({
                    where: { id: local.id },
                    data: {
                        status: "APPROVED",
                        stripePaymentIntentId: session.paymentIntentId,
                        appliedAt: now,
                    },
                });
            });
            return { ok: true, applied: true };
        } catch {
            return { ok: false, reason: "PERSISTENCIA" };
        }
    }

    // Não pago — grava o PI para reconciliação futura.
    try {
        await db.planoAcompanhantePayment.update({
            where: { id: local.id },
            data: { stripePaymentIntentId: session.paymentIntentId },
        });
    } catch {
        // best-effort.
    }
    return { ok: true, applied: false };
}
