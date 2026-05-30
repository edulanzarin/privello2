/**
 * Sistema de Reels — vídeos curtos verticais públicos.
 *
 * Reels são uma rede social paralela à Privello: feed vertical
 * algorítmico em `/reels`. Diferente de Stories (efêmeros, 24h),
 * Reels são **permanentes** até a Acompanhante deletar.
 *
 * Cada Reel é uma `Media` com `role = "REEL"`:
 *
 *   - **Ativo**: `status = COMMITTED`. Aparece no feed.
 *   - **Removido pelo dono**: `status = DELETED`. Sai do feed
 *     imediatamente; arquivo no R2 é apagado pelo GC.
 *
 * Caption: até `REEL_CAPTION_MAX` chars (descrição/hashtags etc).
 *
 * Quem publica:
 *   - Acompanhantes Básico até 20 ativos (`Plano.limiteReels`).
 *   - Acompanhantes Premium ilimitado.
 *
 * Algoritmo do feed: ver {@link listarFeedReels}.
 *
 * Quota de visualizações:
 *   - Anônimos e Cliente Grátis: limite de 5 reels nas últimas 24h.
 *   - Cliente Fan e Acompanhantes: ilimitado.
 *
 * O frontend decide quando bloquear baseado em `obterQuotaReels`.
 * O backend confirma no `incrementarViewReel` — defesa em profundidade.
 */

import { randomUUID } from "node:crypto";

import {
    classificarMidia,
    validarGaleriaMidia,
    type GaleriaMime,
} from "@/domain/validation";
import { getPlanoDefinition, type PlanoTipo } from "@/domain/plano/definitions";
import { db } from "@/lib/db";

import { applyGalleryWatermark } from "./watermark";
import { cleanupStaged, commitProfilePhoto } from "./profileMedia";
import { extractVideoPoster } from "./extractVideoPoster";
import { createR2Client, type R2Client } from "@/lib/storage/r2";

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

/** Máximo de caracteres da legenda. */
export const REEL_CAPTION_MAX = 200;

/** Duração mínima e máxima de Reel (segundos). */
export const REEL_DURATION_MIN = 5;
export const REEL_DURATION_MAX = 90;

/**
 * Quota diária pra anônimos e Cliente Grátis: 5 Reels visualizados
 * em janela de 24h. Após isso, frontend mostra paywall convidando
 * a criar conta + virar Fan. Backend rejeita com 402.
 */
export const REEL_QUOTA_GRATIS_24H = 5;

/** Janela do quota lookup. */
const QUOTA_WINDOW_MS = 24 * 60 * 60 * 1000;

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

export function __setR2ClientForReelTests(client: R2Client | null): void {
    r2ClientSingleton = client;
}

function buildReelKey(userId: string, mimeType: GaleriaMime): string {
    const ext = MIME_TO_EXT[mimeType];
    return `committed/${userId}/reels/${randomUUID()}.${ext}`;
}

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export type PublicarReelInput = {
    userId: string;
    plano: PlanoTipo;
    mimeType: string;
    bytes: Buffer | Uint8Array;
    /** Duração informada pelo cliente (validada server-side). */
    durationSeconds: number;
    /** Capa estática (primeiro frame). Opcional — sem capa o
     *  navegador mostra primeiro frame ao carregar. */
    posterBytes?: Buffer | Uint8Array;
    posterMimeType?: string;
    caption?: string | null;
    now?: Date;
};

export type PublicarReelResult =
    | {
        ok: true;
        media: { id: string; storageKey: string; createdAt: Date };
    }
    | {
        ok: false;
        reason:
            | "MIDIA_INVALIDA"
            | "CAPTION_INVALIDA"
            | "DURACAO_INVALIDA"
            | "PLANO_NAO_PERMITE"
            | "LIMITE_ATIVOS"
            | "PERSISTENCIA";
    };

class ReelLimiteError extends Error {}

// ---------------------------------------------------------------------------
// Publicar
// ---------------------------------------------------------------------------

export async function publicarReel(
    input: PublicarReelInput,
): Promise<PublicarReelResult> {
    const planoDef = getPlanoDefinition(input.plano);
    if (!planoDef.permiteReels) {
        return { ok: false, reason: "PLANO_NAO_PERMITE" };
    }

    const sizeBytes = input.bytes.byteLength;
    if (!validarGaleriaMidia({ mimeType: input.mimeType, sizeBytes })) {
        return { ok: false, reason: "MIDIA_INVALIDA" };
    }

    const tipo = classificarMidia(input.mimeType);
    if (tipo !== "VIDEO") {
        // Reels é só vídeo.
        return { ok: false, reason: "MIDIA_INVALIDA" };
    }
    const mimeType = input.mimeType as GaleriaMime;

    const duration = Math.floor(input.durationSeconds);
    if (
        !Number.isFinite(duration) ||
        duration < REEL_DURATION_MIN ||
        duration > REEL_DURATION_MAX
    ) {
        return { ok: false, reason: "DURACAO_INVALIDA" };
    }

    const caption = (input.caption ?? "").trim();
    if (caption.length > REEL_CAPTION_MAX) {
        return { ok: false, reason: "CAPTION_INVALIDA" };
    }

    // Watermark (mesmo pipeline da galeria — coloca o logo no canto).
    const watermarked = await applyGalleryWatermark({
        bytes: input.bytes,
        mimeType,
        tipo,
    });
    const finalSize = watermarked.byteLength;

    const stagedKey = `staged/${randomUUID()}`;
    try {
        await getR2Client().putStaged(stagedKey, watermarked, mimeType);
    } catch {
        return { ok: false, reason: "PERSISTENCIA" };
    }

    // Poster opcional — se foi fornecido pelo cliente, usa esse.
    // Caso contrário, gera automaticamente extraindo um frame
    // do vídeo com FFmpeg (~0.5s). Em qualquer falha cai no path
    // sem poster (vídeo carrega preto até metadata, mas funciona).
    let posterStorageKey: string | null = null;
    let posterStagedKey: string | null = null;
    let posterBytesFinal: Buffer | null = null;
    let posterMimeFinal: "image/jpeg" | "image/png" | null = null;

    if (
        input.posterBytes !== undefined &&
        typeof input.posterMimeType === "string" &&
        (input.posterMimeType === "image/jpeg" ||
            input.posterMimeType === "image/png")
    ) {
        posterBytesFinal = Buffer.isBuffer(input.posterBytes)
            ? input.posterBytes
            : Buffer.from(input.posterBytes);
        posterMimeFinal = input.posterMimeType as "image/jpeg" | "image/png";
    } else {
        // Auto-gera poster via FFmpeg quando o caller não enviou.
        const auto = await extractVideoPoster(watermarked, mimeType);
        if (auto !== null) {
            posterBytesFinal = auto;
            posterMimeFinal = "image/jpeg";
        }
    }

    if (posterBytesFinal && posterMimeFinal) {
        posterStagedKey = `staged/${randomUUID()}`;
        try {
            await getR2Client().putStaged(
                posterStagedKey,
                posterBytesFinal,
                posterMimeFinal,
            );
            posterStorageKey = `committed/${input.userId}/reels/posters/${randomUUID()}.${
                posterMimeFinal === "image/jpeg" ? "jpg" : "png"
            }`;
        } catch {
            // Poster é melhor-esforço — sem ele o player ainda
            // funciona.
            posterStagedKey = null;
            posterStorageKey = null;
        }
    }

    const finalKey = buildReelKey(input.userId, mimeType);
    const now = input.now ?? new Date();

    let mediaId: string | null = null;
    try {
        mediaId = await db.$transaction(async (tx) => {
            // Limite por plano. Conta ativos — DELETED não conta.
            if (planoDef.limiteReels !== Number.POSITIVE_INFINITY) {
                const ativos = await tx.media.count({
                    where: {
                        ownerId: input.userId,
                        role: "REEL",
                        status: "COMMITTED",
                    },
                });
                if (ativos >= planoDef.limiteReels) {
                    throw new ReelLimiteError();
                }
            }

            const media = await tx.media.create({
                data: {
                    ownerId: input.userId,
                    storageKey: finalKey,
                    mimeType,
                    sizeBytes: finalSize,
                    status: "COMMITTED",
                    kind: "VIDEO",
                    role: "REEL",
                    isProfilePhoto: false,
                    description: caption.length > 0 ? caption : null,
                    durationSeconds: duration,
                    posterStorageKey,
                },
                select: { id: true, createdAt: true },
            });
            return media.id;
        });
    } catch (e) {
        await cleanupStaged(stagedKey);
        if (posterStagedKey) await cleanupStaged(posterStagedKey);
        if (e instanceof ReelLimiteError) {
            return { ok: false, reason: "LIMITE_ATIVOS" };
        }
        return { ok: false, reason: "PERSISTENCIA" };
    }

    if (mediaId === null) {
        await cleanupStaged(stagedKey);
        if (posterStagedKey) await cleanupStaged(posterStagedKey);
        return { ok: false, reason: "PERSISTENCIA" };
    }

    // Commit do vídeo principal.
    await commitProfilePhoto({
        stagedKey,
        finalKey,
        mediaId,
    });

    // Commit do poster (best-effort — falha não invalida o reel).
    if (posterStagedKey && posterStorageKey) {
        try {
            await getR2Client().commit(posterStagedKey, posterStorageKey);
        } catch {
            // sem poster é OK
        }
    }

    const created = await db.media.findUnique({
        where: { id: mediaId },
        select: { id: true, storageKey: true, createdAt: true },
    });
    if (!created) {
        return { ok: false, reason: "PERSISTENCIA" };
    }

    return {
        ok: true,
        media: {
            id: created.id,
            storageKey: created.storageKey,
            createdAt: created.createdAt,
        },
    };
}

// ---------------------------------------------------------------------------
// Excluir (soft delete)
// ---------------------------------------------------------------------------

export type ExcluirReelResult =
    | { ok: true }
    | { ok: false; reason: "NAO_ENCONTRADO" | "PERSISTENCIA" };

export async function excluirReel(
    userId: string,
    reelId: string,
): Promise<ExcluirReelResult> {
    let row;
    try {
        row = await db.media.findUnique({
            where: { id: reelId },
            select: { ownerId: true, role: true, status: true },
        });
    } catch {
        return { ok: false, reason: "PERSISTENCIA" };
    }

    if (!row || row.ownerId !== userId || row.role !== "REEL") {
        return { ok: false, reason: "NAO_ENCONTRADO" };
    }
    if (row.status === "DELETED") {
        return { ok: true };
    }

    try {
        await db.media.update({
            where: { id: reelId },
            data: { status: "DELETED" },
        });
    } catch {
        return { ok: false, reason: "PERSISTENCIA" };
    }
    return { ok: true };
}

// ---------------------------------------------------------------------------
// Quota diária
// ---------------------------------------------------------------------------

export interface QuotaReels {
    /** `true` quando o viewer não tem limite (Fan ou Acompanhante). */
    ilimitado: boolean;
    /**
     * Quantas visualizações o viewer já consumiu na janela de 24h.
     * Sempre `0` quando `ilimitado: true`.
     */
    consumidas: number;
    /**
     * Limite total da janela. `Infinity` quando ilimitado.
     */
    limite: number;
    /**
     * Quantas restam. `Infinity` quando ilimitado.
     */
    restantes: number;
}

/**
 * Calcula a quota de visualizações de Reel pra um viewer.
 *
 * - Anônimo: pode ver até `REEL_QUOTA_GRATIS_24H` reels em qualquer
 *   janela de 24h (mas anônimo nem chega aqui — backend exige
 *   sessão pra contar). Frontend trata anônimo como
 *   `consumidas = limite` (paywall imediato? Não — anônimo vê 5
 *   livre via cookie de fingerprint? Nesse MVP, anônimo conta como
 *   "ilimitado" mas frontend mostra prompt suave de cadastro
 *   após 5 — depois trocamos por persistência por cookie). Quem
 *   chama esta função pra anônimos recebe limite zero.
 * - Cliente Grátis (logado): conta `ReelView` últimas 24h.
 * - Cliente Fan ativo / Acompanhante: ilimitado.
 */
export async function obterQuotaReels(
    viewerUserId: string | null,
    options: {
        viewerType?: "CLIENTE" | "ACOMPANHANTE" | null;
        clientePlano?: "GRATIS" | "FAN" | null;
        now?: Date;
    } = {},
): Promise<QuotaReels> {
    const tipoViewer = options.viewerType ?? null;
    const plano = options.clientePlano ?? null;

    // Acompanhante e Fan: sem limite.
    if (
        tipoViewer === "ACOMPANHANTE" ||
        (tipoViewer === "CLIENTE" && plano === "FAN")
    ) {
        return {
            ilimitado: true,
            consumidas: 0,
            limite: Number.POSITIVE_INFINITY,
            restantes: Number.POSITIVE_INFINITY,
        };
    }

    // Anônimo (sem userId): tratamos como Grátis "novo" — caller
    // costuma rastrear via cookie. Aqui retornamos limite cheio
    // sem contagem (caller decide).
    if (viewerUserId === null) {
        return {
            ilimitado: false,
            consumidas: 0,
            limite: REEL_QUOTA_GRATIS_24H,
            restantes: REEL_QUOTA_GRATIS_24H,
        };
    }

    const now = options.now ?? new Date();
    const since = new Date(now.getTime() - QUOTA_WINDOW_MS);

    const consumidas = await db.reelView.count({
        where: { userId: viewerUserId, viewedAt: { gte: since } },
    });

    return {
        ilimitado: false,
        consumidas,
        limite: REEL_QUOTA_GRATIS_24H,
        restantes: Math.max(0, REEL_QUOTA_GRATIS_24H - consumidas),
    };
}

/**
 * Marca um Reel como visto pelo `viewerUserId`. Idempotente — passar
 * de novo não cria duplicata. O dono do Reel não conta.
 *
 * Aplica regra de quota: se o viewer é anônimo/Grátis e já consumiu
 * `REEL_QUOTA_GRATIS_24H` na janela, retorna `quotaEstourada` —
 * frontend mostra paywall. Backend ainda registra a view (pra que
 * a próxima requisição também seja bloqueada).
 */
export type MarcarReelVistoResult =
    | { ok: true; quotaEstourada: false }
    | { ok: true; quotaEstourada: true }
    | { ok: false; reason: "NAO_ENCONTRADO" };

export async function marcarReelComoVisto(
    reelId: string,
    viewerUserId: string,
    options: {
        viewerType: "CLIENTE" | "ACOMPANHANTE";
        clientePlano: "GRATIS" | "FAN" | null;
        now?: Date;
    },
): Promise<MarcarReelVistoResult> {
    const reel = await db.media.findUnique({
        where: { id: reelId },
        select: { id: true, role: true, ownerId: true, status: true },
    });
    if (!reel || reel.role !== "REEL" || reel.status !== "COMMITTED") {
        return { ok: false, reason: "NAO_ENCONTRADO" };
    }
    // Próprio dono não conta.
    if (reel.ownerId === viewerUserId) {
        return { ok: true, quotaEstourada: false };
    }

    // Quota check antes de gravar.
    const quota = await obterQuotaReels(viewerUserId, {
        viewerType: options.viewerType,
        clientePlano: options.clientePlano,
        now: options.now,
    });

    // Cria registro idempotente.
    await db.reelView
        .create({
            data: { mediaId: reelId, userId: viewerUserId },
            select: { mediaId: true },
        })
        .catch((err: { code?: string }) => {
            if (err?.code !== "P2002") throw err;
        });

    if (!quota.ilimitado && quota.restantes <= 0) {
        return { ok: true, quotaEstourada: true };
    }

    return { ok: true, quotaEstourada: false };
}

// ---------------------------------------------------------------------------
// Feed algorítmico
// ---------------------------------------------------------------------------

/**
 * Item de Reel devolvido pelo feed.
 */
export interface FeedReelItem {
    id: string;
    storageKey: string;
    mimeType: string;
    durationSeconds: number | null;
    posterStorageKey: string | null;
    caption: string | null;
    createdAt: Date;
    likesCount: number;
    commentsCount: number;
    /** `true` quando o `viewerUserId` (se fornecido) já viu. */
    viewed: boolean;
    /** `true` quando o `viewerUserId` (se fornecido) já curtiu. */
    liked: boolean;
    owner: {
        identificador: string;
        nome: string;
        fotoUrl: string | null;
        cidadeNome: string;
        estadoSigla: string;
    };
}

export interface ListarFeedReelsInput {
    /** ID do viewer pra evitar repetir já-vistos. `null` = anônimo. */
    viewerUserId?: string | null;
    /** Localização preferida — UF prioriza match exato. */
    estadoSigla?: string | null;
    cidadeNome?: string | null;
    /** Tamanho da página. Padrão 10. */
    limit?: number;
    /** Cursor opaco da paginação (ID do último Reel da página). */
    cursorReelId?: string | null;
    /** Override do relógio. */
    now?: Date;
}

export interface ListarFeedReelsResult {
    items: ReadonlyArray<FeedReelItem>;
    /** Cursor pra próxima página, `null` quando acabou. */
    nextCursor: string | null;
}

/**
 * Algoritmo do feed de Reels — versão MVP.
 *
 * Ranking determinístico (sem ML, mas robusto pra começar):
 *
 *   1. **Match de cidade** — Reels na mesma cidade do viewer
 *      pesam +30. Reels na mesma UF, +10. Resto +0.
 *   2. **Plano do dono** — Premium +20. Boost ativo +30.
 *   3. **Frescor** — quanto mais novo, maior. Decai exponencial:
 *      `points += 50 * exp(-ageDays / 7)`.
 *   4. **Popularidade** — `likes + comments` pesa +0.5 por interação.
 *   5. **Não-vistos** — Reels que o viewer ainda não viu ganham
 *      +40 (forte preferência).
 *
 * Soma os pontos de cada Reel candidato (top 200 mais recentes
 * com perfil ativo) e ordena por score desc, paginando por slot
 * de cursor opaco.
 *
 * Performance: a query inicial usa o índice parcial
 * `idx_medias_reels_active`. Computação do ranking é em memória
 * sobre 200 itens — barato. Quando crescer pra milhões, vira job
 * batch + tabela de ranking pré-computada.
 */
export async function listarFeedReels(
    input: ListarFeedReelsInput,
): Promise<ListarFeedReelsResult> {
    const limit = Math.max(1, Math.min(50, input.limit ?? 10));
    const now = input.now ?? new Date();
    const viewerUserId = input.viewerUserId ?? null;
    const cidadeViewer = input.cidadeNome?.trim() ?? null;
    const ufViewer = input.estadoSigla?.trim().toUpperCase() ?? null;

    // Pega top 200 Reels recentes com dono visível e plano ativo.
    const candidatos = await db.media.findMany({
        where: {
            role: "REEL",
            status: "COMMITTED",
            owner: {
                type: "ACOMPANHANTE",
                acompanhante: {
                    perfilVisivel: true,
                    planoVigente: { not: null },
                },
            },
        },
        orderBy: { createdAt: "desc" },
        take: 200,
        select: {
            id: true,
            storageKey: true,
            mimeType: true,
            durationSeconds: true,
            posterStorageKey: true,
            description: true,
            createdAt: true,
            likesCount: true,
            commentsCount: true,
            ownerId: true,
            owner: {
                select: {
                    nome: true,
                    identificador: true,
                    acompanhante: {
                        select: {
                            planoVigente: true,
                            boostUntil: true,
                            cidadeNome: true,
                            estadoSigla: true,
                            fotoPerfil: { select: { storageKey: true } },
                        },
                    },
                },
            },
        },
    });

    if (candidatos.length === 0) {
        return { items: [], nextCursor: null };
    }

    const ids = candidatos.map((c) => c.id);

    // Lê views + likes do viewer numa única query por tabela.
    const [viewedSet, likedSet] = await Promise.all([
        viewerUserId !== null
            ? db.reelView
                .findMany({
                    where: { userId: viewerUserId, mediaId: { in: ids } },
                    select: { mediaId: true },
                })
                .then((rs) => new Set(rs.map((r) => r.mediaId)))
            : Promise.resolve(new Set<string>()),
        viewerUserId !== null
            ? db.mediaLike
                .findMany({
                    where: { userId: viewerUserId, mediaId: { in: ids } },
                    select: { mediaId: true },
                })
                .then((rs) => new Set(rs.map((r) => r.mediaId)))
            : Promise.resolve(new Set<string>()),
    ]);

    // Score de cada candidato.
    interface Scored {
        id: string;
        score: number;
        item: FeedReelItem;
    }

    const scored: Scored[] = candidatos.map((c) => {
        const acomp = c.owner.acompanhante;
        const cidadeOwner = acomp?.cidadeNome ?? "";
        const ufOwner = acomp?.estadoSigla ?? "";

        let score = 0;

        // 1) Match de cidade.
        if (
            cidadeViewer &&
            ufViewer &&
            cidadeOwner === cidadeViewer &&
            ufOwner === ufViewer
        ) {
            score += 30;
        } else if (ufViewer && ufOwner === ufViewer) {
            score += 10;
        }

        // 2) Plano e boost do dono.
        const isBoosted =
            acomp?.boostUntil !== null &&
            acomp?.boostUntil !== undefined &&
            acomp.boostUntil.getTime() > now.getTime();
        if (isBoosted) score += 30;
        if (acomp?.planoVigente === "PREMIUM") score += 20;

        // 3) Frescor (exp decay com half-life ~7 dias).
        const ageMs = now.getTime() - c.createdAt.getTime();
        const ageDays = Math.max(0, ageMs / (24 * 60 * 60 * 1000));
        score += 50 * Math.exp(-ageDays / 7);

        // 4) Popularidade.
        score += (c.likesCount + c.commentsCount) * 0.5;

        // 5) Não vistos primeiro.
        const viewed = viewedSet.has(c.id);
        if (!viewed && viewerUserId !== null) score += 40;

        return {
            id: c.id,
            score,
            item: {
                id: c.id,
                storageKey: c.storageKey,
                mimeType: c.mimeType,
                durationSeconds: c.durationSeconds,
                posterStorageKey: c.posterStorageKey,
                caption: c.description,
                createdAt: c.createdAt,
                likesCount: c.likesCount,
                commentsCount: c.commentsCount,
                viewed,
                liked: likedSet.has(c.id),
                owner: {
                    identificador: c.owner.identificador,
                    nome: c.owner.nome,
                    fotoUrl: acomp?.fotoPerfil
                        ? `/api/storage/${acomp.fotoPerfil.storageKey}`
                        : null,
                    cidadeNome: cidadeOwner,
                    estadoSigla: ufOwner,
                },
            },
        };
    });

    // Ordena por score desc com randomização leve pra evitar que
    // o mesmo reel fique sempre no topo (determinismo puro = feed
    // estático). Adiciona jitter de ±5 pontos ao score antes de
    // ordenar — suficiente pra variar a ordem entre reels com
    // scores próximos sem destruir a relevância.
    const jittered = scored.map((s) => ({
        ...s,
        jitteredScore: s.score + (Math.random() * 10 - 5),
    }));
    jittered.sort((a, b) => {
        // Não-vistos SEMPRE antes dos vistos (hard partition).
        const aUnseen = !a.item.viewed ? 1 : 0;
        const bUnseen = !b.item.viewed ? 1 : 0;
        if (aUnseen !== bUnseen) return bUnseen - aUnseen;
        // Dentro de cada partição, ordena por score + jitter.
        return b.jitteredScore - a.jitteredScore;
    });
    // Reatribui ao array original pra manter o tipo.
    const sorted = jittered as typeof scored;

    // Aplica cursor: pula até passar do `cursorReelId`.
    let startIdx = 0;
    if (input.cursorReelId) {
        const idx = sorted.findIndex((s) => s.id === input.cursorReelId);
        if (idx >= 0) startIdx = idx + 1;
    }

    const slice = sorted.slice(startIdx, startIdx + limit);
    const nextCursor =
        startIdx + limit < sorted.length
            ? slice[slice.length - 1]?.id ?? null
            : null;

    return {
        items: slice.map((s) => s.item),
        nextCursor,
    };
}

// ---------------------------------------------------------------------------
// Listar do dono (painel da Acompanhante)
// ---------------------------------------------------------------------------

export interface ReelDoOwner {
    id: string;
    storageKey: string;
    mimeType: string;
    durationSeconds: number | null;
    posterStorageKey: string | null;
    caption: string | null;
    createdAt: Date;
    likesCount: number;
    commentsCount: number;
}

/**
 * Lista os Reels publicados por um dono específico — mais novos
 * primeiro. Usado pelo painel da Acompanhante.
 */
export async function listarReelsDoDono(
    ownerUserId: string,
): Promise<ReadonlyArray<ReelDoOwner>> {
    const rows = await db.media.findMany({
        where: {
            ownerId: ownerUserId,
            role: "REEL",
            status: "COMMITTED",
        },
        orderBy: { createdAt: "desc" },
        select: {
            id: true,
            storageKey: true,
            mimeType: true,
            durationSeconds: true,
            posterStorageKey: true,
            description: true,
            createdAt: true,
            likesCount: true,
            commentsCount: true,
        },
    });

    return rows.map((row) => ({
        id: row.id,
        storageKey: row.storageKey,
        mimeType: row.mimeType,
        durationSeconds: row.durationSeconds,
        posterStorageKey: row.posterStorageKey,
        caption: row.description,
        createdAt: row.createdAt,
        likesCount: row.likesCount,
        commentsCount: row.commentsCount,
    }));
}
