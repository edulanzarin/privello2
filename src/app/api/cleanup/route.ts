import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";

import { runCleanup } from "@/server/cleanup";

/**
 * Compara o `expected` recebido no header com o token configurado
 * em tempo constante. Sem isso, um atacante poderia inferir
 * caracteres do token medindo o tempo de resposta.
 */
function safeTokenEquals(received: string, expected: string): boolean {
    const a = Buffer.from(received, "utf8");
    const b = Buffer.from(expected, "utf8");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
}

/**
 * `POST /api/cleanup` — endpoint de garbage collection.
 *
 * Protegido por header `Authorization: Bearer <CLEANUP_TOKEN>`
 * (env var). Quando `CLEANUP_TOKEN` não está configurado, o
 * endpoint responde 503 — força configuração explícita antes de
 * usar.
 *
 * Para chamar via cron (ex.: Railway cron, GitHub Actions, etc):
 *
 *   curl -X POST -H "Authorization: Bearer <token>" \
 *        https://app.example.com/api/cleanup
 *
 * Resposta:
 *   - 200: `{ ok: true, ...CleanupReport }`.
 *   - 401: token ausente/inválido.
 *   - 503: endpoint não configurado (sem env var).
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: Request): Promise<NextResponse> {
    const expectedToken = process.env.CLEANUP_TOKEN;
    if (!expectedToken || expectedToken.length === 0) {
        return NextResponse.json(
            { ok: false, reason: "NAO_CONFIGURADO" },
            { status: 503 },
        );
    }

    const auth = request.headers.get("authorization");
    if (auth === null || !auth.startsWith("Bearer ")) {
        return NextResponse.json(
            { ok: false, reason: "NAO_AUTORIZADO" },
            { status: 401 },
        );
    }
    const provided = auth.slice("Bearer ".length);
    if (!safeTokenEquals(provided, expectedToken)) {
        return NextResponse.json(
            { ok: false, reason: "NAO_AUTORIZADO" },
            { status: 401 },
        );
    }

    const report = await runCleanup();
    return NextResponse.json({ ok: true, ...report }, { status: 200 });
}
