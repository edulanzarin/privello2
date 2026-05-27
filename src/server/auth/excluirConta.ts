/**
 * Exclusão de conta (LGPD).
 *
 * Hard-delete do `User`. Como `Cascade` está configurado em todas
 * as tabelas dependentes (Sessions, ClientProfile,
 * AcompanhanteProfile, Media, MediaLike, MediaComment, StoryView,
 * Reviews, Questions, BoostPayment, OnboardingDraft via cookie),
 * apagar o User remove tudo automaticamente em uma transação SQL.
 *
 * Pós-transação: best-effort para apagar arquivos de R2 que
 * pertencem ao usuário. Erro de R2 não falha a operação — o cron
 * de limpeza pode pegar órfãos depois.
 *
 * Validação:
 *   - Cliente exige reautenticação (senha atual). Defesa contra
 *     sessão sequestrada.
 */

import { Prisma } from "@prisma/client";

import { verifyPassword } from "@/domain/auth/password";
import { db } from "@/lib/db";
import { createR2Client, type R2Client } from "@/lib/storage/r2";

export type ExcluirContaResult =
    | { ok: true; deletedFiles: number; failedFiles: number }
    | { ok: false; reason: "SENHA_INCORRETA" | "USUARIO_NAO_ENCONTRADO" | "PERSISTENCIA" };

/**
 * Apaga a conta do usuário e todos os dados associados.
 *
 * @param userId    ID do usuário autenticado.
 * @param password  Senha atual (para reautenticação).
 */
export async function excluirConta(
    userId: string,
    password: string,
    options: { r2Client?: R2Client | null } = {},
): Promise<ExcluirContaResult> {
    // 1. Reautentica.
    const user = await db.user.findUnique({
        where: { id: userId },
        select: { passwordHash: true },
    });
    if (!user) {
        return { ok: false, reason: "USUARIO_NAO_ENCONTRADO" };
    }

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
        return { ok: false, reason: "SENHA_INCORRETA" };
    }

    // 2. Coleta as chaves R2 ANTES de apagar (cascade leva tudo).
    const medias = await db.media.findMany({
        where: { ownerId: userId },
        select: { storageKey: true },
    });
    const storageKeys = medias.map((m) => m.storageKey);

    // 3. Apaga User — Cascade cuida do resto.
    try {
        await db.user.delete({ where: { id: userId } });
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
            return { ok: false, reason: "PERSISTENCIA" };
        }
        return { ok: false, reason: "PERSISTENCIA" };
    }

    // 4. Best-effort: apaga arquivos R2.
    const r2 = options.r2Client ?? createR2Client();
    let deletedFiles = 0;
    let failedFiles = 0;
    for (const key of storageKeys) {
        try {
            await r2.deleteObject(key);
            deletedFiles++;
        } catch {
            failedFiles++;
        }
    }

    return { ok: true, deletedFiles, failedFiles };
}
