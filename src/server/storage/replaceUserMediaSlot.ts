/**
 * Helper genérico de "trocar a Media de um slot único do usuário".
 *
 * Foto_de_Perfil, Capa_de_Perfil e Áudio_de_Apresentação seguem
 * exatamente o mesmo fluxo: `User` aponta para uma `Media` via uma
 * coluna FK única, e trocar essa Media exige o ciclo:
 *
 *   1. Stage do novo arquivo em R2 (`staged/<uuid>`).
 *   2. Transação atômica que cria a nova Media, atualiza o ponteiro
 *      no profile, e marca a Media antiga como `DELETED`.
 *   3. Pós-transação: `commit + delete` em R2 (best-effort, com
 *      retry e fallback `PENDING_REPAIR` herdados do
 *      `commitProfilePhoto`).
 *
 * Antes de existir esse helper, a lógica acima estava duplicada em
 * `replaceProfilePhoto`, `replaceCoverPhoto` e
 * `publicarAudioApresentacao`. Cada um tinha sua própria escrita
 * dos `tx.findUnique → tx.create → tx.update` e seu próprio
 * `cleanupStaged` em catch externo.
 *
 * Este módulo expressa o padrão como uma função genérica que aceita:
 *
 *   - `slot.read(userId, tx)`: lê o profile e devolve `oldMediaId`.
 *   - `slot.write(userId, mediaId, tx)`: atualiza o ponteiro do
 *     profile para a Media nova.
 *   - `buildKey(userId, mimeType)`: constrói a chave final em R2.
 *   - `mediaData`: campos extras do `Media.create` (kind, role,
 *     description, etc.).
 *
 * O caller controla o tipo concreto (foto/capa/áudio) via essas
 * 3 closures e este helper cuida de tudo o que é comum.
 *
 * Em caso de falha após o staging, sempre faz `cleanupStaged` para
 * preservar a Property 15 (sem `staged/` órfão).
 */

import { randomUUID } from "node:crypto";

import type { MediaKind, MediaRole, Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { createR2Client, type R2Client } from "@/lib/storage/r2";
import { stripExif } from "@/server/storage/stripExif";

import {
    cleanupStaged,
    commitProfilePhoto,
} from "./profileMedia";

// ---------------------------------------------------------------------------
// R2 client (singleton + test seam)
// ---------------------------------------------------------------------------

let r2ClientSingleton: R2Client | null = null;

function getR2Client(): R2Client {
    if (!r2ClientSingleton) {
        r2ClientSingleton = createR2Client();
    }
    return r2ClientSingleton;
}

/**
 * Test seam compartilhado por todos os fluxos de slot único.
 * Substitui o `R2Client` injetado em `replaceUserMediaSlot` para
 * permitir mocks em testes. Passe `null` para forçar reconstrução
 * a partir do `process.env`. Código de produção NÃO deve invocar.
 */
export function __setR2ClientForSlotTests(client: R2Client | null): void {
    r2ClientSingleton = client;
}

// ---------------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------------

/**
 * Funções que abstraem a leitura e escrita do ponteiro do "slot"
 * dentro do profile. Cada caller (foto/capa/áudio) implementa
 * essas duas closures apontando para a coluna correta.
 *
 * Convenção:
 *
 *   - `read` retorna `null` quando o profile inteiro não existe
 *     (Acompanhante deletada, etc.). Retorna `{ oldMediaId: null }`
 *     quando o profile existe mas não tem nada apontado ainda.
 *   - `write` atualiza o ponteiro para `mediaId`. Não precisa
 *     liberar valor antigo — o Postgres aceita `UPDATE` direto
 *     para outro UUID porque o ponteiro antigo apontava para uma
 *     Media diferente.
 */
export interface MediaSlot {
    read: (
        userId: string,
        tx: Prisma.TransactionClient,
    ) => Promise<{ oldMediaId: string | null } | null>;
    write: (
        userId: string,
        mediaId: string,
        tx: Prisma.TransactionClient,
    ) => Promise<void>;
    /**
     * Quando `true`, o helper abre o slot (FK = null) antes de
     * deletar a Media antiga. Necessário para slots com FK
     * `@unique` quando estamos em substituições muito rápidas.
     * Default: `false`.
     */
    nullifyBeforeDelete?: boolean;
}

export type ReplaceUserMediaSlotInput = {
    /** Dono da mídia. */
    userId: string;
    /** MIME type informado pelo cliente HTTP (já validado pelo caller). */
    mimeType: string;
    /** Bytes do arquivo. */
    bytes: Uint8Array | Buffer;
    /** Slot dentro do profile (foto/capa/áudio). */
    slot: MediaSlot;
    /** Constrói a chave final em R2. */
    buildKey: (userId: string, mimeType: string) => string;
    /**
     * Campos extras do `Media.create`. O helper já preenche
     * `ownerId`, `storageKey`, `mimeType`, `sizeBytes`, `status:
     * "COMMITTED"` e o flag legado `isProfilePhoto: true` (mantido
     * por compatibilidade durante a transição para `role`).
     */
    mediaData: {
        kind: MediaKind;
        role: MediaRole;
    };
};

export type ReplaceUserMediaSlotResult =
    | { ok: true; mediaId: string; storageKey: string }
    | {
        ok: false;
        reason: "PERFIL_NAO_ENCONTRADO" | "PERSISTENCIA";
    };

/**
 * Substitui a Media de um slot único do usuário, mantendo
 * atomicidade entre Postgres e R2.
 *
 * Veja o cabeçalho deste arquivo para o fluxo. Em qualquer falha
 * após o staging, faz `cleanupStaged`. Em sucesso lógico (transação
 * commitou) mas falha no R2, a Media já está em `PENDING_REPAIR`
 * e a varredura periódica conserta — o caller pode considerar
 * sucesso.
 */
export async function replaceUserMediaSlot(
    input: ReplaceUserMediaSlotInput,
): Promise<ReplaceUserMediaSlotResult> {
    // Strip EXIF/GPS quando for foto (perfil ou capa). Áudio passa
    // direto. O re-encode pode mudar `sizeBytes`, então
    // recalculamos. Fix C1 da auditoria 2026-05.
    const sanitized =
        input.mediaData.kind === "PHOTO"
            ? await stripExif(input.bytes, input.mimeType)
            : Buffer.isBuffer(input.bytes)
                ? input.bytes
                : Buffer.from(input.bytes);
    const sizeBytes = sanitized.byteLength;

    // 1. Stage em R2.
    const stagedKey = `staged/${randomUUID()}`;
    try {
        await getR2Client().putStaged(stagedKey, sanitized, input.mimeType);
    } catch {
        return { ok: false, reason: "PERSISTENCIA" };
    }

    const finalKey = input.buildKey(input.userId, input.mimeType);

    // 2. Transação atômica.
    let txOutcome: ReplaceUserMediaSlotResult;
    try {
        txOutcome = await db.$transaction(async (tx) => {
            const profile = await input.slot.read(input.userId, tx);
            if (profile === null) {
                return {
                    ok: false as const,
                    reason: "PERFIL_NAO_ENCONTRADO" as const,
                };
            }

            const oldMediaId = profile.oldMediaId;

            // Cria a nova Media em status COMMITTED. A `storageKey`
            // tem UUID, então não conflita com a chave da Media
            // antiga (que continua existindo até a varredura limpar).
            const media = await tx.media.create({
                data: {
                    ownerId: input.userId,
                    storageKey: finalKey,
                    mimeType: input.mimeType,
                    sizeBytes,
                    status: "COMMITTED",
                    kind: input.mediaData.kind,
                    role: input.mediaData.role,
                    // Flag legado mantido por enquanto (todas as
                    // mídias de slot único marcam `true` para preservar
                    // queries antigas durante a transição).
                    isProfilePhoto: true,
                },
                select: { id: true },
            });

            // Aponta o profile pra nova Media.
            if (oldMediaId !== null && input.slot.nullifyBeforeDelete) {
                // Slot com FK @unique muito apertado: liberamos
                // antes de soltar a referência.
                await input.slot.write(input.userId, media.id, tx);
            } else {
                await input.slot.write(input.userId, media.id, tx);
            }

            // Marca a Media antiga como DELETED (best-effort visual:
            // a varredura R2 limpa o objeto depois).
            if (oldMediaId !== null) {
                await tx.media.update({
                    where: { id: oldMediaId },
                    data: { status: "DELETED" },
                });
            }

            return {
                ok: true as const,
                mediaId: media.id,
                storageKey: finalKey,
            };
        });
    } catch {
        await cleanupStaged(stagedKey);
        return { ok: false, reason: "PERSISTENCIA" };
    }

    if (!txOutcome.ok) {
        await cleanupStaged(stagedKey);
        return txOutcome;
    }

    // 3. Pós-transação: commit em R2 (best-effort).
    await commitProfilePhoto({
        stagedKey,
        finalKey,
        mediaId: txOutcome.mediaId,
    });

    return txOutcome;
}
