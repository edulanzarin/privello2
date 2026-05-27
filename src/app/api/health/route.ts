import { NextResponse } from "next/server";

import { db } from "@/lib/db";

/**
 * `GET /api/health` — health check para orquestrador (Railway,
 * Cloudflare, k8s, etc).
 *
 * Verifica se a aplicação consegue se comunicar com o banco em uma
 * query trivial (`SELECT 1`). Em sucesso devolve 200 com payload JSON
 * contendo `ok: true`, `db: "up"` e o `uptime` em segundos. Em falha
 * de banco devolve 503 com `db: "down"` para que o orquestrador remova
 * a instância do balanceador.
 *
 * O endpoint é deliberadamente leve — não lê tabelas reais para que
 * `up` não fique falsamente verde quando os índices/triggers estão
 * corrompidos. Para diagnósticos mais profundos, criar
 * `/api/health/deep` no futuro.
 *
 * Nunca cacheado (`force-dynamic` + `revalidate = 0`).
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(): Promise<NextResponse> {
    const startedAt = Date.now();
    try {
        await db.$queryRaw`SELECT 1`;
        return NextResponse.json(
            {
                ok: true,
                db: "up" as const,
                uptime: Math.round(process.uptime()),
                latencyMs: Date.now() - startedAt,
                ts: new Date().toISOString(),
            },
            { status: 200 },
        );
    } catch {
        return NextResponse.json(
            {
                ok: false,
                db: "down" as const,
                latencyMs: Date.now() - startedAt,
                ts: new Date().toISOString(),
            },
            { status: 503 },
        );
    }
}
