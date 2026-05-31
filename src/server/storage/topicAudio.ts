/**
 * TopicAudio — áudios curtos respondendo perguntas comuns.
 *
 * Acompanhante grava ≤30s por tópico (Preço, Casal, Disponibilidade
 * etc.). Aparecem como FAQ sonora no perfil público. Reusa
 * `Media` com `role=TOPIC_AUDIO` + nova coluna `topicKind`. Cada
 * dono pode ter no máximo 1 áudio ativo por tópico — gravar
 * novamente substitui o anterior (marca como DELETED).
 *
 * # Diferença pro Áudio_de_Apresentação
 *
 * - **Apresentação** (`role=AUDIO`): único, ≤60s, free-form, slot
 *   no `acompanhante_profiles.audio_apresentacao_id`.
 * - **TopicAudio** (`role=TOPIC_AUDIO`): N por dono (1 por tópico),
 *   ≤30s, categoria fixa, sem slot — descoberto via query
 *   `where role=TOPIC_AUDIO AND ownerId=...`.
 */

import { randomUUID } from "node:crypto";

import {
    audioApresentacaoExt,
    validarAudioApresentacao,
} from "@/domain/validation";
import { getPlanoDefinition } from "@/domain/plano/definitions";
import { db } from "@/lib/db";

import {
    cleanupStaged,
    commitProfilePhoto,
} from "./profileMedia";
import { createR2Client, type R2Client } from "@/lib/storage/r2";

// ---------------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------------

/** Categorias de TopicAudio. Espelha o enum `TopicAudioKind` do DB. */
export const TOPIC_AUDIO_KINDS = [
    "PRECO",
    "CASAL",
    "DISPONIBILIDADE",
    "LOCAL",
    "PRATICAS",
    "PAGAMENTO",
] as const;
export type TopicAudioKind = (typeof TOPIC_AUDIO_KINDS)[number];

export function isTopicAudioKind(value: unknown): value is TopicAudioKind {
    return (
        typeof value === "string" &&
        (TOPIC_AUDIO_KINDS as readonly string[]).includes(value)
    );
}

/** Rótulo humano por tópico. UI usa pra header de cada FAQ. */
export const TOPIC_AUDIO_LABELS: Record<TopicAudioKind, string> = {
    PRECO: "Preço",
    CASAL: "Atende casal?",
    DISPONIBILIDADE: "Disponibilidade",
    LOCAL: "Local de atendimento",
    PRATICAS: "Práticas",
    PAGAMENTO: "Pagamento",
};

export interface TopicAudioItem {
    id: string;
    topicKind: TopicAudioKind;
    storageKey: string;
    mimeType: string;
    createdAt: Date;
}

// ---------------------------------------------------------------------------
// Estado interno
// ---------------------------------------------------------------------------

let r2ClientSingleton: R2Client | null = null;

function getR2Client(): R2Client {
    if (!r2ClientSingleton) {
        r2ClientSingleton = createR2Client();
    }
    return r2ClientSingleton;
}

/** Test seam. */
export function __setR2ClientForTopicAudioTests(client: R2Client | null): void {
    r2ClientSingleton = client;
}

function buildTopicAudioKey(
    userId: string,
    topicKind: TopicAudioKind,
    ext: string,
): string {
    return `committed/${userId}/topic-audio/${topicKind.toLowerCase()}-${randomUUID()}.${ext}`;
}

// ---------------------------------------------------------------------------
// Publicar
// ---------------------------------------------------------------------------

export type PublicarTopicAudioInput = {
    userId: string;
    topicKind: TopicAudioKind;
    mimeType: string;
    bytes: Uint8Array | Buffer;
};

export type PublicarTopicAudioResult =
    | { ok: true; mediaId: string; storageKey: string }
    | {
        ok: false;
        reason:
        | "AUDIO_INVALIDO"
        | "TOPIC_INVALIDO"
        | "PERSISTENCIA";
    };

/**
 * Publica/substitui o TopicAudio do (userId, topicKind). Mesma
 * validação canônica do Áudio_de_Apresentação (MIME + tamanho).
 *
 * Substituição: se já existe `role=TOPIC_AUDIO, topicKind=X,
 * status=COMMITTED`, marca o antigo como `DELETED` na mesma
 * transação que cria o novo. Unique parcial garante que nunca
 * teremos 2 ativos do mesmo par.
 */
export async function publicarTopicAudio(
    input: PublicarTopicAudioInput,
): Promise<PublicarTopicAudioResult> {
    if (!isTopicAudioKind(input.topicKind)) {
        return { ok: false, reason: "TOPIC_INVALIDO" };
    }

    const sizeBytes = input.bytes.byteLength;
    if (
        !validarAudioApresentacao({
            mimeType: input.mimeType,
            sizeBytes,
        })
    ) {
        return { ok: false, reason: "AUDIO_INVALIDO" };
    }

    const ext = audioApresentacaoExt(input.mimeType);
    if (ext === null) {
        return { ok: false, reason: "AUDIO_INVALIDO" };
    }

    const stagedKey = `staged/${randomUUID()}`;
    try {
        await getR2Client().putStaged(
            stagedKey,
            input.bytes,
            input.mimeType,
        );
    } catch {
        return { ok: false, reason: "PERSISTENCIA" };
    }

    const finalKey = buildTopicAudioKey(input.userId, input.topicKind, ext);

    let mediaId: string | null = null;
    try {
        mediaId = await db.$transaction(async (tx) => {
            // Marca antigo como DELETED (se houver).
            const antigo = await tx.media.findFirst({
                where: {
                    ownerId: input.userId,
                    role: "TOPIC_AUDIO",
                    topicKind: input.topicKind,
                    status: "COMMITTED",
                },
                select: { id: true },
            });
            if (antigo) {
                await tx.media.update({
                    where: { id: antigo.id },
                    data: { status: "DELETED" },
                });
            }

            const created = await tx.media.create({
                data: {
                    ownerId: input.userId,
                    storageKey: finalKey,
                    mimeType: input.mimeType,
                    sizeBytes,
                    status: "COMMITTED",
                    kind: "AUDIO",
                    role: "TOPIC_AUDIO",
                    topicKind: input.topicKind,
                    isProfilePhoto: false,
                },
                select: { id: true },
            });
            return created.id;
        });
    } catch {
        await cleanupStaged(stagedKey);
        return { ok: false, reason: "PERSISTENCIA" };
    }

    if (mediaId === null) {
        await cleanupStaged(stagedKey);
        return { ok: false, reason: "PERSISTENCIA" };
    }

    await commitProfilePhoto({
        stagedKey,
        finalKey,
        mediaId,
    });

    return { ok: true, mediaId, storageKey: finalKey };
}

// ---------------------------------------------------------------------------
// Excluir
// ---------------------------------------------------------------------------

export type ExcluirTopicAudioResult =
    | { ok: true }
    | { ok: false; reason: "NAO_ENCONTRADO" | "PERSISTENCIA" };

/**
 * Marca o TopicAudio ativo do par (userId, topicKind) como DELETED.
 * GC do R2 faz o cleanup do binário.
 */
export async function excluirTopicAudio(input: {
    userId: string;
    topicKind: TopicAudioKind;
}): Promise<ExcluirTopicAudioResult> {
    if (!isTopicAudioKind(input.topicKind)) {
        return { ok: false, reason: "NAO_ENCONTRADO" };
    }
    const row = await db.media.findFirst({
        where: {
            ownerId: input.userId,
            role: "TOPIC_AUDIO",
            topicKind: input.topicKind,
            status: "COMMITTED",
        },
        select: { id: true },
    });
    if (!row) {
        return { ok: false, reason: "NAO_ENCONTRADO" };
    }
    try {
        await db.media.update({
            where: { id: row.id },
            data: { status: "DELETED" },
        });
    } catch {
        return { ok: false, reason: "PERSISTENCIA" };
    }
    return { ok: true };
}

// ---------------------------------------------------------------------------
// Listar
// ---------------------------------------------------------------------------

/**
 * Lista os TopicAudios ativos de um dono. Ordenado por `topicKind`
 * (ordem alfabética da enum) — UI tem layout fixo.
 *
 * # Gate de plano (Premium-only)
 *
 * TopicAudio é um recurso exclusivo do `Plano_Premium` (mesmo gate
 * do Áudio_de_Apresentação). A escrita já barra não-Premium, mas a
 * leitura também aplica o gate aqui de forma centralizada: se o
 * dono não tem mais plano que permite áudio (ex.: fez downgrade
 * Premium → Básico, ou perdeu o plano), devolve lista vazia. Isso
 * garante que o perfil público nunca exiba a FAQ sonora de quem não
 * é Premium, sem cada caller precisar repetir a checagem.
 */
export async function listarTopicAudios(
    userId: string,
): Promise<ReadonlyArray<TopicAudioItem>> {
    // Gate Premium na leitura: confere o plano vigente do dono.
    const profile = await db.acompanhanteProfile.findUnique({
        where: { userId },
        select: { planoVigente: true },
    });
    if (
        !profile ||
        profile.planoVigente === null ||
        !getPlanoDefinition(profile.planoVigente).permiteAudio
    ) {
        return [];
    }

    const rows = await db.media.findMany({
        where: {
            ownerId: userId,
            role: "TOPIC_AUDIO",
            status: "COMMITTED",
            topicKind: { not: null },
        },
        orderBy: { topicKind: "asc" },
        select: {
            id: true,
            topicKind: true,
            storageKey: true,
            mimeType: true,
            createdAt: true,
        },
    });

    const out: TopicAudioItem[] = [];
    for (const r of rows) {
        if (r.topicKind === null) continue;
        if (!isTopicAudioKind(r.topicKind)) continue;
        out.push({
            id: r.id,
            topicKind: r.topicKind,
            storageKey: r.storageKey,
            mimeType: r.mimeType,
            createdAt: r.createdAt,
        });
    }
    return out;
}
