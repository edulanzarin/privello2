/**
 * Single point of contact between Privello and the Mercado Pago SDK.
 *
 * Requirement 7.8 mandates that any Mercado Pago library, call or SDK type is
 * confined to a single payments module. This file is that module: every other
 * file in the codebase MUST consume Mercado Pago through the wrapper
 * interfaces exported below. Direct imports of the `mercadopago` package
 * anywhere outside this file are a confinement violation.
 *
 * Credentials and target environment are read from `process.env`:
 *   - `MP_ACCESS_TOKEN`: API access token (sandbox or production).
 *   - `MP_ENVIRONMENT`:  `"sandbox"` or `"production"` (validated upstream by
 *     `lib/env.ts`).
 *
 * Only the wrapper types declared below are part of the public API of this
 * module. SDK types are intentionally NOT re-exported.
 */
import { MercadoPagoConfig, Payment, Preference } from "mercadopago";

/** Target environment for Mercado Pago operations. */
export type MercadoPagoEnvironment = "sandbox" | "production";

/** Stable internal error codes for Mercado Pago failures. */
export type MercadoPagoErrorCode =
    | "MP_NOT_CONFIGURED"
    | "MP_REQUEST_FAILED";

/**
 * Error raised by the Mercado Pago wrapper.
 *
 * The `code` field is part of the public contract; SDK error shapes are
 * intentionally hidden behind it.
 */
export class MercadoPagoError extends Error {
    public readonly code: MercadoPagoErrorCode;

    constructor(code: MercadoPagoErrorCode, message?: string, cause?: unknown) {
        super(message ?? code);
        this.name = "MercadoPagoError";
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
 * Item de pedido enviado ao Mercado Pago para gerar a Preference do
 * Checkout Pro. Mantido em forma plana (sem nesting opcional) para
 * que o caller não precise montar o shape da SDK.
 */
export interface PreferenceItemInput {
    /** Identificador interno do item (ex.: `boost-24h`). */
    id: string;
    /** Título exibido no checkout. */
    title: string;
    /** Descrição curta exibida abaixo do título. */
    description?: string;
    /** Quantidade. Padrão: 1. */
    quantity?: number;
    /** Preço unitário em reais (decimal). 9.90 → R$ 9,90. */
    unitPrice: number;
    /** Moeda ISO 4217. Padrão: `"BRL"`. */
    currencyId?: string;
}

/**
 * URLs para onde o MP vai redirecionar o usuário após o checkout.
 * Caller pode injetar query params (ex.: `?ref=external_id`) caso
 * precise distinguir múltiplos fluxos.
 */
export interface PreferenceBackUrls {
    success: string;
    pending: string;
    failure: string;
}

/**
 * Argumentos aceitos por {@link MercadoPagoClient.createPreference}.
 */
export interface CreatePreferenceInput {
    items: ReadonlyArray<PreferenceItemInput>;
    /**
     * Identificador interno usado para reconciliar o webhook com o
     * registro local. Vai como `external_reference` na preference.
     */
    externalReference: string;
    backUrls: PreferenceBackUrls;
    /**
     * URL pública do endpoint que recebe webhooks de notificação.
     * O MP faz POST aqui quando o status do pagamento muda.
     */
    notificationUrl?: string;
    /** Quando `true`, o MP redireciona automaticamente após sucesso. */
    autoReturn?: "approved" | "all";
    /** Email do pagador (preenchido automaticamente no checkout). */
    payerEmail?: string;
}

/**
 * Resposta enxuta de {@link MercadoPagoClient.createPreference}.
 * Expomos apenas o `id` (para guardar local) e a `initPoint` (URL
 * para redirect do usuário).
 */
export interface PreferenceResult {
    id: string;
    initPoint: string;
    sandboxInitPoint: string;
}

/**
 * Detalhes de um pagamento consultado pelo `id` recebido em webhook.
 * Expomos só o que precisamos para reconciliar.
 */
export interface PaymentDetails {
    id: string;
    /**
     * Status canônico do MP. Mantido como string crua porque o MP
     * pode acrescentar valores no futuro; o caller normaliza.
     */
    status: string;
    statusDetail: string | null;
    externalReference: string | null;
    transactionAmount: number | null;
    currencyId: string | null;
}

// ---------------------------------------------------------------------------
// Client interface
// ---------------------------------------------------------------------------

/**
 * Minimal Mercado Pago client interface exposed by Privello.
 *
 * Novas capabilities devem ser adicionadas aqui para que call-sites
 * nunca vejam tipos da SDK.
 */
export interface MercadoPagoClient {
    /**
     * Returns `true` when an access token is configured and the SDK client
     * was instantiated successfully.
     */
    isConfigured(): boolean;

    /**
     * Reports configuration status without performing any network I/O in the
     * MVP.
     */
    ping(): Promise<{ ok: boolean; environment: MercadoPagoEnvironment }>;

    /**
     * Cria uma `Preference` do Checkout Pro e devolve o ID + URL
     * de redirect. O caller é responsável por persistir o `id`
     * antes de redirecionar o usuário (idempotência via
     * `externalReference`).
     *
     * @throws {MercadoPagoError} `MP_NOT_CONFIGURED` quando faltam
     *   credenciais; `MP_REQUEST_FAILED` em qualquer falha de rede
     *   ou rejeição da SDK.
     */
    createPreference(input: CreatePreferenceInput): Promise<PreferenceResult>;

    /**
     * Consulta um pagamento pelo `id`. Usado pelo webhook para
     * confirmar o status real (o webhook só carrega `id` do
     * payment, não o status — precisamos consultar para validar).
     *
     * @throws {MercadoPagoError} mesma semântica de `createPreference`.
     */
    getPayment(paymentId: string): Promise<PaymentDetails>;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

function resolveEnvironment(value: string | undefined): MercadoPagoEnvironment {
    return value === "production" ? "production" : "sandbox";
}

/**
 * Optional overrides accepted by `createMercadoPagoClient`. Defaults are read
 * from `process.env.MP_ACCESS_TOKEN` and `process.env.MP_ENVIRONMENT`.
 */
export interface CreateMercadoPagoClientOptions {
    accessToken?: string;
    environment?: MercadoPagoEnvironment;
}

/**
 * Creates a `MercadoPagoClient` that wraps the official SDK.
 *
 * O SDK é instanciado eagerly quando há access token disponível.
 * Quando o token está ausente, o client devolve `isConfigured()`
 * = `false` e qualquer chamada à API lança `MP_NOT_CONFIGURED`.
 */
export function createMercadoPagoClient(
    env: CreateMercadoPagoClientOptions = {},
): MercadoPagoClient {
    const accessToken =
        env.accessToken ?? process.env.MP_ACCESS_TOKEN ?? "";
    const environment = resolveEnvironment(
        env.environment ?? process.env.MP_ENVIRONMENT,
    );

    let sdkConfig: MercadoPagoConfig | null = null;
    if (accessToken.length > 0) {
        sdkConfig = new MercadoPagoConfig({ accessToken });
    }

    function requireConfig(): MercadoPagoConfig {
        if (sdkConfig === null) {
            throw new MercadoPagoError(
                "MP_NOT_CONFIGURED",
                "Mercado Pago access token ausente. Configure MP_ACCESS_TOKEN.",
            );
        }
        return sdkConfig;
    }

    return {
        isConfigured(): boolean {
            return sdkConfig !== null;
        },
        async ping(): Promise<{
            ok: boolean;
            environment: MercadoPagoEnvironment;
        }> {
            return { ok: sdkConfig !== null, environment };
        },

        async createPreference(
            input: CreatePreferenceInput,
        ): Promise<PreferenceResult> {
            const config = requireConfig();
            const preference = new Preference(config);

            const body = {
                items: input.items.map((item) => ({
                    id: item.id,
                    title: item.title,
                    description: item.description,
                    quantity: item.quantity ?? 1,
                    unit_price: item.unitPrice,
                    currency_id: item.currencyId ?? "BRL",
                })),
                external_reference: input.externalReference,
                back_urls: input.backUrls,
                notification_url: input.notificationUrl,
                auto_return: input.autoReturn,
                payer:
                    input.payerEmail !== undefined
                        ? { email: input.payerEmail }
                        : undefined,
            };

            try {
                const result = await preference.create({ body });
                if (!result.id) {
                    throw new MercadoPagoError(
                        "MP_REQUEST_FAILED",
                        "Mercado Pago retornou preference sem id.",
                    );
                }
                return {
                    id: result.id,
                    initPoint: result.init_point ?? "",
                    sandboxInitPoint: result.sandbox_init_point ?? "",
                };
            } catch (err) {
                if (err instanceof MercadoPagoError) throw err;
                throw new MercadoPagoError(
                    "MP_REQUEST_FAILED",
                    "Falha ao criar preference no Mercado Pago.",
                    err,
                );
            }
        },

        async getPayment(paymentId: string): Promise<PaymentDetails> {
            const config = requireConfig();
            const payment = new Payment(config);

            try {
                const result = await payment.get({ id: paymentId });
                return {
                    id: String(result.id ?? paymentId),
                    status: String(result.status ?? "unknown"),
                    statusDetail: result.status_detail ?? null,
                    externalReference: result.external_reference ?? null,
                    transactionAmount: result.transaction_amount ?? null,
                    currencyId: result.currency_id ?? null,
                };
            } catch (err) {
                if (err instanceof MercadoPagoError) throw err;
                throw new MercadoPagoError(
                    "MP_REQUEST_FAILED",
                    `Falha ao consultar payment ${paymentId} no Mercado Pago.`,
                    err,
                );
            }
        },
    };
}
