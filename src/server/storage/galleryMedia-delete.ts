/**
 * Exclusão de mídia da galeria.
 *
 * Soft-delete: marca `Media.status = DELETED` para que a varredura
 * periódica do `Sistema_de_Reparo` saiba que pode apagar o objeto em
 * R2 sem coordenação adicional. A linha do banco é mantida para
 * preservar referências em comentários/curtidas/etc. quando esses
 * sistemas existirem (Caminho A descrito em
 * `_painel/AtividadeTab.tsx` do Cliente).
 */

import { db } from "@/lib/db";

import { createR2Client } from "@/lib/storage/r2";

export type ExcluirMidiaInput = {
    /** Dono da mídia (Acompanhante autenticada). */
    userId: string;
    /** ID da Media. */
    mediaId: string;
};

export type ExcluirMidiaResult =
    | { ok: true }
    | { ok: false; reason: "NAO_ENCONTRADA" | "PERSISTENCIA" };

/**
 * Exclui uma mídia da galeria do usuário.
 *
 * Recusa com `NAO_ENCONTRADA` quando o `mediaId` não pertence ao
 * `userId` ou quando é uma `isProfilePhoto` (foto de perfil tem
 * fluxo próprio de troca, não de delete).
 *
 * Em sucesso, remove o objeto em R2 em best-effort. Se o R2 falhar,
 * a Media já está marcada como `DELETED` e a varredura pega depois.
 */
export async function excluirMidia(
    input: ExcluirMidiaInput,
): Promise<ExcluirMidiaResult> {
    let row;
    try {
        row = await db.media.findUnique({
            where: { id: input.mediaId },
            select: {
                ownerId: true,
                storageKey: true,
                role: true,
                status: true,
            },
        });
    } catch {
        return { ok: false, reason: "PERSISTENCIA" };
    }

    if (!row) {
        return { ok: false, reason: "NAO_ENCONTRADA" };
    }
    if (row.ownerId !== input.userId) {
        // Defesa em profundidade: never reveal existence.
        return { ok: false, reason: "NAO_ENCONTRADA" };
    }
    if (row.role !== "GALLERY") {
        // Slots únicos (foto/capa/áudio) têm fluxo próprio de troca,
        // não de delete pelo endpoint genérico de mídia.
        return { ok: false, reason: "NAO_ENCONTRADA" };
    }
    if (row.status === "DELETED") {
        // Idempotente.
        return { ok: true };
    }

    try {
        await db.media.update({
            where: { id: input.mediaId },
            data: { status: "DELETED" },
        });
    } catch {
        return { ok: false, reason: "PERSISTENCIA" };
    }

    // Best-effort: apaga o objeto. Se falhar, a varredura periódica
    // limpa depois.
    try {
        await createR2Client().deleteObject(row.storageKey);
    } catch {
        // Sem panic — a Media já está como DELETED.
    }

    return { ok: true };
}
