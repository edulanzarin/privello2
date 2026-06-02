import { NextResponse } from "next/server";

import { processarWebhookBoost } from "@/server/boost";
import { createStripeClient } from "@/lib/payments/stripe";
import { logger } from "@/lib/observability/logger";

export const runtime = "nodejs";

const log = logger("stripe/webhook");

/**
 * Webhook do Stripe.
 *
 * O Stripe envia POST para esta URL quando o checkout session é
 * completado. O evento é verificado via assinatura HMAC
 * (`STRIPE_WEBHOOK_SECRET`). Quando o secret não está configurado
 * (dev sem domínio), aceita o payload sem verificação — NÃO USAR
 * em produção sem o secret.
 *
 * Eventos tratados:
 * - `checkout.session.completed` — pagamento aprovado.
 * - `checkout.session.expired` — sessão expirou sem pagar.
 *
 * Sempre retorna 200 para evitar retries desnecessários. Erros são
 * logados.
 */
export async function POST(request: Request): Promise<NextResponse> {
    const stripe = createStripeClient();

    const body = await request.text();
    const signature = request.headers.get("stripe-signature") ?? "";

    // Tenta verificar a assinatura. Se o webhook secret não está
    // configurado (dev), parseia o JSON diretamente como fallback
    // inseguro — aceito APENAS em dev/staging.
    let event: {
        type: string;
        data: {
            object: {
                client_reference_id?: string | null;
                payment_status?: string;
                payment_intent?: string | null;
            };
        };
    } | null = null;

    const verified = stripe.constructWebhookEvent(body, signature);
    if (verified) {
        event = {
            type: verified.type,
            data: {
                object: {
                    client_reference_id:
                        verified.data.object.clientReferenceId,
                    payment_status: verified.data.object.paymentStatus,
                    payment_intent: verified.data.object.paymentIntentId,
                },
            },
        };
    } else if (
        process.env.NODE_ENV !== "production" &&
        !process.env.STRIPE_WEBHOOK_SECRET
    ) {
        // Dev fallback — aceita sem verificação.
        try {
            const raw = JSON.parse(body) as {
                type?: string;
                data?: { object?: Record<string, unknown> };
            };
            if (raw.type && raw.data?.object) {
                const obj = raw.data.object;
                event = {
                    type: raw.type,
                    data: {
                        object: {
                            client_reference_id:
                                (obj.client_reference_id as string) ?? null,
                            payment_status:
                                (obj.payment_status as string) ?? "unpaid",
                            payment_intent:
                                typeof obj.payment_intent === "string"
                                    ? obj.payment_intent
                                    : null,
                        },
                    },
                };
            }
        } catch {
            // JSON inválido — ignora.
        }
    }

    if (!event) {
        log.warn("webhook com assinatura inválida ou payload mal-formado");
        return NextResponse.json(
            { ok: false, reason: "INVALID_SIGNATURE" },
            { status: 400 },
        );
    }

    // Só processa checkout.session.completed (pagamento feito).
    if (event.type === "checkout.session.completed") {
        const obj = event.data.object;
        try {
            await processarWebhookBoost({
                clientReferenceId: obj.client_reference_id ?? null,
                paymentStatus: obj.payment_status ?? "unpaid",
                paymentIntentId: obj.payment_intent ?? null,
            });
        } catch (err) {
            log.error("falha ao processar webhook stripe", err);
        }
    }

    return NextResponse.json({ ok: true }, { status: 200 });
}
