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
} from "@/domain/boost/definitions";
import { db } from "@/lib/db";
import {
    MercadoPagoError,
    createMercadoPagoClient,
    type MercadoPagoClient,
} from "@/lib/payments/mercadopago";

// ---------------------------------------------------------------------------
// Singleton + test seam
// ---------------------------------------------------------------------------

let mpClientSingleton: MercadoPagoClient | null = null;

function getMpClient(): MercadoPagoClient {
    if (!mpClientSingleton) {
        mpClientSingleton = createMercadoPagoClient();
    }
    return mpClientSingleton;
}

/** Test seam — substitui o client MP usado pelo módulo. */
export function __setMpClientForBoostTests(
    client: MercadoPagoClient | null,
): void {
    mpClientSingleton = client;
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
};

export type CriarPagamentoBoostResult =
    | { ok: true; checkoutUrl: string; paymentId: string }
    | {
        ok: false;
        reason:
        | "PERFIL_NAO_ENCONTRADO"
        | "MP_NAO_CONFIGURADO"
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

    const mp = getMpClient();
    if (!mp.isConfigured()) {
        return { ok: false, reason: "MP_NAO_CONFIGURADO" };
    }

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
            },
            select: { id: true },
        });
    } catch {
        return { ok: false, reason: "PERSISTENCIA" };
    }

    // 3. Cria a Preference no MP.
    const baseUrl = input.baseUrl.replace(/\/$/, "");
    const successUrl = `${baseUrl}/acompanhante/boost?status=success&ref=${externalReference}`;
    const pendingUrl = `${baseUrl}/acompanhante/boost?status=pending&ref=${externalReference}`;
    const failureUrl = `${baseUrl}/acompanhante/boost?status=failure&ref=${externalReference}`;
    const notificationUrl = `${baseUrl}/api/payments/mp/webhook`;

    let preference;
    try {
        preference = await mp.createPreference({
            items: [
                {
                    id: "boost-24h",
                    title: "Boost de 24h — Privello",
                    description:
                        "Prioridade total em buscas e destaque na home por 24 horas.",
                    quantity: 1,
                    unitPrice: BOOST_PRICE_CENTS / 100,
                    currencyId: BOOST_CURRENCY,
                },
            ],
            externalReference,
            backUrls: {
                success: successUrl,
                pending: pendingUrl,
                failure: failureUrl,
            },
            notificationUrl,
            autoReturn: "approved",
            payerEmail: input.payerEmail,
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
        if (err instanceof MercadoPagoError) {
            if (err.code === "MP_NOT_CONFIGURED") {
                return { ok: false, reason: "MP_NAO_CONFIGURADO" };
            }
        }
        return { ok: false, reason: "PERSISTENCIA" };
    }

    // 4. Atualiza o registro com o preference id.
    try {
        await db.boostPayment.update({
            where: { id: payment.id },
            data: { mpPreferenceId: preference.id },
        });
    } catch {
        // best-effort: webhook ainda chega via external_reference.
    }

    // Em sandbox usamos `sandbox_init_point` quando o env for sandbox.
    const checkoutUrl =
        process.env.MP_ENVIRONMENT === "production"
            ? preference.initPoint
            : preference.sandboxInitPoint || preference.initPoint;

    return {
        ok: true,
        checkoutUrl,
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
        | "MP_NAO_CONFIGURADO"
        | "PAGAMENTO_NAO_ENCONTRADO"
        | "PERSISTENCIA";
    };

/**
 * Reconcilia o status de um pagamento via webhook do Mercado Pago.
 *
 * O webhook do MP entrega um `id` de payment. Esta função:
 *   1. Consulta o payment no MP via `getPayment(id)`.
 *   2. Localiza o `BoostPayment` local pelo `external_reference`
 *      retornado.
 *   3. Idempotência: se o `mp_payment_id` já está marcado e o status
 *      é o mesmo, retorna `applied: false`.
 *   4. Quando o status MP for `approved`:
 *      - Marca o registro como `APPROVED` com `activatesAt`/
 *        `expiresAt`.
 *      - Estende `boostUntil` da Acompanhante em +24h (cumulativo).
 *   5. Quando o status MP for `rejected`/`cancelled`/`refunded`:
 *      - Marca o registro como `REJECTED`/`REFUNDED`.
 *      - Não toca em `boostUntil` (boost concedido por pagamento
 *        anterior continua até expirar naturalmente).
 *
 * Erros do MP retornam `MP_NAO_CONFIGURADO`. Pagamento sem
 * `external_reference` ou sem registro local retorna
 * `PAGAMENTO_NAO_ENCONTRADO`.
 */
export async function processarWebhookBoost(
    mpPaymentId: string,
    options: { now?: Date } = {},
): Promise<ProcessarWebhookBoostResult> {
    const mp = getMpClient();
    if (!mp.isConfigured()) {
        return { ok: false, reason: "MP_NAO_CONFIGURADO" };
    }

    let details;
    try {
        details = await mp.getPayment(mpPaymentId);
    } catch {
        return { ok: false, reason: "MP_NAO_CONFIGURADO" };
    }

    if (!details.externalReference) {
        return { ok: false, reason: "PAGAMENTO_NAO_ENCONTRADO" };
    }

    const local = await db.boostPayment.findUnique({
        where: { externalReference: details.externalReference },
        select: { id: true, status: true, mpPaymentId: true, userId: true },
    });
    if (!local) {
        return { ok: false, reason: "PAGAMENTO_NAO_ENCONTRADO" };
    }

    // Idempotência: webhook duplicado.
    if (
        local.mpPaymentId === details.id &&
        local.status !== "PENDING"
    ) {
        return { ok: true, applied: false };
    }

    const now = options.now ?? new Date();
    const status = details.status.toLowerCase();

    if (status === "approved") {
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
                        mpPaymentId: details.id,
                        activatesAt: now,
                        expiresAt: newBoostUntil,
                    },
                });

                await tx.acompanhanteProfile.update({
                    where: { userId: local.userId },
                    data: { boostUntil: newBoostUntil },
                });
            });
            return { ok: true, applied: true };
        } catch {
            return { ok: false, reason: "PERSISTENCIA" };
        }
    }

    if (
        status === "rejected" ||
        status === "cancelled" ||
        status === "refunded" ||
        status === "charged_back"
    ) {
        const newStatus =
            status === "refunded" || status === "charged_back"
                ? "REFUNDED"
                : "REJECTED";
        try {
            await db.boostPayment.update({
                where: { id: local.id },
                data: {
                    status: newStatus,
                    mpPaymentId: details.id,
                },
            });
            return { ok: true, applied: true };
        } catch {
            return { ok: false, reason: "PERSISTENCIA" };
        }
    }

    // `pending`, `in_process`, `authorized`, etc. — não aplica nada,
    // mas grava o `mp_payment_id` pra reconciliação futura.
    try {
        await db.boostPayment.update({
            where: { id: local.id },
            data: { mpPaymentId: details.id },
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
    const profile = await db.acompanhanteProfile.findUnique({
        where: { userId },
        select: { boostUntil: true },
    });
    const boostUntil = profile?.boostUntil ?? null;
    const ativo = isBoostAtivo(boostUntil, options.now);

    // Verifica se há um pagamento pendente recente — útil para a UI
    // mostrar "aguardando confirmação" depois que o usuário voltou
    // do checkout.
    const pending = await db.boostPayment.findFirst({
        where: { userId, status: "PENDING" },
        orderBy: { createdAt: "desc" },
        select: { id: true },
    });

    return {
        ativo,
        boostUntil,
        pendingPaymentId: pending?.id ?? null,
    };
}
