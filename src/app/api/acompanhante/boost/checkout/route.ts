import { NextResponse } from "next/server";

import { requireAcompanhante } from "@/server/auth/guards";
import { criarPagamentoBoost } from "@/server/boost";
import { db } from "@/lib/db";

/**
 * Endpoint de criação de checkout de Boost.
 *
 * Body: vazio. Identidade vem do cookie de sessão.
 *
 * Em sucesso, devolve a `checkoutUrl` (`init_point` do Mercado
 * Pago) para a qual o front redireciona o usuário. O front é
 * responsável pelo `window.location.href = url` — fazer redirect
 * direto do servidor não funciona com `fetch` em SPA.
 *
 * Mapeamento de respostas:
 * - `200`: `{ ok: true, checkoutUrl, paymentId }`.
 * - `401`: `{ ok: false, reason: "NAO_AUTENTICADO" }`.
 * - `403`: `{ ok: false, reason: "TIPO_INVALIDO" }`.
 * - `404`: `{ ok: false, reason: "PERFIL_NAO_ENCONTRADO" }`.
 * - `503`: `{ ok: false, reason: "MP_NAO_CONFIGURADO" }`.
 * - `500`: `{ ok: false, reason: "PERSISTENCIA" }`.
 */
export async function POST(request: Request): Promise<NextResponse> {
    const auth = await requireAcompanhante(request);
    if (!auth.ok) return auth.response;

    // `baseUrl`: prioriza variável de ambiente NEXT_PUBLIC_APP_URL;
    // cai no header `origin` quando ausente. O MP usa esse valor pra
    // gerar as `back_urls` (sucesso/falha/pendente).
    const envBase = process.env.NEXT_PUBLIC_APP_URL;
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

    // `startAt` opcional no body — ISO string. Ausente = imediato.
    let startAt: string | null = null;
    try {
        const body = (await request.json().catch(() => null)) as
            | { startAt?: unknown }
            | null;
        if (body && typeof body.startAt === "string") {
            startAt = body.startAt;
        }
    } catch {
        // body vazio é OK (boost imediato).
    }

    // Email para preencher automaticamente o checkout do MP. Não é
    // obrigatório, mas melhora a UX.
    const user = await db.user.findUnique({
        where: { id: auth.userId },
        select: { email: true },
    });

    const result = await criarPagamentoBoost({
        userId: auth.userId,
        baseUrl,
        payerEmail: user?.email,
        startAt,
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
    if (result.reason === "AGENDAMENTO_INVALIDO") {
        return NextResponse.json(result, { status: 400 });
    }
    return NextResponse.json(result, { status: 500 });
}
