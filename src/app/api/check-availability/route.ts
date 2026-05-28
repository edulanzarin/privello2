/**
 * GET /api/check-availability?type=email&value=xxx
 * GET /api/check-availability?type=identificador&value=xxx
 *
 * Verifica disponibilidade de email/identificador em tempo real
 * durante o onboarding/cadastro. Não requer autenticação porque
 * é usado nas telas públicas, mas tem rate limit por IP pra
 * impedir enumeração em massa.
 *
 * # Anti-enumeração
 *
 * - **Rate limit**: 30 requisições por IP a cada 60 segundos. O
 *   onboarding faz uma checagem por campo, logo 30 cobre uso
 *   normal com sobra. Scrapers de catálogo de emails veem 429.
 * - **Validação prévia**: rejeita valores que não passam no
 *   formato esperado (email regex / identificador slug). Isso
 *   força o atacante a usar entradas válidas, dobrando o custo.
 */

import { NextResponse, type NextRequest } from "next/server";

import { validarEmail, validarIdentificadorFormato } from "@/domain/validation";
import { db } from "@/lib/db";
import {
    checkRateLimit,
    clientKeyFromRequest,
} from "@/server/auth/rateLimitMemory";

export async function GET(request: NextRequest): Promise<NextResponse> {
    const type = request.nextUrl.searchParams.get("type");
    const value = request.nextUrl.searchParams.get("value");

    if (!type || !value || (type !== "email" && type !== "identificador")) {
        return NextResponse.json(
            { error: "Parâmetros inválidos" },
            { status: 400 },
        );
    }

    const normalized = value.trim().toLowerCase();
    if (normalized.length === 0) {
        return NextResponse.json({ available: true });
    }

    // Rejeita formatos inválidos antes de bater no DB. Sem isso,
    // um atacante usaria valores aleatórios e ainda assim consumiria
    // o budget do banco.
    const formatoOk =
        type === "email"
            ? validarEmail(normalized)
            : validarIdentificadorFormato(normalized);
    if (!formatoOk) {
        return NextResponse.json(
            { error: "Formato inválido" },
            { status: 400 },
        );
    }

    // Rate limit por IP. 30 hits/min — onboarding normal não
    // chega perto.
    const clientKey = clientKeyFromRequest(request);
    const rl = checkRateLimit("check-availability", clientKey, {
        windowMs: 60_000,
        max: 30,
    });
    if (!rl.ok) {
        return NextResponse.json(
            { error: "Muitas requisições. Aguarde alguns segundos." },
            {
                status: 429,
                headers: {
                    "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)),
                },
            },
        );
    }

    const existing = await db.user.findUnique({
        where:
            type === "email"
                ? { email: normalized }
                : { identificador: normalized },
        select: { id: true },
    });

    return NextResponse.json({ available: existing === null });
}
