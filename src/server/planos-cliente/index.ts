/**
 * Sistema_de_Planos_Cliente — serviço de seleção e renovação de
 * plano de Cliente.
 *
 * O plano `FAN` agora tem duração comprável (24h, 7 dias, 30 dias)
 * via checkout do Stripe. O fluxo:
 *
 * 1. **Criar checkout** — `criarPagamentoFan(userId, duracao)`:
 *    cria um `FanPayment` em `PENDING`, gera um `external_reference`
 *    único, cria a Checkout Session no Stripe e devolve a URL de
 *    redirect.
 *
 * 2. **Webhook do Stripe** — `processarWebhookFan(session)`:
 *    recebe o `SessionDetails` via webhook do Stripe, reconcilia
 *    com o `FanPayment` local pelo `client_reference_id`, e quando
 *    aprovado aplica `comprarFan` (estende `planoExpiraEm`).
 *
 * O `selecionar` aceita a chave de duração e calcula
 * `planoExpiraEm = now + duracaoMs`. Se o Cliente já tem `FAN`
 * ativo, comprar nova duração **estende** a janela existente
 * (cumulativo) — comprar 24h em cima de 5 dias restantes vira
 * "6 dias restantes".
 *
 * Garantias mantidas:
 *
 * - Strings inválidas viram `INVALIDO` sem tocar no banco.
 * - Falhas de I/O viram `PERSISTENCIA`.
 * - Downgrade ativo (`FAN → GRATIS` enquanto `planoExpiraEm > now`)
 *   é proibido.
 *
 * Quando o `planoExpiraEm` expira, leitura via {@link obterVigente}
 * retorna `GRATIS` automaticamente — o backend nunca trata um
 * Cliente expirado como `FAN`. O downgrade físico no banco
 * (`planoVigente: GRATIS`) é feito por GC noturno (não bloqueante).
 */

import { randomUUID } from "node:crypto";

import {
    PLANO_CLIENTE_DEFINITIONS,
    PLANO_CLIENTE_DURACOES,
    isPlanoClienteTipo,
    podeAlterarPlanoCliente,
    type PlanoClienteDefinition,
    type PlanoClienteDuracao,
    type PlanoClienteTipo,
} from "@/domain/plano-cliente/definitions";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

/** Cliente Prisma dentro de uma transação (`$transaction`). */
type PrismaTransactionClient = Prisma.TransactionClient;

// ---------------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------------

/**
 * Resultado de {@link selecionar} (mudança gratuita: `GRATIS` ou
 * idempotente).
 */
export type SelecionarPlanoClienteResult =
    | { ok: true }
    | {
        ok: false;
        reason:
            | "INVALIDO"
            | "DOWNGRADE_NAO_PERMITIDO"
            | "PERSISTENCIA";
    };

/**
 * Resultado de {@link comprarFan}.
 *
 * - `ok`: a compra foi aplicada. `expiraEm` é a nova data de fim.
 *   Se já havia plano ativo, foi estendida.
 * - `INVALIDO`: chave de duração desconhecida.
 * - `PERSISTENCIA`: falha de I/O. Estado anterior preservado.
 */
export type ComprarFanResult =
    | { ok: true; expiraEm: Date }
    | { ok: false; reason: "INVALIDO" | "PERSISTENCIA" };

/** Opções injetáveis para testes determinísticos. */
export type SelecionarPlanoClienteOptions = {
    /** Override do relógio. Default: `new Date()`. */
    now?: Date;
};

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

/**
 * Lista os planos disponíveis pra escolha. `GRATIS` é grátis (sem
 * duração); `FAN` aparece em 3 versões (24h, 7d, 30d) — caller
 * usa {@link PLANO_CLIENTE_DURACOES} pra montar as 3 opções de
 * compra.
 */
export function listar(): readonly PlanoClienteDefinition[] {
    return [
        PLANO_CLIENTE_DEFINITIONS.GRATIS,
        PLANO_CLIENTE_DEFINITIONS.FAN,
    ] as const;
}

/**
 * Registra `tipo` como plano vigente de `clienteId` — usado apenas
 * pra trocar pra `GRATIS` ou idempotência. Compras de `FAN`
 * (com duração) passam por {@link comprarFan}.
 */
export async function selecionar(
    clienteId: string,
    tipo: string,
    opts: SelecionarPlanoClienteOptions = {},
): Promise<SelecionarPlanoClienteResult> {
    if (!isPlanoClienteTipo(tipo)) {
        return { ok: false, reason: "INVALIDO" };
    }

    const now = opts.now ?? new Date();

    try {
        const current = await db.clientProfile.findUnique({
            where: { userId: clienteId },
            select: { planoVigente: true, planoExpiraEm: true },
        });

        if (current === null) {
            return { ok: false, reason: "PERSISTENCIA" };
        }

        // Para FAN, este path só serve se a tela de seleção quiser
        // gravar `FAN` sem comprar (ex.: ambiente de dev/seed). Em
        // produção sempre passa por `comprarFan`. Mantemos suporte
        // sem expiração — caller é responsável.
        if (current.planoVigente === tipo) {
            return { ok: true };
        }

        if (!podeAlterarPlanoCliente(current.planoVigente, tipo)) {
            // FAN → GRATIS bloqueado enquanto o FAN não expirou.
            const aindaAtivo =
                current.planoExpiraEm !== null &&
                current.planoExpiraEm.getTime() > now.getTime();
            if (aindaAtivo) {
                return { ok: false, reason: "DOWNGRADE_NAO_PERMITIDO" };
            }
        }

        await db.clientProfile.update({
            where: { userId: clienteId },
            data: {
                planoVigente: tipo as PlanoClienteTipo,
                planoSelecionadoEm: now,
                // Trocar pra GRATIS limpa expiração; ir pra FAN
                // sem comprar (caso do seed) também limpa.
                planoExpiraEm: null,
            },
            select: { userId: true },
        });

        return { ok: true };
    } catch {
        return { ok: false, reason: "PERSISTENCIA" };
    }
}

/**
 * Aplica a compra de uma duração de Fan para `clienteId`.
 *
 * Computa `expiraEm`:
 *   - Se já tem Fan ativo (`planoExpiraEm > now`), **estende**:
 *     `expiraEm = planoExpiraEm + duracaoMs`. Permite cumular várias
 *     compras (ex.: 5 dias + 24h = 6 dias).
 *   - Senão, `expiraEm = now + duracaoMs`.
 *
 * Idempotência: cada chamada produz uma nova janela. Caller
 * (webhook MP, fluxo de checkout) é responsável por garantir que
 * a função só roda após pagamento confirmado.
 */
export async function comprarFan(
    clienteId: string,
    duracaoChave: string,
    opts: SelecionarPlanoClienteOptions & { client?: PrismaTransactionClient } = {},
): Promise<ComprarFanResult> {
    if (
        duracaoChave !== "FAN_24H" &&
        duracaoChave !== "FAN_7D" &&
        duracaoChave !== "FAN_30D"
    ) {
        return { ok: false, reason: "INVALIDO" };
    }

    const now = opts.now ?? new Date();
    const client = opts.client ?? db;
    const duracao = PLANO_CLIENTE_DURACOES[duracaoChave as PlanoClienteDuracao];

    try {
        const current = await client.clientProfile.findUnique({
            where: { userId: clienteId },
            select: { planoVigente: true, planoExpiraEm: true },
        });

        if (current === null) {
            return { ok: false, reason: "PERSISTENCIA" };
        }

        // Base de cálculo: maior entre `now` e `planoExpiraEm`
        // existente. Estende em vez de sobrescrever.
        const baseMs = Math.max(
            now.getTime(),
            current.planoExpiraEm?.getTime() ?? 0,
        );
        const expiraEm = new Date(baseMs + duracao.duracaoMs);

        await client.clientProfile.update({
            where: { userId: clienteId },
            data: {
                planoVigente: "FAN",
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

/**
 * Lê o plano vigente de `clienteId` aplicando expiração lazy.
 *
 * Quando `planoVigente === "FAN"` mas `planoExpiraEm <= now`, o
 * retorno é `GRATIS` (downgrade lazy). O banco não é tocado aqui —
 * a normalização física fica pro GC noturno. Garantia importante:
 * mesmo que o GC esteja fora do ar, a aplicação trata o Cliente
 * como `GRATIS` corretamente.
 */
export async function obterVigente(
    clienteId: string,
    opts: SelecionarPlanoClienteOptions = {},
): Promise<PlanoClienteDefinition | null> {
    const now = opts.now ?? new Date();

    const profile = await db.clientProfile.findUnique({
        where: { userId: clienteId },
        select: { planoVigente: true, planoExpiraEm: true },
    });

    if (!profile || profile.planoVigente === null) {
        return null;
    }

    if (
        profile.planoVigente === "FAN" &&
        profile.planoExpiraEm !== null &&
        profile.planoExpiraEm.getTime() <= now.getTime()
    ) {
        return PLANO_CLIENTE_DEFINITIONS.GRATIS;
    }

    return PLANO_CLIENTE_DEFINITIONS[profile.planoVigente];
}


// ---------------------------------------------------------------------------
// Checkout do plano Fan (Stripe)
// ---------------------------------------------------------------------------

import {
    StripeError,
    createStripeClient,
    type StripeClient,
} from "@/lib/payments/stripe";

let stripeClientSingleton: StripeClient | null = null;

function getStripeClient(): StripeClient {
    if (!stripeClientSingleton) {
        stripeClientSingleton = createStripeClient();
    }
    return stripeClientSingleton;
}

export type CriarPagamentoFanInput = {
    /** Cliente autenticado. */
    userId: string;
    /** Duração comprada: FAN_24H, FAN_7D ou FAN_30D. */
    duracao: PlanoClienteDuracao;
    /**
     * URL base do app (ex.: `https://www.privello.com.br`). Usada
     * para construir as URLs de sucesso/cancelamento enviadas ao
     * Stripe.
     */
    baseUrl: string;
    /** Email do pagador (preenche automático no checkout). */
    payerEmail?: string;
};

export type CriarPagamentoFanResult =
    | { ok: true; checkoutUrl: string; paymentId: string }
    | {
        ok: false;
        reason:
            | "PERFIL_NAO_ENCONTRADO"
            | "PAGAMENTO_NAO_CONFIGURADO"
            | "DURACAO_INVALIDA"
            | "PERSISTENCIA";
    };

/**
 * Cria um novo `FanPayment` em estado `PENDING`, gera a
 * checkout session no Stripe e devolve a URL de checkout.
 */
export async function criarPagamentoFan(
    input: CriarPagamentoFanInput,
): Promise<CriarPagamentoFanResult> {
    // 1. Verifica que existe Cliente para este userId.
    const profile = await db.clientProfile.findUnique({
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

    const definicao = PLANO_CLIENTE_DURACOES[input.duracao];
    if (!definicao) {
        return { ok: false, reason: "DURACAO_INVALIDA" };
    }

    // 2. Cria o registro local primeiro.
    const externalReference = `fan_${randomUUID()}`;
    let payment;
    try {
        payment = await db.fanPayment.create({
            data: {
                userId: input.userId,
                amountCents: definicao.precoCents,
                currency: "BRL",
                duracao: input.duracao,
                status: "PENDING",
                externalReference,
            },
            select: { id: true },
        });
    } catch {
        return { ok: false, reason: "PERSISTENCIA" };
    }

    // 3. Cria o Checkout Session no Stripe.
    const baseUrl = input.baseUrl.replace(/\/$/, "");
    const successUrl = `${baseUrl}/cliente?payment=success&ref=${externalReference}`;
    const cancelUrl = `${baseUrl}/cliente/selecao-plano?payment=cancel&ref=${externalReference}`;

    let session;
    try {
        session = await stripe.createCheckoutSession({
            items: [
                {
                    name: `Plano Fan · ${definicao.label}`,
                    description: `Acesso total aos perfis por ${definicao.label.toLowerCase()}`,
                    quantity: 1,
                    unitAmountCents: definicao.precoCents,
                    currency: "brl",
                },
            ],
            clientReferenceId: externalReference,
            successUrl,
            cancelUrl,
            customerEmail: input.payerEmail,
            metadata: { userId: input.userId, duracao: input.duracao },
        });
    } catch (err) {
        // Marca como rejected pra não ficar PENDING órfão.
        try {
            await db.fanPayment.update({
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
        await db.fanPayment.update({
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
// Processar webhook do Fan
// ---------------------------------------------------------------------------

export type ProcessarWebhookFanResult =
    | { ok: true; applied: boolean }
    | {
        ok: false;
        reason: "PAGAMENTO_NAO_ENCONTRADO" | "PERSISTENCIA";
    };

/**
 * Reconcilia o status de um pagamento via webhook do Stripe.
 *
 * Recebe o `SessionDetails` já verificado pelo webhook handler.
 * Fluxo:
 *   1. Localiza o `FanPayment` local pelo `clientReferenceId`
 *      (= `externalReference`).
 *   2. Idempotência: se já `APPROVED` com o mesmo `paymentIntentId`,
 *      retorna `applied: false`.
 *   3. Quando `paymentStatus === "paid"`:
 *      - Marca como `APPROVED`, grava `paymentIntentId`.
 *      - Chama `comprarFan` pra estender `planoExpiraEm`.
 *   4. Caso contrário: grava o `paymentIntentId` para reconciliação.
 */
export async function processarWebhookFan(
    session: {
        clientReferenceId: string | null;
        paymentStatus: string;
        paymentIntentId: string | null;
    },
    options: { now?: Date } = {},
): Promise<ProcessarWebhookFanResult> {
    if (!session.clientReferenceId) {
        return { ok: false, reason: "PAGAMENTO_NAO_ENCONTRADO" };
    }

    const local = await db.fanPayment.findUnique({
        where: { externalReference: session.clientReferenceId },
        select: {
            id: true,
            status: true,
            stripePaymentIntentId: true,
            userId: true,
            duracao: true,
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
                // Aplica a duração via comprarFan.
                const result = await comprarFan(
                    local.userId,
                    local.duracao,
                    { now, client: tx },
                );
                if (!result.ok) {
                    throw new Error(`comprarFan failed: ${result.reason}`);
                }

                // Marca como aprovado.
                await tx.fanPayment.update({
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

    // Session expirada ou não paga — grava o PI pra reconciliação.
    try {
        await db.fanPayment.update({
            where: { id: local.id },
            data: { stripePaymentIntentId: session.paymentIntentId },
        });
    } catch {
        // best-effort.
    }
    return { ok: true, applied: false };
}
