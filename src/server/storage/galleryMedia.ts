/**
 * Galeria de mídias da Acompanhante.
 *
 * Concentra as operações de publicar/listar mídias adicionais
 * (fotos e vídeos) — as que aparecem no perfil público em formato de
 * grade, distintas da Foto_de_Perfil.
 *
 * Padrão de armazenamento idêntico ao
 * `Sistema_de_Cadastro_Cliente.registrar` e ao
 * `replaceProfilePhoto`, com um passo extra de marca d'água:
 *
 * 1. **Validação canônica** (MIME, tamanho, descrição).
 * 2. **Marca d'água** (logo "Privello") aplicada pelo
 *    {@link import("./watermark").applyGalleryWatermark}. Fotos via
 *    sharp, vídeos via FFmpeg estático.
 * 3. **Stage** em R2 (`staged/<uuid>`) — sem tocar no banco.
 * 4. **Transação atômica** que cria a `Media` linkando ao `userId`
 *    com `isProfilePhoto: false`, `kind: PHOTO|VIDEO`, descrição
 *    opcional, e respeita o limite do plano vigente (lendo `count`
 *    no momento da inserção dentro da `tx`).
 * 5. **Pós-transação**: `commit + delete` em R2 com retry e
 *    fallback para `PENDING_REPAIR` em caso de falha persistente.
 *
 * Em qualquer falha após o staging, `cleanupStaged` apaga o objeto
 * para preservar a Property 15 (sem `staged/` órfão).
 */

import { randomUUID } from "node:crypto";

import {
    classificarMidia,
    validarGaleriaDescricao,
    validarGaleriaMidia,
    type GaleriaMime,
    type GaleriaTipo,
} from "@/domain/validation";
import { db } from "@/lib/db";

import {
    cleanupStaged,
    commitProfilePhoto,
} from "./profileMedia";
import { applyGalleryWatermark } from "./watermark";
import { createR2Client, type R2Client } from "@/lib/storage/r2";

// ---------------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------------

export type PublicarMidiaInput = {
    /** Dono da mídia (Acompanhante autenticada). */
    userId: string;
    /** MIME type informado pelo cliente HTTP. */
    mimeType: string;
    /** Bytes do arquivo. */
    bytes: Uint8Array | Buffer;
    /** Descrição opcional. Texto vazio é aceito e gravado como `null`. */
    description: string;
    /**
     * Limite de mídias do plano vigente. A função recusa publicar
     * quando o usuário já está no limite. Passar como prop evita um
     * round-trip extra (o caller já tem o plano em mãos quando
     * chama).
     */
    limiteDoPlano: number;
};

export type PublicarMidiaResult =
    | {
        ok: true;
        mediaId: string;
        storageKey: string;
        kind: GaleriaTipo;
    }
    | {
        ok: false;
        reason:
        | "MIDIA_INVALIDA"
        | "DESCRICAO_INVALIDA"
        | "LIMITE_ATINGIDO"
        | "PERSISTENCIA";
    };

/**
 * Item da galeria devolvido por {@link listarGaleria}.
 */
export type GaleriaItem = {
    id: string;
    kind: GaleriaTipo;
    storageKey: string;
    mimeType: string;
    description: string | null;
    createdAt: Date;
    likesCount: number;
    commentsCount: number;
};

// ---------------------------------------------------------------------------
// Estado interno
// ---------------------------------------------------------------------------

/**
 * Mapeia MIME válido → extensão usada na chave final em R2. Lista
 * espelha as tuplas em `@/domain/validation/galeriaMidia`.
 */
const MIME_TO_EXT: Readonly<Record<GaleriaMime, string>> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "video/quicktime": "mov",
};

let r2ClientSingleton: R2Client | null = null;

function getR2Client(): R2Client {
    if (!r2ClientSingleton) {
        r2ClientSingleton = createR2Client();
    }
    return r2ClientSingleton;
}

/**
 * Test seam, idêntico ao usado em {@link import("./profileMedia").__setR2ClientForTests}.
 */
export function __setR2ClientForGalleryTests(client: R2Client | null): void {
    r2ClientSingleton = client;
}

function buildGalleryKey(userId: string, mimeType: GaleriaMime): string {
    const ext = MIME_TO_EXT[mimeType];
    // ID único por mídia: evita colisão quando o mesmo usuário
    // publica vários arquivos do mesmo tipo.
    return `committed/${userId}/galeria/${randomUUID()}.${ext}`;
}

// ---------------------------------------------------------------------------
// Publicar
// ---------------------------------------------------------------------------

/**
 * Publica uma nova mídia na galeria do usuário.
 *
 * Veja o cabeçalho deste arquivo para o fluxo. Em caso de falha
 * pré-transação (validação), retorna sem tocar em R2. Em falha
 * pós-transação (commit em R2), a Media já está em
 * `PENDING_REPAIR` e o caller pode considerar sucesso lógico — a
 * varredura periódica conserta.
 */
export async function publicarMidia(
    input: PublicarMidiaInput,
): Promise<PublicarMidiaResult> {
    // 1. Validação canônica.
    const sizeBytes = input.bytes.byteLength;
    if (
        !validarGaleriaMidia({ mimeType: input.mimeType, sizeBytes })
    ) {
        return { ok: false, reason: "MIDIA_INVALIDA" };
    }
    if (!validarGaleriaDescricao(input.description)) {
        return { ok: false, reason: "DESCRICAO_INVALIDA" };
    }

    const tipo = classificarMidia(input.mimeType);
    if (tipo === null) {
        // `validarGaleriaMidia` já rejeitaria — defesa em profundidade.
        return { ok: false, reason: "MIDIA_INVALIDA" };
    }
    const mimeType = input.mimeType as GaleriaMime;

    // 2. Marca d'água. Tanto fotos (sharp) quanto vídeos
    // (FFmpeg) recebem o selo da marca (logo + "Privello") no
    // canto inferior direito. Erro
    // silencioso devolve o buffer original.
    const watermarked = await applyGalleryWatermark({
        bytes: input.bytes,
        mimeType,
        tipo,
    });
    const finalSize = watermarked.byteLength;

    // 3. Stage em R2.
    const stagedKey = `staged/${randomUUID()}`;
    try {
        await getR2Client().putStaged(stagedKey, watermarked, mimeType);
    } catch {
        return { ok: false, reason: "PERSISTENCIA" };
    }

    const finalKey = buildGalleryKey(input.userId, mimeType);
    const trimmedDescription = input.description.trim();

    // 4. Transação: checa limite + cria Media.
    let mediaId: string | null = null;
    try {
        mediaId = await db.$transaction(async (tx) => {
            const usadas = await tx.media.count({
                where: {
                    ownerId: input.userId,
                    role: "GALLERY",
                    status: "COMMITTED",
                },
            });
            if (usadas >= input.limiteDoPlano) {
                // Lança para forçar rollback. A `cleanupStaged`
                // do catch externo apaga o staged.
                throw new GaleriaLimiteError();
            }

            const media = await tx.media.create({
                data: {
                    ownerId: input.userId,
                    storageKey: finalKey,
                    mimeType,
                    sizeBytes: finalSize,
                    status: "COMMITTED",
                    kind: tipo === "FOTO" ? "PHOTO" : "VIDEO",
                    role: "GALLERY",
                    isProfilePhoto: false,
                    description:
                        trimmedDescription.length > 0
                            ? trimmedDescription
                            : null,
                },
                select: { id: true },
            });
            return media.id;
        });
    } catch (e) {
        await cleanupStaged(stagedKey);
        if (e instanceof GaleriaLimiteError) {
            return { ok: false, reason: "LIMITE_ATINGIDO" };
        }
        return { ok: false, reason: "PERSISTENCIA" };
    }

    if (mediaId === null) {
        // Inalcançável — `tx.media.create` retorna ou lança.
        await cleanupStaged(stagedKey);
        return { ok: false, reason: "PERSISTENCIA" };
    }

    // 5. Commit em R2 (best-effort; falha cai em PENDING_REPAIR).
    await commitProfilePhoto({
        stagedKey,
        finalKey,
        mediaId,
    });

    return {
        ok: true,
        mediaId,
        storageKey: finalKey,
        kind: tipo,
    };
}

class GaleriaLimiteError extends Error {
    constructor() {
        super("LIMITE_ATINGIDO");
        this.name = "GaleriaLimiteError";
    }
}

// ---------------------------------------------------------------------------
// Listar
// ---------------------------------------------------------------------------

/**
 * Lista todas as mídias publicadas do usuário, ordenadas por:
 *   1. `sortOrder asc` — ordem manual definida pelo dono via
 *      drag-and-drop. Default 0.
 *   2. `createdAt desc` — tiebreaker. Sem reordenação manual,
 *      ordem natural é "mais recente primeiro".
 *
 * Inclui apenas `status: COMMITTED` (sem `PENDING_REPAIR` ou
 * `DELETED`).
 */
export async function listarGaleria(
    userId: string,
): Promise<ReadonlyArray<GaleriaItem>> {
    const rows = await db.media.findMany({
        where: {
            ownerId: userId,
            role: "GALLERY",
            status: "COMMITTED",
        },
        orderBy: [
            { sortOrder: "asc" },
            { createdAt: "desc" },
        ],
        select: {
            id: true,
            kind: true,
            storageKey: true,
            mimeType: true,
            description: true,
            createdAt: true,
            likesCount: true,
            commentsCount: true,
        },
    });

    return rows.map((row) => ({
        id: row.id,
        kind: row.kind === "VIDEO" ? "VIDEO" : "FOTO",
        storageKey: row.storageKey,
        mimeType: row.mimeType,
        description: row.description,
        createdAt: row.createdAt,
        likesCount: row.likesCount,
        commentsCount: row.commentsCount,
    }));
}

/**
 * Converte um {@link GaleriaItem} (forma do banco) no shape
 * {@link import("@/components").MediaItem} consumido pelos primitivos
 * `MediaGrid`/`MediaCarousel`. A conversão é determinística e idêntica
 * entre painel (privado) e perfil público — promovida para evitar
 * duplicação.
 *
 * Resolve a `storageKey` para uma URL relativa (`/api/storage/<key>`)
 * que o route handler serve em dev (e que vira uma URL pré-assinada
 * de R2 em produção). Preenche `likes` e `comments` com os agregados
 * persistidos. O campo `liked` (per-viewer) precisa ser preenchido
 * pelo caller separadamente.
 */
export function toMediaItem(row: GaleriaItem): {
    id: string;
    type: "photo" | "video";
    url: string;
    description: string | null;
    createdAt: Date;
    likes: number;
    comments: number;
} {
    return {
        id: row.id,
        type: row.kind === "VIDEO" ? "video" : "photo",
        url: `/api/storage/${row.storageKey}`,
        description: row.description,
        createdAt: row.createdAt,
        likes: row.likesCount,
        comments: row.commentsCount,
    };
}

// ---------------------------------------------------------------------------
// Reordenar
// ---------------------------------------------------------------------------

export type ReordenarResult =
    | { ok: true; total: number }
    | {
        ok: false;
        reason: "INPUT_INVALIDO" | "ALVO_INVALIDO" | "PERSISTENCIA";
    };

/**
 * Atualiza `sortOrder` de cada mídia conforme posição em `ids`.
 * Posição 0 → menor `sortOrder` (vem primeiro).
 *
 * Validação:
 *   - `ids` não pode ser vazio nem ter duplicatas.
 *   - Todos os ids precisam pertencer ao `userId`, ter
 *     `role=GALLERY` e `status=COMMITTED`. Caller que envia ids
 *     "fantasma" recebe `ALVO_INVALIDO` — defesa contra mass-assign
 *     vindo do client.
 *   - Não exigimos que `ids` cubra toda a galeria: enviar um subset
 *     é OK (UI tipicamente envia tudo, mas o service não força).
 *     Itens fora da lista mantêm seu `sortOrder` atual e por isso
 *     ficam em posição relativa estável.
 *
 * Atualização em transação atômica — se um update falhar, a
 * ordenação inteira é revertida (consistência do produto).
 */
export async function reordenarGaleria(input: {
    userId: string;
    ids: ReadonlyArray<string>;
}): Promise<ReordenarResult> {
    if (input.ids.length === 0) {
        return { ok: false, reason: "INPUT_INVALIDO" };
    }
    const seen = new Set<string>();
    for (const id of input.ids) {
        if (typeof id !== "string" || id.length === 0) {
            return { ok: false, reason: "INPUT_INVALIDO" };
        }
        if (seen.has(id)) {
            return { ok: false, reason: "INPUT_INVALIDO" };
        }
        seen.add(id);
    }

    // Confirma que todos os ids pertencem ao dono e estão no estado
    // esperado. Em uma única query.
    const rows = await db.media.findMany({
        where: {
            id: { in: input.ids as string[] },
            ownerId: input.userId,
            role: "GALLERY",
            status: "COMMITTED",
        },
        select: { id: true },
    });
    if (rows.length !== input.ids.length) {
        return { ok: false, reason: "ALVO_INVALIDO" };
    }

    try {
        await db.$transaction(
            input.ids.map((id, index) =>
                db.media.update({
                    where: { id },
                    data: { sortOrder: index },
                }),
            ),
        );
    } catch {
        return { ok: false, reason: "PERSISTENCIA" };
    }

    return { ok: true, total: input.ids.length };
}
