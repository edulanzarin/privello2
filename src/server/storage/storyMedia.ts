/**
 * Sistema de Stories — publicação, listagem, expiração e
 * visualizações.
 *
 * Stories são mídias efêmeras (24h ativos) publicadas por
 * Acompanhante com plano que permite Stories (Premium). Aproveitam
 * o mesmo modelo `Media` da galeria, distinguindo via
 * `role = "STORY"` e usando `expiresAt` + `status` para o ciclo:
 *
 *   - **Ativo**: `status = COMMITTED` AND `expiresAt > now()`.
 *   - **Arquivado**: `status = ARCHIVED`. Está no histórico do
 *     painel privado, mantém o `likesCount` e contribui pro total
 *     de curtidas, mas não aparece publicamente nem no Reels nem
 *     no anel do avatar.
 *   - **Removido pelo dono**: `status = DELETED`. Fica até o GC do
 *     R2 apagar o arquivo. Não conta em curtidas.
 *
 * Caption: campo `description` da Media é usado como legenda curta
 * (até 50 chars). Stories são efêmeros — caption longa não faz
 * sentido.
 *
 * Fluxo:
 *   1. Validação (MIME/tamanho/caption).
 *   2. Marca d'água.
 *   3. Stage em R2.
 *   4. Transação: cria `Media(role=STORY, expires_at = now + 24h,
 *      description = caption)`.
 *   5. Pós-transação: commit em R2.
 *
 * **Não respeita** o `limiteMidias` do plano — stories são
 * efêmeros e não acumulam permanentemente. Limite de 20 ativos
 * simultâneos por Acompanhante para evitar abuso.
 */

import { randomUUID } from "node:crypto";

import {
    classificarMidia,
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
import { extractVideoPoster } from "./extractVideoPoster";
import { createR2Client, type R2Client } from "@/lib/storage/r2";

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

/** Duração de um Story em ms. 24 horas. */
const STORY_DURATION_MS = 24 * 60 * 60 * 1000;

/**
 * Limite de stories ativos simultâneos por Acompanhante. Stories não
 * gastam slot do plano (são efêmeros), mas precisam de algum teto
 * pra evitar abuso/spam de upload massivo.
 */
const STORY_LIMITE_ATIVOS = 20;

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

export function __setR2ClientForStoryTests(client: R2Client | null): void {
    r2ClientSingleton = client;
}

function buildStoryKey(userId: string, mimeType: GaleriaMime): string {
    const ext = MIME_TO_EXT[mimeType];
    return `committed/${userId}/stories/${randomUUID()}.${ext}`;
}

// ---------------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------------

/** Tamanho máximo da legenda de Story (caracteres após trim). */
export const STORY_CAPTION_MAX = 80;

export type PublicarStoryInput = {
    userId: string;
    mimeType: string;
    bytes: Uint8Array | Buffer;
    /** Legenda opcional (até 80 chars após trim). */
    caption?: string;
    /** Override de relógio para testes. */
    now?: Date;
};

export type PublicarStoryResult =
    | {
        ok: true;
        mediaId: string;
        storageKey: string;
        kind: GaleriaTipo;
        expiresAt: Date;
    }
    | {
        ok: false;
        reason:
        | "MIDIA_INVALIDA"
        | "CAPTION_INVALIDA"
        | "LIMITE_ATIVOS"
        | "PERSISTENCIA";
    };

/**
 * Item de Story devolvido pra UI.
 */
export type StoryItem = {
    id: string;
    kind: GaleriaTipo;
    storageKey: string;
    mimeType: string;
    /** Legenda curta (pode ser `null`). */
    caption: string | null;
    createdAt: Date;
    expiresAt: Date | null;
    /** `null` quando ainda ativo. Quando arquivado, é o instante. */
    archivedAt: Date | null;
    likesCount: number;
};

// ---------------------------------------------------------------------------
// Publicar
// ---------------------------------------------------------------------------

export async function publicarStory(
    input: PublicarStoryInput,
): Promise<PublicarStoryResult> {
    const sizeBytes = input.bytes.byteLength;
    if (!validarGaleriaMidia({ mimeType: input.mimeType, sizeBytes })) {
        return { ok: false, reason: "MIDIA_INVALIDA" };
    }

    // Caption: opcional, até STORY_CAPTION_MAX chars após trim.
    const caption = (input.caption ?? "").trim();
    if (caption.length > STORY_CAPTION_MAX) {
        return { ok: false, reason: "CAPTION_INVALIDA" };
    }

    const tipo = classificarMidia(input.mimeType);
    if (tipo === null) {
        return { ok: false, reason: "MIDIA_INVALIDA" };
    }
    const mimeType = input.mimeType as GaleriaMime;

    // Aplica marca d'água (mesma usada na galeria).
    const watermarked = await applyGalleryWatermark({
        bytes: input.bytes,
        mimeType,
        tipo,
        ownerId: input.userId,
    });
    const finalSize = watermarked.byteLength;

    // Stage em R2.
    const stagedKey = `staged/${randomUUID()}`;
    try {
        await getR2Client().putStaged(stagedKey, watermarked, mimeType);
    } catch {
        return { ok: false, reason: "PERSISTENCIA" };
    }

    // Poster automático pra Stories em vídeo. Best-effort —
    // sem ele o vídeo carrega preto até metadata, mas funciona.
    let posterStorageKey: string | null = null;
    let posterStagedKey: string | null = null;
    if (tipo === "VIDEO") {
        const auto = await extractVideoPoster(watermarked, mimeType);
        if (auto !== null) {
            posterStagedKey = `staged/${randomUUID()}`;
            try {
                await getR2Client().putStaged(
                    posterStagedKey,
                    auto,
                    "image/jpeg",
                );
                posterStorageKey = `committed/${input.userId}/stories/posters/${randomUUID()}.jpg`;
            } catch {
                posterStagedKey = null;
                posterStorageKey = null;
            }
        }
    }

    const finalKey = buildStoryKey(input.userId, mimeType);
    const now = input.now ?? new Date();
    const expiresAt = new Date(now.getTime() + STORY_DURATION_MS);

    let mediaId: string | null = null;
    try {
        mediaId = await db.$transaction(async (tx) => {
            // Verifica limite de ativos. Filtro replica o read.
            const ativos = await tx.media.count({
                where: {
                    ownerId: input.userId,
                    role: "STORY",
                    status: "COMMITTED",
                    expiresAt: { gt: now },
                },
            });
            if (ativos >= STORY_LIMITE_ATIVOS) {
                throw new StoryLimiteError();
            }

            const media = await tx.media.create({
                data: {
                    ownerId: input.userId,
                    storageKey: finalKey,
                    mimeType,
                    sizeBytes: finalSize,
                    status: "COMMITTED",
                    kind: tipo === "FOTO" ? "PHOTO" : "VIDEO",
                    role: "STORY",
                    isProfilePhoto: false,
                    expiresAt,
                    description: caption.length > 0 ? caption : null,
                    posterStorageKey,
                },
                select: { id: true },
            });
            return media.id;
        });
    } catch (e) {
        await cleanupStaged(stagedKey);
        if (posterStagedKey) await cleanupStaged(posterStagedKey);
        if (e instanceof StoryLimiteError) {
            return { ok: false, reason: "LIMITE_ATIVOS" };
        }
        return { ok: false, reason: "PERSISTENCIA" };
    }

    if (mediaId === null) {
        await cleanupStaged(stagedKey);
        if (posterStagedKey) await cleanupStaged(posterStagedKey);
        return { ok: false, reason: "PERSISTENCIA" };
    }

    await commitProfilePhoto({
        stagedKey,
        finalKey,
        mediaId,
    });

    // Commit do poster (best-effort — falha não invalida o story).
    if (posterStagedKey && posterStorageKey) {
        try {
            await getR2Client().commit(posterStagedKey, posterStorageKey);
        } catch {
            // sem poster é OK — o vídeo carrega preto até metadata.
        }
    }

    return {
        ok: true,
        mediaId,
        storageKey: finalKey,
        kind: tipo,
        expiresAt,
    };
}

class StoryLimiteError extends Error {
    constructor() {
        super("LIMITE_ATIVOS");
        this.name = "StoryLimiteError";
    }
}

// ---------------------------------------------------------------------------
// Listar
// ---------------------------------------------------------------------------

/**
 * Arquiva stories expirados (lazy GC). Move `status` de COMMITTED
 * para ARCHIVED quando `expiresAt <= now`. Preserva curtidas e
 * histórico para o painel privado da Acompanhante.
 *
 * Idempotente: se já está ARCHIVED, não faz nada.
 *
 * Chamado oportunisticamente pelas funções de leitura — assim
 * não precisamos de cron job separado para o fluxo principal.
 */
async function arquivarStoriesExpirados(
    userId: string,
    now: Date,
): Promise<void> {
    await db.media.updateMany({
        where: {
            ownerId: userId,
            role: "STORY",
            status: "COMMITTED",
            expiresAt: { lte: now },
        },
        data: { status: "ARCHIVED" },
    });
}

/**
 * Variante global de {@link arquivarStoriesExpirados} para um cron
 * job futuro. Sem filtro por usuário — passa por todos os stories
 * expirados de uma vez.
 */
export async function arquivarStoriesExpiradosGlobal(
    options: { now?: Date } = {},
): Promise<{ archived: number }> {
    const now = options.now ?? new Date();
    const result = await db.media.updateMany({
        where: {
            role: "STORY",
            status: "COMMITTED",
            expiresAt: { lte: now },
        },
        data: { status: "ARCHIVED" },
    });
    return { archived: result.count };
}

/**
 * Lista os stories de um usuário.
 *
 * - `filtro: "ativos"`: status COMMITTED + expires_at > now().
 * - `filtro: "arquivados"`: status ARCHIVED. Stories expirados
 *   ficam aqui pra Acompanhante ver o histórico de curtidas.
 *
 * Antes de listar `ativos`, roda lazy GC arquivando os que
 * passaram da janela.
 */
export async function listarStories(
    userId: string,
    filtro: "ativos" | "arquivados",
    options: { now?: Date } = {},
): Promise<ReadonlyArray<StoryItem>> {
    const now = options.now ?? new Date();

    // GC oportunista — só na consulta de ativos pra não causar
    // overhead em quem só quer arquivados.
    if (filtro === "ativos") {
        await arquivarStoriesExpirados(userId, now);
    }

    const where =
        filtro === "ativos"
            ? {
                ownerId: userId,
                role: "STORY" as const,
                status: "COMMITTED" as const,
                expiresAt: { gt: now },
            }
            : {
                ownerId: userId,
                role: "STORY" as const,
                status: "ARCHIVED" as const,
            };

    const rows = await db.media.findMany({
        where,
        orderBy: { createdAt: "desc" },
        select: {
            id: true,
            kind: true,
            storageKey: true,
            mimeType: true,
            description: true,
            createdAt: true,
            expiresAt: true,
            status: true,
            likesCount: true,
        },
    });

    return rows.map((row) => ({
        id: row.id,
        kind: row.kind === "VIDEO" ? "VIDEO" : "FOTO",
        storageKey: row.storageKey,
        mimeType: row.mimeType,
        caption: row.description,
        createdAt: row.createdAt,
        expiresAt: row.expiresAt,
        archivedAt: row.status === "ARCHIVED" ? (row.expiresAt ?? null) : null,
        likesCount: row.likesCount,
    }));
}

/**
 * Lista stories ativos de um usuário em formato de `MediaItem` para
 * consumo direto pelo `MediaGrid`/`MediaCarousel`. Espelha
 * `toMediaItem` do `galleryMedia.ts`. Stories não tem
 * comentários — `comments = 0`. Caption vai pra `description`.
 */
export function toMediaItem(row: StoryItem): {
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
        description: row.caption,
        createdAt: row.createdAt,
        likes: row.likesCount,
        comments: 0,
    };
}

/**
 * Lista stories ativos de **todas** as Acompanhantes visíveis. Usado
 * por uma futura linha de stories no topo da home/feed. Ordenado
 * pelos mais recentes primeiro.
 */
export async function listarStoriesPublicos(
    options: { limit?: number; now?: Date } = {},
): Promise<
    ReadonlyArray<
        StoryItem & {
            ownerIdentificador: string;
            ownerNome: string;
            ownerFotoUrl: string | null;
        }
    >
> {
    const now = options.now ?? new Date();
    const limit = Math.max(1, Math.min(200, options.limit ?? 50));

    const rows = await db.media.findMany({
        where: {
            role: "STORY",
            status: "COMMITTED",
            expiresAt: { gt: now },
            owner: {
                type: "ACOMPANHANTE",
                acompanhante: {
                    perfilVisivel: true,
                    planoVigente: { not: null },
                },
            },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        select: {
            id: true,
            kind: true,
            storageKey: true,
            mimeType: true,
            description: true,
            createdAt: true,
            expiresAt: true,
            likesCount: true,
            owner: {
                select: {
                    nome: true,
                    identificador: true,
                    acompanhante: {
                        select: {
                            fotoPerfil: { select: { storageKey: true } },
                        },
                    },
                },
            },
        },
    });

    return rows.map((row) => ({
        id: row.id,
        kind: row.kind === "VIDEO" ? "VIDEO" : "FOTO",
        storageKey: row.storageKey,
        mimeType: row.mimeType,
        caption: row.description,
        createdAt: row.createdAt,
        expiresAt: row.expiresAt,
        archivedAt: null,
        likesCount: row.likesCount,
        ownerIdentificador: row.owner.identificador,
        ownerNome: row.owner.nome,
        ownerFotoUrl:
            row.owner.acompanhante?.fotoPerfil
                ? `/api/storage/${row.owner.acompanhante.fotoPerfil.storageKey}`
                : null,
    }));
}

/**
 * Soft-delete de Story (remove antes de expirar). Apenas o dono pode.
 */
export async function excluirStory(
    userId: string,
    storyId: string,
): Promise<
    | { ok: true }
    | { ok: false; reason: "NAO_ENCONTRADO" | "PERSISTENCIA" }
> {
    let row;
    try {
        row = await db.media.findUnique({
            where: { id: storyId },
            select: { ownerId: true, role: true, status: true },
        });
    } catch {
        return { ok: false, reason: "PERSISTENCIA" };
    }

    if (!row || row.ownerId !== userId || row.role !== "STORY") {
        return { ok: false, reason: "NAO_ENCONTRADO" };
    }
    if (row.status === "DELETED") {
        return { ok: true };
    }

    try {
        await db.media.update({
            where: { id: storyId },
            data: { status: "DELETED" },
        });
    } catch {
        return { ok: false, reason: "PERSISTENCIA" };
    }
    return { ok: true };
}


// ---------------------------------------------------------------------------
// Stories públicos por usuário (perfil + visualizações)
// ---------------------------------------------------------------------------

/**
 * Lista os stories ativos de uma Acompanhante específica, ordenados
 * cronologicamente (mais antigo → mais novo) — ordem de visualização
 * típica em viewers de Stories. Usado pelo perfil público.
 *
 * Quando `viewerUserId` é fornecido, retorna também o flag `viewed`
 * (se o viewer já assistiu aquele Story) — alimenta o ring colorido
 * vs cinza no avatar.
 */
export interface StoryPublicoItem extends StoryItem {
    /**
     * `true` quando o `viewerUserId` (se fornecido) já viu este
     * Story. Anônimos sempre recebem `false`.
     */
    viewed: boolean;
    /**
     * `true` quando o `viewerUserId` já curtiu o Story. Anônimos
     * sempre recebem `false`.
     */
    liked: boolean;
}

export async function listarStoriesAtivosDoPerfil(
    ownerUserId: string,
    options: { viewerUserId?: string | null; now?: Date } = {},
): Promise<ReadonlyArray<StoryPublicoItem>> {
    const now = options.now ?? new Date();
    const viewerUserId = options.viewerUserId ?? null;

    // GC oportunista — mantém a vista pública limpa.
    await arquivarStoriesExpirados(ownerUserId, now);

    const rows = await db.media.findMany({
        where: {
            ownerId: ownerUserId,
            role: "STORY",
            status: "COMMITTED",
            expiresAt: { gt: now },
        },
        orderBy: { createdAt: "asc" },
        select: {
            id: true,
            kind: true,
            storageKey: true,
            mimeType: true,
            description: true,
            createdAt: true,
            expiresAt: true,
            likesCount: true,
        },
    });

    if (rows.length === 0) {
        return [];
    }

    const ids = rows.map((r) => r.id);

    // Lê views + likes do viewer em paralelo. Single query por
    // tabela, sem N+1.
    const [viewedSet, likedSet] = await Promise.all([
        viewerUserId !== null
            ? db.storyView
                .findMany({
                    where: {
                        userId: viewerUserId,
                        mediaId: { in: ids },
                    },
                    select: { mediaId: true },
                })
                .then((rs) => new Set(rs.map((r) => r.mediaId)))
            : Promise.resolve(new Set<string>()),
        viewerUserId !== null
            ? db.mediaLike
                .findMany({
                    where: {
                        userId: viewerUserId,
                        mediaId: { in: ids },
                    },
                    select: { mediaId: true },
                })
                .then((rs) => new Set(rs.map((r) => r.mediaId)))
            : Promise.resolve(new Set<string>()),
    ]);

    return rows.map((row) => ({
        id: row.id,
        kind: row.kind === "VIDEO" ? "VIDEO" : "FOTO",
        storageKey: row.storageKey,
        mimeType: row.mimeType,
        caption: row.description,
        createdAt: row.createdAt,
        expiresAt: row.expiresAt,
        archivedAt: null,
        likesCount: row.likesCount,
        viewed: viewedSet.has(row.id),
        liked: likedSet.has(row.id),
    }));
}

/**
 * Resumo agregado de stories ativos pra alimentar o ring do avatar
 * sem carregar todo o conteúdo. Usado quando a galeria pública não
 * abriu ainda.
 */
export interface StoryRingState {
    /** Total de stories ativos (não expirados). */
    total: number;
    /** Quantos o viewer ainda não viu. */
    naoVistos: number;
}

export async function obterStoryRingState(
    ownerUserId: string,
    options: { viewerUserId?: string | null; now?: Date } = {},
): Promise<StoryRingState> {
    const now = options.now ?? new Date();
    const viewerUserId = options.viewerUserId ?? null;

    const ativos = await db.media.findMany({
        where: {
            ownerId: ownerUserId,
            role: "STORY",
            status: "COMMITTED",
            expiresAt: { gt: now },
        },
        select: { id: true },
    });
    if (ativos.length === 0) {
        return { total: 0, naoVistos: 0 };
    }
    if (viewerUserId === null) {
        return { total: ativos.length, naoVistos: ativos.length };
    }

    const viewed = await db.storyView.count({
        where: {
            userId: viewerUserId,
            mediaId: { in: ativos.map((r) => r.id) },
        },
    });

    return {
        total: ativos.length,
        naoVistos: Math.max(0, ativos.length - viewed),
    };
}

/**
 * Marca um Story como visto pelo `viewerUserId`. Idempotente —
 * passar de novo não falha nem cria duplicata. O dono do Story
 * (`ownerUserId === viewerUserId`) NÃO conta — não registramos a
 * própria visualização.
 */
export async function marcarStoryComoVisto(
    storyId: string,
    viewerUserId: string,
): Promise<{ ok: true } | { ok: false; reason: "NAO_ENCONTRADO" }> {
    const story = await db.media.findUnique({
        where: { id: storyId },
        select: { id: true, role: true, ownerId: true, status: true },
    });
    if (!story || story.role !== "STORY") {
        return { ok: false, reason: "NAO_ENCONTRADO" };
    }
    // Próprio dono não conta como visualização.
    if (story.ownerId === viewerUserId) {
        return { ok: true };
    }
    await db.storyView
        .create({
            data: { mediaId: storyId, userId: viewerUserId },
            select: { mediaId: true },
        })
        .catch((err: { code?: string }) => {
            // P2002 = unique violation = idempotente
            if (err?.code !== "P2002") throw err;
        });
    return { ok: true };
}


// ---------------------------------------------------------------------------
// Stories agregados por cidade (tira no topo da busca)
// ---------------------------------------------------------------------------

/**
 * Resumo de uma Acompanhante com Stories ativos numa cidade.
 *
 * Não carrega o conteúdo dos stories — só o suficiente pra montar
 * a tira de avatares no topo da busca. Quando o usuário clica num
 * avatar, é redirecionado pro perfil público com `?stories=1` (que
 * dispara a abertura imediata do viewer já existente).
 */
export interface StoryOwnerResumo {
    /** Identificador público (`@username`). */
    identificador: string;
    /** Nome de exibição. */
    nome: string;
    /** Foto de perfil (URL pública via `/api/storage/...`) ou `null`. */
    fotoUrl: string | null;
    /** Total de stories ativos (≥ 1, senão não estaria na lista). */
    total: number;
    /** Quantos stories o viewer ainda não viu (anônimo: == total). */
    naoVistos: number;
    /**
     * Categoria de exibição usada pra ordenação editorial:
     *   - `"BOOST"`: boost ativo agora.
     *   - `"PREMIUM"`: plano Premium sem boost.
     *   - `"BASICO"`: plano Básico.
     * A UI não precisa diferenciar visualmente — o backend já
     * devolve a lista na ordem certa.
     */
    rank: "BOOST" | "PREMIUM" | "BASICO";
}

/**
 * Lista as Acompanhantes com **stories ativos** filtradas por
 * `(cidade, UF)`. Ordena por:
 *
 *   1. Boost ativo > Premium > Básico (rank).
 *   2. Stories não vistos > vistos (pra colocar conteúdo novo
 *      primeiro pro próprio viewer).
 *   3. Mais recente entre os stories ativos.
 *
 * Retorna no máximo `limit` itens (default 30) — a tira ocupa
 * pouco espaço visual, não faz sentido devolver dezenas.
 *
 * Quando `cidadeNome` ou `estadoSigla` forem ausentes, devolve lista
 * vazia — a tira só aparece quando o viewer escolheu uma cidade.
 */
export async function listarOwnersComStoriesPorCidade(
    options: {
        cidadeNome?: string | null;
        estadoSigla?: string | null;
        viewerUserId?: string | null;
        limit?: number;
        now?: Date;
    },
): Promise<ReadonlyArray<StoryOwnerResumo>> {
    const cidade = options.cidadeNome?.trim();
    const uf = options.estadoSigla?.trim().toUpperCase();
    if (!cidade || !uf) return [];

    const now = options.now ?? new Date();
    const viewerUserId = options.viewerUserId ?? null;
    const limit = Math.max(1, Math.min(100, options.limit ?? 30));

    // Busca todos os stories ativos da cidade já trazendo o owner +
    // perfil + foto. Uma única query — agrupamento em memória
    // (lista é pequena por natureza, no máximo 100 stories).
    const rows = await db.media.findMany({
        where: {
            role: "STORY",
            status: "COMMITTED",
            expiresAt: { gt: now },
            owner: {
                type: "ACOMPANHANTE",
                acompanhante: {
                    perfilVisivel: true,
                    planoVigente: { not: null },
                    cidadeNome: cidade,
                    estadoSigla: uf,
                },
            },
        },
        orderBy: { createdAt: "desc" },
        select: {
            id: true,
            createdAt: true,
            ownerId: true,
            owner: {
                select: {
                    nome: true,
                    identificador: true,
                    acompanhante: {
                        select: {
                            planoVigente: true,
                            boostUntil: true,
                            fotoPerfil: { select: { storageKey: true } },
                        },
                    },
                },
            },
        },
    });

    if (rows.length === 0) return [];

    // Agrupa por dono.
    const byOwner = new Map<
        string,
        {
            ownerNome: string;
            identificador: string;
            fotoUrl: string | null;
            rank: StoryOwnerResumo["rank"];
            storyIds: string[];
            mostRecent: Date;
        }
    >();

    for (const row of rows) {
        const acomp = row.owner.acompanhante;
        if (!acomp) continue;

        const isBoosted =
            acomp.boostUntil !== null && acomp.boostUntil.getTime() > now.getTime();
        const rank: StoryOwnerResumo["rank"] = isBoosted
            ? "BOOST"
            : acomp.planoVigente === "PREMIUM"
                ? "PREMIUM"
                : "BASICO";

        const existing = byOwner.get(row.ownerId);
        if (existing) {
            existing.storyIds.push(row.id);
            // mostRecent já está correto: rows vem em desc.
        } else {
            byOwner.set(row.ownerId, {
                ownerNome: row.owner.nome,
                identificador: row.owner.identificador,
                fotoUrl: acomp.fotoPerfil
                    ? `/api/storage/${acomp.fotoPerfil.storageKey}`
                    : null,
                rank,
                storyIds: [row.id],
                mostRecent: row.createdAt,
            });
        }
    }

    // Conta visualizações do viewer numa única query.
    let viewedSet = new Set<string>();
    if (viewerUserId !== null) {
        const allStoryIds = Array.from(byOwner.values()).flatMap(
            (o) => o.storyIds,
        );
        if (allStoryIds.length > 0) {
            const viewedRows = await db.storyView.findMany({
                where: {
                    userId: viewerUserId,
                    mediaId: { in: allStoryIds },
                },
                select: { mediaId: true },
            });
            viewedSet = new Set(viewedRows.map((r) => r.mediaId));
        }
    }

    // Monta os resumos e ordena.
    const RANK_WEIGHT: Record<StoryOwnerResumo["rank"], number> = {
        BOOST: 3,
        PREMIUM: 2,
        BASICO: 1,
    };

    const list: StoryOwnerResumo[] = Array.from(byOwner.entries()).map(
        ([_userId, info]) => {
            const naoVistos = info.storyIds.filter((id) => !viewedSet.has(id))
                .length;
            return {
                identificador: info.identificador,
                nome: info.ownerNome,
                fotoUrl: info.fotoUrl,
                total: info.storyIds.length,
                naoVistos,
                rank: info.rank,
            };
        },
    );

    list.sort((a, b) => {
        // 1. rank desc.
        const ra = RANK_WEIGHT[a.rank];
        const rb = RANK_WEIGHT[b.rank];
        if (ra !== rb) return rb - ra;
        // 2. não-vistos primeiro.
        const av = a.naoVistos > 0 ? 1 : 0;
        const bv = b.naoVistos > 0 ? 1 : 0;
        if (av !== bv) return bv - av;
        // 3. estável pelo identificador (consistência).
        return a.identificador.localeCompare(b.identificador);
    });

    return list.slice(0, limit);
}


// ---------------------------------------------------------------------------
// Stories agregados por cidade — formato achatado (consumo do viewer)
// ---------------------------------------------------------------------------

/**
 * Story de uma Acompanhante específica numa cidade, no shape direto
 * pra alimentar o `MediaCarousel` em `storyMode`.
 *
 * Difere do {@link StoryPublicoItem} por carregar campos de owner
 * (avatar/identificador/nome) — necessários quando o carrossel
 * passa por stories de várias Acompanhantes em sequência.
 */
export interface StoryAgregadoItem {
    /** ID do Story (Media). */
    id: string;
    /** `"FOTO"` ou `"VIDEO"`. */
    kind: GaleriaTipo;
    storageKey: string;
    mimeType: string;
    caption: string | null;
    createdAt: Date;
    likesCount: number;
    /** `true` quando o `viewerUserId` (se fornecido) já viu. */
    viewed: boolean;
    /** `true` quando o `viewerUserId` (se fornecido) já curtiu. */
    liked: boolean;
    /** Identificador público (slug `@`) do dono. */
    ownerIdentificador: string;
    /** Nome de exibição do dono. */
    ownerNome: string;
    /** URL da foto de perfil do dono ou `null`. */
    ownerFotoUrl: string | null;
}

/**
 * Lista *todos* os stories ativos de uma cidade, agrupados por
 * dono e ordenados por:
 *
 *   1. Boost ativo > Premium > Básico (rank do dono).
 *   2. Não-vistos antes dos vistos (ao nível do dono).
 *   3. Identificador (estabilidade visual).
 *   4. Stories internos do dono em ordem cronológica (mais antigo →
 *      mais novo) — ordem de visualização típica de Stories.
 *
 * Retorna também o resumo `owners` pra alimentar a tira de
 * avatares (mesma ordem). É **uma única** query no banco — caller
 * que já sabia montar a tira pode descartar `stories`, e quem
 * abrir o carousel pode usar `stories` direto.
 *
 * Quando `cidadeNome`/`estadoSigla` estão ausentes, devolve listas
 * vazias.
 */
export interface StoriesAgregadosPorCidade {
    /** Resumo por dono pra alimentar a tira de avatares. */
    owners: ReadonlyArray<StoryOwnerResumo>;
    /**
     * Lista achatada de stories — Owner1.story1, Owner1.story2,
     * Owner2.story1, ...
     */
    stories: ReadonlyArray<StoryAgregadoItem>;
}

export async function listarStoriesAgregadosPorCidade(
    options: {
        cidadeNome?: string | null;
        estadoSigla?: string | null;
        viewerUserId?: string | null;
        now?: Date;
        ownerLimit?: number;
    },
): Promise<StoriesAgregadosPorCidade> {
    const cidade = options.cidadeNome?.trim();
    const uf = options.estadoSigla?.trim().toUpperCase();
    if (!cidade || !uf) return { owners: [], stories: [] };

    const now = options.now ?? new Date();
    const viewerUserId = options.viewerUserId ?? null;
    const ownerLimit = Math.max(1, Math.min(100, options.ownerLimit ?? 30));

    // Pega todos os stories ativos da cidade junto com info de
    // owner. Ordem por createdAt asc dá a "ordem de visualização"
    // dentro de cada owner ao agrupar.
    const rows = await db.media.findMany({
        where: {
            role: "STORY",
            status: "COMMITTED",
            expiresAt: { gt: now },
            owner: {
                type: "ACOMPANHANTE",
                acompanhante: {
                    perfilVisivel: true,
                    planoVigente: { not: null },
                    cidadeNome: cidade,
                    estadoSigla: uf,
                },
            },
        },
        orderBy: { createdAt: "asc" },
        select: {
            id: true,
            kind: true,
            storageKey: true,
            mimeType: true,
            description: true,
            createdAt: true,
            likesCount: true,
            ownerId: true,
            owner: {
                select: {
                    nome: true,
                    identificador: true,
                    acompanhante: {
                        select: {
                            planoVigente: true,
                            boostUntil: true,
                            fotoPerfil: { select: { storageKey: true } },
                        },
                    },
                },
            },
        },
    });

    if (rows.length === 0) return { owners: [], stories: [] };

    const ids = rows.map((r) => r.id);

    // Lê views + likes do viewer numa única query por tabela.
    const [viewedSet, likedSet] = await Promise.all([
        viewerUserId !== null
            ? db.storyView
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

    // Agrupa por owner, mantendo cada bucket em ordem cronológica
    // (rows já vem em asc).
    interface OwnerBucket {
        ownerId: string;
        ownerNome: string;
        identificador: string;
        fotoUrl: string | null;
        rank: StoryOwnerResumo["rank"];
        stories: StoryAgregadoItem[];
        unseen: number;
    }

    const buckets = new Map<string, OwnerBucket>();

    for (const row of rows) {
        const acomp = row.owner.acompanhante;
        if (!acomp) continue;

        const isBoosted =
            acomp.boostUntil !== null && acomp.boostUntil.getTime() > now.getTime();
        const rank: StoryOwnerResumo["rank"] = isBoosted
            ? "BOOST"
            : acomp.planoVigente === "PREMIUM"
                ? "PREMIUM"
                : "BASICO";

        let bucket = buckets.get(row.ownerId);
        if (!bucket) {
            bucket = {
                ownerId: row.ownerId,
                ownerNome: row.owner.nome,
                identificador: row.owner.identificador,
                fotoUrl: acomp.fotoPerfil
                    ? `/api/storage/${acomp.fotoPerfil.storageKey}`
                    : null,
                rank,
                stories: [],
                unseen: 0,
            };
            buckets.set(row.ownerId, bucket);
        }

        const viewed = viewedSet.has(row.id);
        const liked = likedSet.has(row.id);
        bucket.stories.push({
            id: row.id,
            kind: row.kind === "VIDEO" ? "VIDEO" : "FOTO",
            storageKey: row.storageKey,
            mimeType: row.mimeType,
            caption: row.description,
            createdAt: row.createdAt,
            likesCount: row.likesCount,
            viewed,
            liked,
            ownerIdentificador: bucket.identificador,
            ownerNome: bucket.ownerNome,
            ownerFotoUrl: bucket.fotoUrl,
        });
        if (!viewed) bucket.unseen += 1;
    }

    // Ordena os buckets:
    //   1. rank desc;
    //   2. unseen > 0 antes;
    //   3. identificador asc (estabilidade).
    const RANK_WEIGHT: Record<StoryOwnerResumo["rank"], number> = {
        BOOST: 3,
        PREMIUM: 2,
        BASICO: 1,
    };
    const sortedBuckets = Array.from(buckets.values())
        .sort((a, b) => {
            const ra = RANK_WEIGHT[a.rank];
            const rb = RANK_WEIGHT[b.rank];
            if (ra !== rb) return rb - ra;
            const av = a.unseen > 0 ? 1 : 0;
            const bv = b.unseen > 0 ? 1 : 0;
            if (av !== bv) return bv - av;
            return a.identificador.localeCompare(b.identificador);
        })
        .slice(0, ownerLimit);

    const owners: StoryOwnerResumo[] = sortedBuckets.map((b) => ({
        identificador: b.identificador,
        nome: b.ownerNome,
        fotoUrl: b.fotoUrl,
        total: b.stories.length,
        naoVistos: b.unseen,
        rank: b.rank,
    }));

    const stories: StoryAgregadoItem[] = sortedBuckets.flatMap(
        (b) => b.stories,
    );

    return { owners, stories };
}
