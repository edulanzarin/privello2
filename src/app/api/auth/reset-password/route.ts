import { NextResponse } from "next/server";
import { z } from "zod";

import { validarSenha } from "@/domain/validation";
import { enforceCsrf } from "@/server/auth/csrf";
import { consumirTokenResetSenha } from "@/server/auth/passwordReset";

/**
 * `POST /api/auth/reset-password`
 *
 * Consome um token de reset e troca a senha.
 *
 * Body JSON:
 *   - `token`: string (raw, recebido por email).
 *   - `password`: nova senha (8..128 chars).
 *
 * Respostas:
 *   - 200: `{ ok: true }`. Sessões antigas do usuário foram revogadas.
 *   - 400: `{ ok: false, reason: "VALIDACAO" | "SENHA_INVALIDA" }`.
 *   - 410: `{ ok: false, reason: "TOKEN_INVALIDO" }` (expirado / usado / não existe).
 *   - 500: `{ ok: false, reason: "PERSISTENCIA" }`.
 */
const bodySchema = z.object({
    token: z.string().min(1),
    password: z.string(),
});

export async function POST(request: Request): Promise<NextResponse> {
    const csrf = enforceCsrf(request);
    if (csrf) return csrf;

    let raw: unknown;
    try {
        raw = await request.json();
    } catch {
        return NextResponse.json(
            { ok: false, reason: "VALIDACAO" },
            { status: 400 },
        );
    }

    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
        return NextResponse.json(
            { ok: false, reason: "VALIDACAO" },
            { status: 400 },
        );
    }

    if (!validarSenha(parsed.data.password)) {
        return NextResponse.json(
            { ok: false, reason: "SENHA_INVALIDA" },
            { status: 400 },
        );
    }

    const result = await consumirTokenResetSenha({
        token: parsed.data.token,
        novaSenha: parsed.data.password,
    });

    if (result.ok) {
        return NextResponse.json({ ok: true }, { status: 200 });
    }
    if (result.reason === "TOKEN_INVALIDO") {
        return NextResponse.json(
            { ok: false, reason: "TOKEN_INVALIDO" },
            { status: 410 },
        );
    }
    if (result.reason === "SENHA_INVALIDA") {
        return NextResponse.json(
            { ok: false, reason: "SENHA_INVALIDA" },
            { status: 400 },
        );
    }
    return NextResponse.json(
        { ok: false, reason: "PERSISTENCIA" },
        { status: 500 },
    );
}
