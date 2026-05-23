/**
 * GET /api/check-availability?type=email&value=xxx
 * GET /api/check-availability?type=identificador&value=xxx
 *
 * Retorna { available: true/false } para verificação em tempo real
 * durante o onboarding/cadastro. Não requer autenticação.
 */

import { NextResponse, type NextRequest } from "next/server";

import { db } from "@/lib/db";

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

    const existing = await db.user.findUnique({
        where: type === "email" ? { email: normalized } : { identificador: normalized },
        select: { id: true },
    });

    return NextResponse.json({ available: existing === null });
}
