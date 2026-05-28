import { NextResponse } from "next/server";
import { z } from "zod";

import { validarEmail } from "@/domain/validation";
import { enforceCsrf } from "@/server/auth/csrf";
import { criarTokenResetSenha } from "@/server/auth/passwordReset";

/**
 * `POST /api/auth/forgot-password`
 *
 * Recebe email e dispara fluxo de reset.
 *
 * **Sempre responde 200** (independente do email existir ou não)
 * para evitar enumeração de contas. O cliente vê sempre a mesma
 * mensagem ("se o email existir, enviamos um link").
 *
 * Em **dev** (NODE_ENV !== production), inclui o token gerado no
 * payload de retorno como `_devToken` — facilita teste manual sem
 * email real configurado. Em prod o campo nunca aparece.
 *
 * Rate limit: 3 solicitações por email / 60 min (em
 * `criarTokenResetSenha`).
 */
const bodySchema = z.object({
    email: z.string(),
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
    if (!parsed.success || !validarEmail(parsed.data.email)) {
        return NextResponse.json(
            { ok: false, reason: "VALIDACAO" },
            { status: 400 },
        );
    }

    const result = await criarTokenResetSenha(parsed.data.email);

    if (!result.ok) {
        return NextResponse.json(
            { ok: false, reason: "RATE_LIMITED" },
            { status: 429, headers: { "Retry-After": "3600" } },
        );
    }

    // Resposta padronizada — não revela existência da conta.
    const payload: { ok: true; _devToken?: string; _devEmailValido?: boolean } =
        {
            ok: true,
        };
    // Só vaza o token em DEV (não em staging, qa, etc.). A
    // checagem é dupla: NODE_ENV !== production E
    // NEXT_PUBLIC_SITE_URL apontando pra localhost. Staging tem
    // NEXT_PUBLIC_SITE_URL com domínio real → nunca expõe.
    const isDevLocal =
        process.env.NODE_ENV !== "production" &&
        (process.env.NEXT_PUBLIC_SITE_URL ?? "").includes("localhost");
    if (isDevLocal) {
        payload._devToken = result.token;
        payload._devEmailValido = result.emailValido;
    }

    return NextResponse.json(payload, { status: 200 });
}
