/**
 * Unit test do TopicAudio.
 *
 * Cobre:
 *   1. isTopicAudioKind — type guard.
 *   2. publicarTopicAudio: rejeita topicKind inválido, audio
 *      inválido (MIME ou size).
 *   3. publicarTopicAudio: cria nova media com role=TOPIC_AUDIO,
 *      topicKind setado, status=COMMITTED.
 *   4. publicarTopicAudio: substituição — antiga COMMITTED vira
 *      DELETED, nova fica COMMITTED.
 *   5. excluirTopicAudio: marca como DELETED; rejeita inexistente.
 *   6. listarTopicAudios: ignora outros roles e DELETED.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

interface MediaRow {
    id: string;
    ownerId: string;
    role: string;
    status: string;
    storageKey: string;
    mimeType: string;
    sizeBytes: number;
    kind: string;
    topicKind: string | null;
    createdAt: Date;
}

const stores = vi.hoisted(() => ({
    medias: new Map<string, {
        id: string;
        ownerId: string;
        role: string;
        status: string;
        storageKey: string;
        mimeType: string;
        sizeBytes: number;
        kind: string;
        topicKind: string | null;
        createdAt: Date;
    }>(),
    nextId: 1,
    r2Calls: [] as string[],
}));

vi.mock("@/lib/db", () => {
    return {
        db: {
            media: {
                async findFirst({
                    where,
                    select,
                }: {
                    where: {
                        ownerId?: string;
                        role?: string;
                        topicKind?: string;
                        status?: string;
                    };
                    select?: Partial<Record<keyof MediaRow, boolean>>;
                }) {
                    for (const row of stores.medias.values()) {
                        if (where.ownerId && row.ownerId !== where.ownerId)
                            continue;
                        if (where.role && row.role !== where.role) continue;
                        if (where.status && row.status !== where.status)
                            continue;
                        if (
                            where.topicKind !== undefined &&
                            row.topicKind !== where.topicKind
                        )
                            continue;
                        if (!select) return { ...row };
                        const out: Partial<MediaRow> = {};
                        for (const k of Object.keys(select) as (keyof MediaRow)[]) {
                            if (select[k]) {
                                (out as Record<string, unknown>)[k] = row[k];
                            }
                        }
                        return out;
                    }
                    return null;
                },
                async findMany({
                    where,
                }: {
                    where: {
                        ownerId?: string;
                        role?: string;
                        status?: string;
                        topicKind?: { not: null } | string;
                    };
                }) {
                    const out: MediaRow[] = [];
                    for (const row of stores.medias.values()) {
                        if (where.ownerId && row.ownerId !== where.ownerId)
                            continue;
                        if (where.role && row.role !== where.role) continue;
                        if (where.status && row.status !== where.status)
                            continue;
                        if (where.topicKind !== undefined) {
                            if (
                                typeof where.topicKind === "object" &&
                                "not" in where.topicKind &&
                                where.topicKind.not === null
                            ) {
                                if (row.topicKind === null) continue;
                            } else if (
                                typeof where.topicKind === "string" &&
                                row.topicKind !== where.topicKind
                            ) {
                                continue;
                            }
                        }
                        out.push({ ...row });
                    }
                    return out;
                },
                async create({
                    data,
                }: {
                    data: {
                        ownerId: string;
                        storageKey: string;
                        mimeType: string;
                        sizeBytes: number;
                        status: string;
                        kind: string;
                        role: string;
                        topicKind?: string;
                    };
                }) {
                    const id = `m-${stores.nextId++}`;
                    stores.medias.set(id, {
                        id,
                        ownerId: data.ownerId,
                        role: data.role,
                        status: data.status,
                        storageKey: data.storageKey,
                        mimeType: data.mimeType,
                        sizeBytes: data.sizeBytes,
                        kind: data.kind,
                        topicKind: data.topicKind ?? null,
                        createdAt: new Date(),
                    });
                    return { id };
                },
                async update({
                    where,
                    data,
                }: {
                    where: { id: string };
                    data: { status?: string };
                }) {
                    const row = stores.medias.get(where.id);
                    if (!row) {
                        throw new Error(`mock update: ${where.id} not found`);
                    }
                    if (data.status) row.status = data.status;
                    stores.medias.set(where.id, row);
                    return { ...row };
                },
            },
            async $transaction<T>(fn: (tx: unknown) => Promise<T>): Promise<T> {
                // Reusa o mesmo db dentro da transação no mock.
                return fn({
                    media: {
                        findFirst: (
                            ...args: Parameters<typeof db.media.findFirst>
                        ) => db.media.findFirst(...args),
                        update: (
                            ...args: Parameters<typeof db.media.update>
                        ) => db.media.update(...args),
                        create: (
                            ...args: Parameters<typeof db.media.create>
                        ) => db.media.create(...args),
                    },
                });
            },
        },
    };
});

// Mock R2 + commitProfilePhoto
vi.mock("@/lib/storage/r2", () => ({
    createR2Client: () => ({
        async putStaged(key: string) {
            stores.r2Calls.push(`putStaged:${key}`);
        },
        async commit(stagedKey: string, finalKey: string) {
            stores.r2Calls.push(`commit:${stagedKey}->${finalKey}`);
        },
        async deleteObject(key: string) {
            stores.r2Calls.push(`delete:${key}`);
        },
        async presignedUrl(key: string) {
            return `https://r2/${key}`;
        },
    }),
}));

vi.mock("@/server/storage/profileMedia", () => ({
    cleanupStaged: async (key: string) => {
        stores.r2Calls.push(`cleanup:${key}`);
    },
    commitProfilePhoto: async (input: {
        stagedKey: string;
        finalKey: string;
        mediaId: string;
    }) => {
        stores.r2Calls.push(
            `commit:${input.stagedKey}->${input.finalKey}:${input.mediaId}`,
        );
    },
}));

import { db } from "@/lib/db";
import {
    excluirTopicAudio,
    isTopicAudioKind,
    listarTopicAudios,
    publicarTopicAudio,
} from "@/server/storage/topicAudio";

const VALID_AUDIO_BYTES = new Uint8Array(2048); // > 0 < limite
const VALID_MIME = "audio/webm";

beforeEach(() => {
    stores.medias.clear();
    stores.nextId = 1;
    stores.r2Calls = [];
});

describe("isTopicAudioKind", () => {
    it("aceita kinds válidos", () => {
        expect(isTopicAudioKind("PRECO")).toBe(true);
        expect(isTopicAudioKind("CASAL")).toBe(true);
        expect(isTopicAudioKind("DISPONIBILIDADE")).toBe(true);
    });
    it("rejeita inválidos", () => {
        expect(isTopicAudioKind("foo")).toBe(false);
        expect(isTopicAudioKind("")).toBe(false);
        expect(isTopicAudioKind(null)).toBe(false);
        expect(isTopicAudioKind("preco")).toBe(false); // case sensitive
    });
});

describe("publicarTopicAudio — validações", () => {
    it("rejeita topicKind inválido", async () => {
        // @ts-expect-error testando coerção em runtime
        const r = await publicarTopicAudio({
            userId: "u1",
            topicKind: "FOO",
            mimeType: VALID_MIME,
            bytes: VALID_AUDIO_BYTES,
        });
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.reason).toBe("TOPIC_INVALIDO");
    });

    it("rejeita MIME inválido", async () => {
        const r = await publicarTopicAudio({
            userId: "u1",
            topicKind: "PRECO",
            mimeType: "video/mp4",
            bytes: VALID_AUDIO_BYTES,
        });
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.reason).toBe("AUDIO_INVALIDO");
    });

    it("rejeita size 0", async () => {
        const r = await publicarTopicAudio({
            userId: "u1",
            topicKind: "PRECO",
            mimeType: VALID_MIME,
            bytes: new Uint8Array(0),
        });
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.reason).toBe("AUDIO_INVALIDO");
    });
});

describe("publicarTopicAudio — sucesso", () => {
    it("cria media com role=TOPIC_AUDIO + topicKind", async () => {
        const r = await publicarTopicAudio({
            userId: "u1",
            topicKind: "PRECO",
            mimeType: VALID_MIME,
            bytes: VALID_AUDIO_BYTES,
        });
        expect(r.ok).toBe(true);

        const lista = await listarTopicAudios("u1");
        expect(lista).toHaveLength(1);
        expect(lista[0]?.topicKind).toBe("PRECO");
    });

    it("substituição: gravar PRECO 2x deixa só 1 ativo", async () => {
        await publicarTopicAudio({
            userId: "u1",
            topicKind: "PRECO",
            mimeType: VALID_MIME,
            bytes: VALID_AUDIO_BYTES,
        });
        await publicarTopicAudio({
            userId: "u1",
            topicKind: "PRECO",
            mimeType: VALID_MIME,
            bytes: VALID_AUDIO_BYTES,
        });

        const lista = await listarTopicAudios("u1");
        expect(lista).toHaveLength(1);

        // Verifica que o antigo virou DELETED.
        let deletedCount = 0;
        let committedCount = 0;
        for (const row of stores.medias.values()) {
            if (
                row.role === "TOPIC_AUDIO" &&
                row.topicKind === "PRECO" &&
                row.ownerId === "u1"
            ) {
                if (row.status === "DELETED") deletedCount++;
                if (row.status === "COMMITTED") committedCount++;
            }
        }
        expect(deletedCount).toBe(1);
        expect(committedCount).toBe(1);
    });

    it("topicKinds diferentes coexistem", async () => {
        await publicarTopicAudio({
            userId: "u1",
            topicKind: "PRECO",
            mimeType: VALID_MIME,
            bytes: VALID_AUDIO_BYTES,
        });
        await publicarTopicAudio({
            userId: "u1",
            topicKind: "CASAL",
            mimeType: VALID_MIME,
            bytes: VALID_AUDIO_BYTES,
        });

        const lista = await listarTopicAudios("u1");
        expect(lista).toHaveLength(2);
        const kinds = lista.map((l) => l.topicKind).sort();
        expect(kinds).toEqual(["CASAL", "PRECO"]);
    });
});

describe("excluirTopicAudio", () => {
    it("marca como DELETED", async () => {
        await publicarTopicAudio({
            userId: "u1",
            topicKind: "PRECO",
            mimeType: VALID_MIME,
            bytes: VALID_AUDIO_BYTES,
        });

        const r = await excluirTopicAudio({
            userId: "u1",
            topicKind: "PRECO",
        });
        expect(r.ok).toBe(true);

        const lista = await listarTopicAudios("u1");
        expect(lista).toHaveLength(0);
    });

    it("rejeita inexistente", async () => {
        const r = await excluirTopicAudio({
            userId: "u1",
            topicKind: "PRECO",
        });
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.reason).toBe("NAO_ENCONTRADO");
    });

    it("não vaza entre usuários", async () => {
        await publicarTopicAudio({
            userId: "u1",
            topicKind: "PRECO",
            mimeType: VALID_MIME,
            bytes: VALID_AUDIO_BYTES,
        });
        const r = await excluirTopicAudio({
            userId: "u2",
            topicKind: "PRECO",
        });
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.reason).toBe("NAO_ENCONTRADO");

        // u1 ainda tem ativo.
        const lista = await listarTopicAudios("u1");
        expect(lista).toHaveLength(1);
    });
});

describe("listarTopicAudios", () => {
    it("ignora roles diferentes de TOPIC_AUDIO", async () => {
        // Seeda manualmente um GALLERY pra simular dados diversos.
        await db.media.create({
            data: {
                ownerId: "u1",
                storageKey: "k1",
                mimeType: "image/jpeg",
                sizeBytes: 100,
                status: "COMMITTED",
                kind: "PHOTO",
                role: "GALLERY",
            },
        });
        await publicarTopicAudio({
            userId: "u1",
            topicKind: "PRECO",
            mimeType: VALID_MIME,
            bytes: VALID_AUDIO_BYTES,
        });

        const lista = await listarTopicAudios("u1");
        expect(lista).toHaveLength(1);
        expect(lista[0]?.topicKind).toBe("PRECO");
    });
});
