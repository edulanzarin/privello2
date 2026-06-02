/**
 * Sistema_de_Boost — compra e ativação de Boost da Acompanhante.
 *
 * Boost é uma promoção paga de 24h que dá prioridade total nas
 * buscas e destaque na home. Implementação:
 *
 * 1. **Criar preferência** — `criarPagamentoBoost(userId, baseUrl)`:
 *    cria um `BoostPayment` em `PENDING`, gera um
 *    `external_reference` único, cria a Preference no Mercado Pago
 *    e devolve a URL de redirect (`init_point`).
 *
 * 2. **Webhook do MP** — `processarWebhookBoost(paymentId)`:
 *    recebe o `id` do payment via webhook do MP, consulta o status
 *    via `getPayment`, reconcilia com o `BoostPayment` local pelo
 *    `external_reference`, e quando aprovado:
 *      - estende `AcompanhanteProfile.boostUntil` em +24h
 *        (cumulativo se já houver janela ativa);
 *      - marca o pagamento como `APPROVED` com `activatesAt`/
 *        `expiresAt` preenchidos.
 *    Idempotente via `mp_payment_id`: webhook duplicado não
 *    aplica duas janelas.
 *
 * 3. **Status** — `obterStatusBoost(userId)`: lê o estado vigente
 *    para o painel/UI.
 *
 * Falhas do Mercado Pago são contidas e mapeadas em códigos de
 * resultado discriminados — nada da SDK escapa daqui.
 */

import { randomUUID } from "node:crypto";

import {
    BOOST_CURRENCY,
    BOOST_PRICE_CENTS,
    calcularNovoBoostUntil,
    isBoostAtivo,
    normalizarBoostStartAt,
} from "@/domain/boost/definitions";
import { db } from "@/lib/db";
import {
    StripeError,
    createStripeClient,
    type StripeClient,
} from "@/lib/payments/stripe";
import { criarNotificacao } from "@/server/notifications";

// ---------------------------------------------------------------------------
// Singleton + test seam
// ---------------------------------------------------------------------------

let stripeClientSingleton: StripeClient | null = null;

function getStripeClient(): StripeClient {
    if (!stripeClientSingleton) {
        stripeClientSingleton = createStripeClient();
    }
    return stripeClientSingleton;
}

/** Test seam — substitui o client Stripe usado pelo módulo. */
export function __setStripeClientForBoostTests(
    client: StripeClient | null,
): void {
    stripeClientSingleton = client;
}

// ---------------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------------

export type CriarPagamentoBoostInput = {
    /** Acompanhante autenticada. */
    userId: string;
    /**
     * URL base do app (ex.: `https://privello.com`). Usada para
     * construir as `back_urls` e a `notification_url` enviadas ao
     * Mercado Pago. Os endpoints internos têm caminhos fixos.
     */
    baseUrl: string;
    /** Email do pagador (preenche automático no checkout). */
    payerEmail?: string;
    /**
     * Momento em que o boost deve começar. `null`/ausente = imediato
     * (ativa assim que o pagamento aprovar). Quando no futuro, o
     * boost é agendado: o webhook aprova mas não estende `boostUntil`
     * — o cron ativa na hora. Validado/normalizado via
     * {@link normalizarBoostStartAt}.
     */
    startAt?: string | Date | null;
};

export type CriarPagamentoBoostResult =
    | { ok: true; checkoutUrl: string; paymentId: string }
    | {
        ok: false;
        reason:
        | "PERFIL_NAO_ENCONTRADO"
        | "PAGAMENTO_NAO_CONFIGURADO"
        | "AGENDAMENTO_INVALIDO"
        | "PERSISTENCIA";
    };

export type StatusBoost = {
    /** `true` quando há boost ativo no momento. */
    ativo: boolean;
    /** Quando expira a janela ativa, ou `null` se nunca houve boost. */
    boostUntil: Date | null;
    /**
     * Pagamento `PENDING` mais recente para esta Acompanhante,
     * caso exista. Usado pela UI para mostrar "checkout em
     * andamento" enquanto o webhook não confirmou.
     */
    pendingPaymentId: string | null;
    /**
     * Quando há um boost pago e agendado pra começar no futuro
     * (`startAt > now`, ainda não ativado), traz o instante de
     * início. `null` quando não há agendamento pendente. UI mostra
     * "Boost programado pra DD/MM às HH:mm".
     */
    agendadoParaInicio: Date | null;
};

// ---------------------------------------------------------------------------
// Criar pagamento
// ---------------------------------------------------------------------------

/**
 * Cria um novo `BoostPayment` em estado `PENDING`, gera a
 * preference no Mercado Pago e devolve a URL de checkout.
 *
 * Fluxo:
 *   1. Garante que o `userId` corresponde a uma Acompanhante.
 *   2. Cria o registro local (`BoostPayment`) com
 *      `external_reference` único — se a transação local falhar,
 *      nada chama o MP.
 *   3. Pede a Preference ao MP (Checkout Pro). Em sucesso, atualiza
 *      o registro com o `mp_preference_id`.
 *   4. Devolve a URL pra qual o front redireciona o usuário.
 *
 * Em caso de falha no MP após o registro local, o `BoostPayment`
 * fica em `PENDING` sem `mp_preference_id` — pode ser limpo por
 * varredura periódica futura. Não derruba a request por isso.
 */
export async function criarPagamentoBoost(
    input: CriarPagamentoBoostInput,
): Promise<CriarPagamentoBoostResult> {
    // 1. Verifica que existe Acompanhante para este userId.
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

    // Normaliza o agendamento.
    const agendamento = normalizarBoostStartAt(input.startAt ?? null);
    if (agendamento.kind === "invalido") {
        return { ok: false, reason: "AGENDAMENTO_INVALIDO" };
    }
    const startAt =
        agendamento.kind === "agendado" ? agendamento.startAt : null;

    // 2. Cria o registro local primeiro.
    const externalReference = `boost_${randomUUID()}`;
    let payment;
    try {
        payment = await db.boostPayment.create({
            data: {
                userId: input.userId,
                amountCents: BOOST_PRICE_CENTS,
                currency: BOOST_CURRENCY,
                status: "PENDING",
                externalReference,
                startAt,
            },
            select: { id: true },
        });
    } catch {
        return { ok: false, reason: "PERSISTENCIA" };
    }

    // 3. Cria o Checkout Session no Stripe.
    const baseUrl = input.baseUrl.replace(/\/$/, "");
    const successUrl = `${baseUrl}/acompanhante/boost?status=success&ref=${externalReference}`;
    const cancelUrl = `${baseUrl}/acompanhante/boost?status=failure&ref=${externalReference}`;

    let session;
    try {
        session = await stripe.createCheckoutSession({
            items: [
                {
                    name: "Boost de 24h — Privello",
                    description:
                        "Prioridade total em buscas e destaque na home por 24 horas.",
                    quantity: 1,
                    unitAmountCents: BOOST_PRICE_CENTS,
                    currency: BOOST_CURRENCY.toLowerCase(),
                },
            ],
            clientReferenceId: externalReference,
            successUrl,
            cancelUrl,
            customerEmail: input.payerEmail,
            metadata: { userId: input.userId },
        });
    } catch (err) {
        // Marca como rejected pra não ficar PENDING órfão.
        try {
            await db.boostPayment.update({
                where: { id: payment.id },
                data: { status: "REJECTED" },
            });
        } catch {
            // best-effort.
        }
        if (err instanceof StripeError) {
            if (err.code === "STRIPE_NOT_CONFIGURED") {
                return { ok: false, reason: "PAGAMENTO_NAO_CONFIGURADO" };
            }
        }
        return { ok: false, reason: "PERSISTENCIA" };
    }

    // 4. Atualiza o registro com o Stripe Session ID.
    try {
        await db.boostPayment.update({
            where: { id: payment.id },
            data: { mpPreferenceId: session.id },
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
// Processar webhook
// ---------------------------------------------------------------------------

export type ProcessarWebhookBoostResult =
    | { ok: true; applied: boolean }
    | {
        ok: false;
        reason:
        | "PAGAMENTO_NAO_ENCONTRADO"
        | "PERSISTENCIA";
    };

/**
 * Reconcilia o status de um pagamento via webhook do Stripe.
 *
 * Recebe o `SessionDetails` já verificado pelo webhook handler.
 * Fluxo:
 *   1. Localiza o `BoostPayment` local pelo `clientReferenceId`
 *      (= `externalReference`).
 *   2. Idempotência: se já `APPROVED` com o mesmo `paymentIntentId`,
 *      retorna `applied: false`.
 *   3. Quando `paymentStatus === "paid"`:
 *      - Marca como `APPROVED`, grava `paymentIntentId`.
 *      - Estende `boostUntil` +24h (ou agenda pro futuro se
 *        `startAt` é futuro).
 *   4. Caso contrário: grava o `paymentIntentId` para reconciliação.
 */
export async function processarWebhookBoost(
    session: {
        clientReferenceId: string | null;
        paymentStatus: string;
        paymentIntentId: string | null;
    },
    options: { now?: Date } = {},
): Promise<ProcessarWebhookBoostResult> {
    if (!session.clientReferenceId) {
        return { ok: false, reason: "PAGAMENTO_NAO_ENCONTRADO" };
    }

    const local = await db.boostPayment.findUnique({
        where: { externalReference: session.clientReferenceId },
        select: {
            id: true,
            status: true,
            mpPaymentId: true,
            userId: true,
            startAt: true,
        },
    });
    if (!local) {
        return { ok: false, reason: "PAGAMENTO_NAO_ENCONTRADO" };
    }

    // Idempotência: webhook duplicado.
    if (
        local.mpPaymentId === session.paymentIntentId &&
        local.status !== "PENDING"
    ) {
        return { ok: true, applied: false };
    }

    const now = options.now ?? new Date();

    if (session.paymentStatus === "paid") {
        // Boost agendado pro futuro.
        const agendadoPraFuturo =
            local.startAt !== null && local.startAt.getTime() > now.getTime();

        if (agendadoPraFuturo) {
            try {
                await db.boostPayment.update({
                    where: { id: local.id },
                    data: {
                        status: "APPROVED",
                        mpPaymentId: session.paymentIntentId,
                    },
                });
                return { ok: true, applied: true };
            } catch {
                return { ok: false, reason: "PERSISTENCIA" };
            }
        }

        // Ativação imediata.
        try {
            await db.$transaction(async (tx) => {
                const profile = await tx.acompanhanteProfile.findUnique({
                    where: { userId: local.userId },
                    select: { boostUntil: true },
                });
                const newBoostUntil = calcularNovoBoostUntil(
                    profile?.boostUntil ?? null,
                    now,
                );

                await tx.boostPayment.update({
                    where: { id: local.id },
                    data: {
                        status: "APPROVED",
                        mpPaymentId: session.paymentIntentId,
                        activatesAt: now,
                        expiresAt: newBoostUntil,
                    },
                });

                await tx.acompanhanteProfile.update({
                    where: { userId: local.userId },
                    data: { boostUntil: newBoostUntil },
                });

                await criarNotificacao({
                    userId: local.userId,
                    type: "BOOST_ATIVADO",
                    payload: { expiraEm: newBoostUntil.toISOString() },
                    client: tx,
                });
            });
            return { ok: true, applied: true };
        } catch {
            return { ok: false, reason: "PERSISTENCIA" };
        }
    }

    // Session expirada ou não paga — grava o PI pra reconciliação.
    try {
        await db.boostPayment.update({
            where: { id: local.id },
            data: { mpPaymentId: session.paymentIntentId },
        });
    } catch {
        // best-effort.
    }
    return { ok: true, applied: false };
}

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

/**
 * Lê o estado atual de boost para a UI do painel.
 */
export async function obterStatusBoost(
    userId: string,
    options: { now?: Date } = {},
): Promise<StatusBoost> {
    const now = options.now ?? new Date();
    const profile = await db.acompanhanteProfile.findUnique({
        where: { userId },
        select: { boostUntil: true },
    });
    const boostUntil = profile?.boostUntil ?? null;
    const ativo = isBoostAtivo(boostUntil, now);

    // Verifica se há um pagamento pendente recente — útil para a UI
    // mostrar "aguardando confirmação" depois que o usuário voltou
    // do checkout.
    const pending = await db.boostPayment.findFirst({
        where: { userId, status: "PENDING" },
        orderBy: { createdAt: "desc" },
        select: { id: true },
    });

    // Boost agendado: aprovado, com `startAt` no futuro e ainda não
    // ativado (`activatesAt` nulo). UI mostra "começa em DD/MM HH:mm".
    const agendado = await db.boostPayment.findFirst({
        where: {
            userId,
            status: "APPROVED",
            activatesAt: null,
            startAt: { gt: now },
        },
        orderBy: { startAt: "asc" },
        select: { startAt: true },
    });

    return {
        ativo,
        boostUntil,
        pendingPaymentId: pending?.id ?? null,
        agendadoParaInicio: agendado?.startAt ?? null,
    };
}

// ---------------------------------------------------------------------------
// Ativar boosts agendados (cron noturno)
// ---------------------------------------------------------------------------

export interface AtivarBoostsAgendadosResult {
    /** Quantos boosts agendados foram ativados nesta varredura. */
    ativados: number;
}

/**
 * Ativa boosts agendados cujo `startAt` já chegou.
 *
 * Critério: `status=APPROVED AND activatesAt IS NULL AND
 * startAt <= now`. Pra cada um, estende `boostUntil` da
 * Acompanhante (cumulativo via `calcularNovoBoostUntil`) e marca
 * `activatesAt`/`expiresAt` — o que tira o registro da próxima
 * varredura (idempotente).
 *
 * Cada ativação roda em sua própria transação pra que uma falha
 * isolada não derrube as demais. Chamado pelo cleanup noturno.
 */
export async function ativarBoostsAgendados(
    options: { now?: Date } = {},
): Promise<AtivarBoostsAgendadosResult> {
    const now = options.now ?? new Date();

    const pendentes = await db.boostPayment.findMany({
        where: {
            status: "APPROVED",
            activatesAt: null,
            startAt: { not: null, lte: now },
        },
        select: { id: true, userId: true },
    });

    let ativados = 0;
    for (const boost of pendentes) {
        try {
            await db.$transaction(async (tx) => {
                // Re-checa dentro da transação pra evitar corrida com
                // outra ativação concorrente (ex.: dois crons).
                const fresh = await tx.boostPayment.findUnique({
                    where: { id: boost.id },
                    select: { activatesAt: true },
                });
                if (fresh === null || fresh.activatesAt !== null) {
                    return; // já ativado por outra execução.
                }

                const profile = await tx.acompanhanteProfile.findUnique({
                    where: { userId: boost.userId },
                    select: { boostUntil: true },
                });
                const newBoostUntil = calcularNovoBoostUntil(
                    profile?.boostUntil ?? null,
                    now,
                );

                await tx.boostPayment.update({
                    where: { id: boost.id },
                    data: {
                        activatesAt: now,
                        expiresAt: newBoostUntil,
                    },
                });
                await tx.acompanhanteProfile.update({
                    where: { userId: boost.userId },
                    data: { boostUntil: newBoostUntil },
                });
                // Notifica boost ativado (agendado) na mesma
                // transação (V2).
                await criarNotificacao({
                    userId: boost.userId,
                    type: "BOOST_ATIVADO",
                    payload: { expiraEm: newBoostUntil.toISOString() },
                    client: tx,
                });
                ativados += 1;
            });
        } catch {
            // best-effort: falha isolada não impede os demais.
        }
    }

    return { ativados };
}
