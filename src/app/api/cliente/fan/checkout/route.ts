import { NextResponse } from "next/server";

import { requireCliente } from "@/server/auth/guards";
import { criarPagamentoFan } from "@/server/planos-cliente";
import { db } from "@/lib/db";
import type { PlanoClienteDuracao } from "@/domain/plano-cliente/definitions";

/**
 * Endpoint de criação de checkout de plano Fan.
 *
 * Body: `{ duracao: "FAN_24H" | "FAN_7D" | "FAN_30D" }`.
 * Identidade vem do cookie de sessão.
 *
 * Em sucesso, devolve a `checkoutUrl` (Stripe Checkout Session)
 * para a qual o front redireciona o usuário.
 *
 * Mapeamento de respostas:
 * - `200`: `{ ok: true, checkoutUrl, paymentId }`.
 * - `400`: `{ ok: false, reason: "DURACAO_INVALIDA" }`.
 * - `401`: `{ ok: false, reason: "NAO_AUTENTICADO" }`.
 * - `403`: `{ ok: false, reason: "TIPO_INVALIDO" }`.
 * - `404`: `{ ok: false, reason: "PERFIL_NAO_ENCONTRADO" }`.
 * - `503`: `{ ok: false, reason: "PAGAMENTO_NAO_CONFIGURADO" }`.
 * - `500`: `{ ok: false, reason: "PERSISTENCIA" }`.
 */
export async function POST(request: Request): Promise<NextResponse> {
    const auth = await requireCliente(request);
    if (!auth.ok) return auth.response;

    let duracao: string;
    try {
        const body = (await request.json()) as { duracao?: unknown };
        if (typeof body.duracao !== "string") {
            return NextResponse.json(
                { ok: false, reason: "DURACAO_INVALIDA" },
                { status: 400 },
            );
        }
        duracao = body.duracao;
    } catch {
        return NextResponse.json(
            { ok: false, reason: "DURACAO_INVALIDA" },
            { status: 400 },
        );
    }

    if (duracao !== "FAN_24H" && duracao !== "FAN_7D" && duracao !== "FAN_30D") {
        return NextResponse.json(
            { ok: false, reason: "DURACAO_INVALIDA" },
            { status: 400 },
        );
    }

    // `baseUrl`: prioriza variável de ambiente NEXT_PUBLIC_SITE_URL;
    // cai no header `origin` quando ausente.
    const envBase =
        process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL;
    const baseUrl =
        envBase && envBase.length > 0
            ? envBase
            : request.headers.get("origin") ?? "";
    if (!baseUrl) {
        return NextResponse.json(
            { ok: false, reason: "PERSISTENCIA" },
            { status: 500 },
        );
    }

    // Email para preencher automaticamente o checkout. Não é
    // obrigatório, mas melhora a UX.
    const user = await db.user.findUnique({
        where: { id: auth.userId },
        select: { email: true },
    });

    const result = await criarPagamentoFan({
        userId: auth.userId,
        duracao: duracao as PlanoClienteDuracao,
        baseUrl,
        payerEmail: user?.email,
    });

    if (result.ok) {
        return NextResponse.json(result, { status: 200 });
    }
    if (result.reason === "PERFIL_NAO_ENCONTRADO") {
        return NextResponse.json(result, { status: 404 });
    }
    if (result.reason === "PAGAMENTO_NAO_CONFIGURADO") {
        return NextResponse.json(result, { status: 503 });
    }
    if (result.reason === "DURACAO_INVALIDA") {
        return NextResponse.json(result, { status: 400 });
    }
    return NextResponse.json(result, { status: 500 });
}
