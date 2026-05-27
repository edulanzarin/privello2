/**
 * Soma de curtidas totais de uma Acompanhante.
 *
 * Inclui curtidas em **todas** as mídias publicadas pelo usuário —
 * foto de perfil, capa, galeria e stories (ativos e arquivados) —
 * independente do `role`. Usado no:
 *
 *   - Perfil público (`/acompanhantes/[slug]`): linha de meta
 *     com "X visualizações · Y curtidas".
 *   - Painel da Acompanhante (`/acompanhante`): MetricPill
 *     "curtidas".
 *
 * Stories ARCHIVED contam — a Acompanhante não perde curtidas
 * quando um Story expira. DELETED não conta (foi removido
 * intencionalmente pelo dono).
 */

import { db } from "@/lib/db";

/**
 * Conta curtidas totais somando todas as mídias do usuário com
 * status COMMITTED ou ARCHIVED. Stories DELETED ficam de fora.
 *
 * Single query agregada — sem N+1.
 */
export async function contarLikesTotais(
    userId: string,
): Promise<number> {
    const result = await db.media.aggregate({
        where: {
            ownerId: userId,
            status: { in: ["COMMITTED", "ARCHIVED"] },
        },
        _sum: { likesCount: true },
    });

    return result._sum.likesCount ?? 0;
}
