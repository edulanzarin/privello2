import { NextResponse } from "next/server";

import { hashPassword, verifyPassword } from "@/domain/auth/password";
import { validarSenha } from "@/domain/validation";
import { db } from "@/lib/db";
import { requireSession } from "@/server/auth/guards";

/**
 * Endpoint de troca de senha do usuário autenticado.
 *
 * Body JSON: `{ currentPassword: string, newPassword: string }`.
 *
 * Fluxo:
 * 1. Resolve sessão via guard.
 * 2. Lê `passwordHash` do User. Verifica `currentPassword` com
 *    argon2id (`verifyPassword`).
 * 3. Valida `newPassword` (regra canônica
 *    `@/domain/validation/senha`).
 * 4. Recusa se a nova é igual à atual (defesa em profundidade).
 * 5. Gera novo hash e atualiza o User.
 *
 * Mapeamento de respostas:
 *
 * - `200`: `{ ok: true }`.
 * - `401`: `{ ok: false, reason: "NAO_AUTENTICADO" }`.
 * - `400`: `{ ok: false, reason: "VALIDACAO" }`.
 * - `400`: `{ ok: false, reason: "SENHA_INVALIDA" }` (senha atual
 *   incorreta — propositalmente compartilha o status com validação
 *   para não diferenciar timing).
 * - `500`: `{ ok: false, reason: "PERSISTENCIA" }`.
 */
export async function POST(request: Request): Promise<NextResponse> {
    const auth = await requireSession(request);
    if (!auth.ok) return auth.response;

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json(
            { ok: false, reason: "VALIDACAO" },
            { status: 400 },
        );
    }

    if (
        body === null ||
        typeof body !== "object" ||
        typeof (body as { currentPassword?: unknown }).currentPassword !==
        "string" ||
        typeof (body as { newPassword?: unknown }).newPassword !== "string"
    ) {
        return NextResponse.json(
            { ok: false, reason: "VALIDACAO" },
            { status: 400 },
        );
    }

    const { currentPassword, newPassword } = body as {
        currentPassword: string;
        newPassword: string;
    };

    if (!validarSenha(newPassword)) {
        return NextResponse.json(
            { ok: false, reason: "VALIDACAO" },
            { status: 400 },
        );
    }
    if (currentPassword === newPassword) {
        return NextResponse.json(
            { ok: false, reason: "VALIDACAO" },
            { status: 400 },
        );
    }

    let user;
    try {
        user = await db.user.findUnique({
            where: { id: auth.userId },
            select: { passwordHash: true },
        });
    } catch {
        return NextResponse.json(
            { ok: false, reason: "PERSISTENCIA" },
            { status: 500 },
        );
    }

    if (!user) {
        return NextResponse.json(
            { ok: false, reason: "NAO_AUTENTICADO" },
            { status: 401 },
        );
    }

    const ok = await verifyPassword(currentPassword, user.passwordHash);
    if (!ok) {
        return NextResponse.json(
            { ok: false, reason: "SENHA_INVALIDA" },
            { status: 400 },
        );
    }

    try {
        const newHash = await hashPassword(newPassword);
        // Atualiza senha + revoga todas as sessões antigas atomicamente.
        // Preserva apenas a sessão atual pra que o usuário não seja
        // deslogado da própria janela enquanto troca a senha.
        await db.$transaction(async (tx) => {
            await tx.user.update({
                where: { id: auth.userId },
                data: { passwordHash: newHash },
            });
            await tx.session.updateMany({
                where: {
                    userId: auth.userId,
                    revokedAt: null,
                    id: { not: auth.sessionId },
                },
                data: { revokedAt: new Date() },
            });
        });
        return NextResponse.json({ ok: true }, { status: 200 });
    } catch {
        return NextResponse.json(
            { ok: false, reason: "PERSISTENCIA" },
            { status: 500 },
        );
    }
}
