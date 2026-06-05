import { NextResponse } from "next/server";
import { headers } from "next/headers";

import { processarWebhookBoost } from "@/server/boost";
import { processarWebhookFan } from "@/server/planos-cliente";
import { processarWebhookPlano } from "@/server/planos";
import { createStripeClient } from "@/lib/payments/stripe";

/**
 * Webhook do Stripe para eventos de Checkout Session.
 *
 * Eventos tratados:
 * - `checkout.session.completed` — cartão aprovado (síncrono) ou
 *   início de PIX (assíncrono, status `unpaid`).
 * - `checkout.session.async_payment_succeeded` — PIX confirmado.
 * - `checkout.session.async_payment_failed` — PIX falhou/expirou.
 * - `checkout.session.expired` — checkout não concluído no prazo.
 *
 * Roteia para os serviços apropriados baseado no `client_reference_id`:
 * - `boost_*` → {@link processarWebhookBoost}
 * - `fan_*` → {@link processarWebhookFan}
 * - `plano_*` → {@link processarWebhookPlano}
 *
 * CSRF exempt: webhooks externos não têm cookie de sessão. A
 * autenticidade é garantida pela assinatura HMAC do Stripe
 * (verificada via `stripe.webhooks.constructEvent`).
 */
export async function POST(request: Request): Promise<NextResponse> {
    const stripe = createStripeClient();
    if (!stripe.isConfigured()) {
        return NextResponse.json(
            { error: "Stripe not configured" },
            { status: 503 },
        );
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
        return NextResponse.json(
            { error: "Webhook secret not configured" },
            { status: 503 },
        );
    }

    const body = await request.text();
    const headersList = await headers();
    const signature = headersList.get("stripe-signature");

    if (!signature) {
        return NextResponse.json(
            { error: "Missing signature" },
            { status: 400 },
        );
    }

    try {
        const event = stripe.constructWebhookEvent(body, signature);
        
        if (!event) {
            return NextResponse.json(
                { error: "Invalid signature" },
                { status: 400 },
            );
        }

        // Processa eventos de checkout session relevantes:
        // - completed: cartão (síncrono, vem `paid`) ou início de PIX
        //   (vem `unpaid`, confirmação chega no async_payment_succeeded).
        // - async_payment_succeeded: PIX confirmado pelo cliente.
        // - async_payment_failed: PIX expirou/falhou.
        // - expired: checkout não concluído no prazo.
        if (
            event.type !== "checkout.session.completed" &&
            event.type !== "checkout.session.async_payment_succeeded" &&
            event.type !== "checkout.session.async_payment_failed" &&
            event.type !== "checkout.session.expired"
        ) {
            return NextResponse.json({ received: true });
        }

        const session = event.data.object;
        const clientReferenceId = session.clientReferenceId;

        if (!clientReferenceId) {
            // Sem referência, não sabemos rotear — ignora.
            return NextResponse.json({ received: true });
        }

        // Para PIX, a confirmação real vem no async_payment_succeeded.
        // Normalizamos o status: o evento de sucesso assíncrono sempre
        // significa pago, independente do payment_status da sessão.
        const paymentStatus =
            event.type === "checkout.session.async_payment_succeeded"
                ? "paid"
                : session.paymentStatus;

        const sessionDetails = {
            clientReferenceId,
            paymentStatus,
            paymentIntentId: session.paymentIntentId,
        };

        // Roteamento baseado no prefixo do client_reference_id.
        if (clientReferenceId.startsWith("boost_")) {
            const result = await processarWebhookBoost(sessionDetails);
            if (!result.ok) {
                console.error(
                    `[webhook] boost failed: ${result.reason}`,
                    sessionDetails,
                );
            }
            return NextResponse.json({ received: true });
        }

        if (clientReferenceId.startsWith("fan_")) {
            const result = await processarWebhookFan(sessionDetails);
            if (!result.ok) {
                console.error(
                    `[webhook] fan failed: ${result.reason}`,
                    sessionDetails,
                );
            }
            return NextResponse.json({ received: true });
        }

        if (clientReferenceId.startsWith("plano_")) {
            const result = await processarWebhookPlano(sessionDetails);
            if (!result.ok) {
                console.error(
                    `[webhook] plano failed: ${result.reason}`,
                    sessionDetails,
                );
            }
            return NextResponse.json({ received: true });
        }

        // Prefixo desconhecido — ignora.
        console.warn(
            `[webhook] unknown client_reference_id prefix: ${clientReferenceId}`,
        );
        return NextResponse.json({ received: true });
    } catch (err) {
        console.error("[webhook] error processing webhook", err);
        return NextResponse.json(
            { error: "Webhook processing failed" },
            { status: 500 },
        );
    }
}

