/**
 * Single point of contact between Privello and the Stripe SDK.
 *
 * Requirement 7.8 mandates confinement: every other file in the codebase
 * MUST consume Stripe through the wrapper interfaces exported below.
 * Direct imports of the `stripe` package anywhere outside this file are a
 * confinement violation.
 *
 * Credentials are read from `process.env`:
 *   - `STRIPE_SECRET_KEY`: API secret key (test or live).
 *   - `STRIPE_WEBHOOK_SECRET`: endpoint signing secret for webhook
 *     signature verification.
 *
 * Only the wrapper types declared below are part of the public API.
 * Stripe SDK types are intentionally NOT re-exported.
 */

import Stripe from "stripe";

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

/** Stable internal error codes for Stripe failures. */
export type StripeErrorCode =
    | "STRIPE_NOT_CONFIGURED"
    | "STRIPE_REQUEST_FAILED";

/**
 * Error raised by the Stripe wrapper. The `code` field is part of the
 * public contract; SDK error shapes are intentionally hidden behind it.
 */
export class StripeError extends Error {
    public readonly code: StripeErrorCode;

    constructor(code: StripeErrorCode, message?: string, cause?: unknown) {
        super(message ?? code);
        this.name = "StripeError";
        this.code = code;
        if (cause !== undefined) {
            (this as { cause?: unknown }).cause = cause;
        }
    }
}

// ---------------------------------------------------------------------------
// Wrapper types (no SDK leakage)
// ---------------------------------------------------------------------------

/**
 * Item de pedido enviado ao Stripe para gerar o Checkout Session.
 */
export interface CheckoutItemInput {
    /** Nome exibido no checkout. */
    name: string;
    /** Descrição curta (opcional). */
    description?: string;
    /** Quantidade. Padrão: 1. */
    quantity?: number;
    /** Preço unitário em centavos (BRL). */
    unitAmountCents: number;
    /** Moeda ISO 4217 minúscula. Padrão: `"brl"`. */
    currency?: string;
}

/**
 * Argumentos aceitos por {@link StripeClient.createCheckoutSession}.
 */
export interface CreateCheckoutInput {
    items: ReadonlyArray<CheckoutItemInput>;
    /**
     * Identificador interno para reconciliar o webhook com o registro
     * local. Vai como `client_reference_id` no Checkout Session.
     */
    clientReferenceId: string;
    /** URL de redirect em sucesso. */
    successUrl: string;
    /** URL de redirect em cancelamento. */
    cancelUrl: string;
    /** Email do pagador (preenchido automaticamente no checkout). */
    customerEmail?: string;
    /** Metadados arbitrários associados ao pagamento. */
    metadata?: Record<string, string>;
}

/**
 * Resposta enxuta de {@link StripeClient.createCheckoutSession}.
 */
export interface CheckoutSessionResult {
    /** Stripe Checkout Session ID. */
    id: string;
    /** URL para redirect do usuário (hosted checkout page). */
    url: string;
}

/**
 * Detalhes de um Checkout Session consultado.
 */
export interface SessionDetails {
    id: string;
    /** Status: `complete`, `expired`, `open`. */
    status: string;
    /** Status do pagamento: `paid`, `unpaid`, `no_payment_required`. */
    paymentStatus: string;
    /** O `client_reference_id` enviado na criação. */
    clientReferenceId: string | null;
    /** ID do PaymentIntent associado (quando `paid`). */
    paymentIntentId: string | null;
    /** Valor total em centavos. */
    amountTotal: number | null;
    /** Moeda. */
    currency: string | null;
    /** Metadados. */
    metadata: Record<string, string>;
}

/**
 * Evento parseado e verificado do webhook.
 */
export interface StripeWebhookEvent {
    id: string;
    type: string;
    data: {
        object: SessionDetails;
    };
}

// ---------------------------------------------------------------------------
// Client interface
// ---------------------------------------------------------------------------

export interface StripeClient {
    /** `true` quando a secret key está configurada. */
    isConfigured(): boolean;

    /**
     * Cria um Checkout Session (hosted payment page) e devolve a
     * URL de redirect.
     *
     * @throws {StripeError} `STRIPE_NOT_CONFIGURED` ou
     *   `STRIPE_REQUEST_FAILED`.
     */
    createCheckoutSession(
        input: CreateCheckoutInput,
    ): Promise<CheckoutSessionResult>;

    /**
     * Consulta um Checkout Session pelo ID.
     *
     * @throws {StripeError} mesma semântica.
     */
    getSession(sessionId: string): Promise<SessionDetails>;

    /**
     * Verifica a assinatura de um webhook e parseia o evento.
     * Retorna `null` quando a assinatura é inválida.
     */
    constructWebhookEvent(
        payload: string | Buffer,
        signature: string,
    ): StripeWebhookEvent | null;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export interface CreateStripeClientOptions {
    secretKey?: string;
    webhookSecret?: string;
}

/**
 * Creates a `StripeClient` wrapping the official Stripe SDK.
 */
export function createStripeClient(
    opts: CreateStripeClientOptions = {},
): StripeClient {
    const secretKey =
        opts.secretKey ?? process.env.STRIPE_SECRET_KEY ?? "";
    const webhookSecret =
        opts.webhookSecret ?? process.env.STRIPE_WEBHOOK_SECRET ?? "";

    let stripe: Stripe | null = null;
    if (secretKey.length > 0) {
        stripe = new Stripe(secretKey, { apiVersion: "2026-05-27.dahlia" });
    }

    function requireStripe(): Stripe {
        if (stripe === null) {
            throw new StripeError(
                "STRIPE_NOT_CONFIGURED",
                "Stripe secret key ausente. Configure STRIPE_SECRET_KEY.",
            );
        }
        return stripe;
    }

    function mapSession(s: Stripe.Checkout.Session): SessionDetails {
        return {
            id: s.id,
            status: s.status ?? "unknown",
            paymentStatus: s.payment_status ?? "unpaid",
            clientReferenceId: s.client_reference_id ?? null,
            paymentIntentId:
                typeof s.payment_intent === "string"
                    ? s.payment_intent
                    : s.payment_intent?.id ?? null,
            amountTotal: s.amount_total ?? null,
            currency: s.currency ?? null,
            metadata: (s.metadata ?? {}) as Record<string, string>,
        };
    }

    return {
        isConfigured(): boolean {
            return stripe !== null;
        },

        async createCheckoutSession(
            input: CreateCheckoutInput,
        ): Promise<CheckoutSessionResult> {
            const s = requireStripe();

            try {
                const session = await s.checkout.sessions.create({
                    mode: "payment",
                    // Sem `payment_method_types`: o Stripe usa a config
                    // de "Payment methods" do dashboard, mostrando
                    // automaticamente os métodos habilitados (cartão,
                    // PIX, boleto, etc.). Pra ativar PIX, basta
                    // habilitar em Settings → Payment methods no
                    // dashboard. PIX é assíncrono: a sessão completa
                    // com `payment_status: unpaid` e a confirmação
                    // chega depois via
                    // `checkout.session.async_payment_succeeded`.
                    client_reference_id: input.clientReferenceId,
                    customer_email: input.customerEmail,
                    success_url: input.successUrl,
                    cancel_url: input.cancelUrl,
                    metadata: input.metadata,
                    line_items: input.items.map((item) => ({
                        price_data: {
                            currency: item.currency ?? "brl",
                            product_data: {
                                name: item.name,
                                description: item.description,
                            },
                            unit_amount: item.unitAmountCents,
                        },
                        quantity: item.quantity ?? 1,
                    })),
                });

                if (!session.url) {
                    throw new StripeError(
                        "STRIPE_REQUEST_FAILED",
                        "Stripe retornou session sem URL.",
                    );
                }

                return { id: session.id, url: session.url };
            } catch (err) {
                if (err instanceof StripeError) throw err;
                // Inclui a mensagem real do Stripe (ex.: payment method
                // não habilitado, key inválida, currency não suportado)
                // pra que o caller possa logar o motivo concreto sem
                // ter que escarafunchar `cause`.
                const stripeMessage =
                    err instanceof Error ? err.message : String(err);
                throw new StripeError(
                    "STRIPE_REQUEST_FAILED",
                    `Falha ao criar Checkout Session no Stripe: ${stripeMessage}`,
                    err,
                );
            }
        },

        async getSession(sessionId: string): Promise<SessionDetails> {
            const s = requireStripe();
            try {
                const session = await s.checkout.sessions.retrieve(sessionId);
                return mapSession(session);
            } catch (err) {
                if (err instanceof StripeError) throw err;
                throw new StripeError(
                    "STRIPE_REQUEST_FAILED",
                    `Falha ao consultar session ${sessionId} no Stripe.`,
                    err,
                );
            }
        },

        constructWebhookEvent(
            payload: string | Buffer,
            signature: string,
        ): StripeWebhookEvent | null {
            const s = requireStripe();
            if (webhookSecret.length === 0) {
                return null;
            }
            try {
                const event = s.webhooks.constructEvent(
                    payload,
                    signature,
                    webhookSecret,
                );
                // We only handle checkout.session events for now.
                const session = event.data
                    .object as unknown as Stripe.Checkout.Session;
                return {
                    id: event.id,
                    type: event.type,
                    data: { object: mapSession(session) },
                };
            } catch {
                return null;
            }
        },
    };
}
