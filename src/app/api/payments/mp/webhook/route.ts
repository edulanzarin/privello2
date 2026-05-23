import { NextResponse } from "next/server";

import { processarWebhookBoost } from "@/server/boost";

/**
 * Webhook do Mercado Pago.
 *
 * O MP envia POST para esta URL quando o status de um payment
 * muda. O payload tem este formato:
 *
 * ```json
 * {
 *   "type": "payment",
 *   "data": { "id": "<paymentId>" }
 * }
 * ```
 *
 * Também pode vir como query string em alguns webhooks legados:
 * `?topic=payment&id=<paymentId>`. Aceitamos os dois.
 *
 * Para evitar bloquear o MP em caso de falha de processamento,
 * **sempre** retornamos 200 — o erro é logado mas não resulta em
 * retry agressivo do MP. A reconciliação periódica futura cuida
 * de eventuais inconsistências.
 *
 * Atualmente trata apenas pagamentos de Boost (única categoria de
 * pagamento existente). Quando outras (assinatura mensal, etc.)
 * forem adicionadas, a função vai discriminar por algum prefixo do
 * `external_reference`.
 */
export async function POST(request: Request): Promise<NextResponse> {
    let paymentId: string | null = null;

    // Tentativa 1: body JSON.
    try {
        const body = (await request.clone().json()) as
            | { type?: string; data?: { id?: string | number } }
            | null;
        if (
            body &&
            (body.type === "payment" || body.type === undefined) &&
            body.data?.id !== undefined &&
            body.data.id !== null
        ) {
            paymentId = String(body.data.id);
        }
    } catch {
        // Ignora — vamos tentar query.
    }

    // Tentativa 2: query string (`?topic=payment&id=...` ou `?id=...`).
    if (paymentId === null) {
        const url = new URL(request.url);
        const id = url.searchParams.get("id");
        const dataId = url.searchParams.get("data.id");
        paymentId = id ?? dataId ?? null;
    }

    if (paymentId === null) {
        // Webhook sem ID — provavelmente outro tipo de notificação
        // (merchant_order, etc.). Apenas confirma o recebimento.
        return NextResponse.json({ ok: true, ignored: true }, { status: 200 });
    }

    try {
        await processarWebhookBoost(paymentId);
    } catch (err) {
        console.error("[mp/webhook] falha ao processar", err);
    }

    return NextResponse.json({ ok: true }, { status: 200 });
}


/**
 * Algumas variantes legadas do webhook do MP usam GET em vez de
 * POST. Reusamos exatamente a mesma lógica (que ignora body
 * quando não é JSON e cai pra query string).
 */
export async function GET(request: Request): Promise<NextResponse> {
    return POST(request);
}
