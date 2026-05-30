/**
 * Unit test do serviço de Vídeo de apresentação.
 *
 * Cobre:
 *   1. Validação: duração fora do range [5,60]s rejeitada;
 *      MIME inválido rejeitado; size 0 rejeitado.
 *   2. Sucesso: cria Media com role=VIDEO_PRESENTATION + atualiza
 *      slot do profile.
 *   3. Substituição: marca antiga como DELETED, cria nova
 *      COMMITTED, slot aponta pra nova.
 *   4. Excluir: marca como DELETED, zera slot.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

interface ProfileRow {
    userId: string;
    videoApresentacaoId: string | null;
}

interface MediaRow {
    id: string;
    ownerId: string;
    role: string;
    status: string;
    storageKey: string;
    posterStorageKey: string | null;
    mimeType: string;
    sizeBytes: number;
    kind: string;
    durationSeconds: number | null;
    createdAt: Date;
}

const stores = vi.hoisted(() => ({
    profiles: new Map<string, { userId: string; videoApresentacaoId: string | null }>(),
    medias: new Map<string, {
        id: string;
        ownerId: string;
        role: string;
        status: string;
        storageKey: string;
        posterStorageKey: string | null;
        mimeType: string;
        sizeBytes: number;
        kind: string;
        durationSeconds: number | null;
        createdAt: Date;
    }>(),
    nextId: 1,
}));

vi.mock("@/lib/db", () => {
    const txAcompanhanteProfile = {
        async findUnique({
            where,
            select,
        }: {
            where: { userId: string };
            select?: Partial<Record<keyof ProfileRow, boolean>>;
        }) {
            const row = stores.profiles.get(where.userId);
            if (!row) return null;
            if (!select) return { ...row };
            const out: Partial<ProfileRow> = {};
            for (const k of Object.keys(select) as (keyof ProfileRow)[]) {
                if (select[k]) (out as Record<string, unknown>)[k] = row[k];
            }
            return out;
        },
        async update({
            where,
            data,
        }: {
            where: { userId: string };
            data: { videoApresentacaoId?: string | null };
        }) {
            const row = stores.profiles.get(where.userId);
            if (!row) throw new Error("profile not found");
            if ("videoApresentacaoId" in data) {
                row.videoApresentacaoId = data.videoApresentacaoId ?? null;
            }
            stores.profiles.set(where.userId, row);
            return { ...row };
        },
    };
    const txMedia = {
        async create({
            data,
        }: {
            data: {
                ownerId: string;
                storageKey: string;
                posterStorageKey: string | null;
                mimeType: string;
                sizeBytes: number;
                status: string;
                kind: string;
                role: string;
                durationSeconds?: number | null;
            };
        }) {
            const id = `m-${stores.nextId++}`;
            stores.medias.set(id, {
                id,
                ownerId: data.ownerId,
                role: data.role,
                status: data.status,
                storageKey: data.storageKey,
                posterStorageKey: data.posterStorageKey ?? null,
                mimeType: data.mimeType,
                sizeBytes: data.sizeBytes,
                kind: data.kind,
                durationSeconds: data.durationSeconds ?? null,
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
            if (!row) throw new Error("media not found");
            if (data.status) row.status = data.status;
            stores.medias.set(where.id, row);
            return { ...row };
        },
    };

    return {
        db: {
            acompanhanteProfile: txAcompanhanteProfile,
            media: txMedia,
            async $transaction<T>(fn: (tx: unknown) => Promise<T>): Promise<T> {
                return fn({
                    acompanhanteProfile: txAcompanhanteProfile,
                    media: txMedia,
                });
            },
        },
    };
});

vi.mock("@/lib/storage/r2", () => ({
    createR2Client: () => ({
        async putStaged() {},
        async commit() {},
        async deleteObject() {},
        async presignedUrl(k: string) {
            return `https://r2/${k}`;
        },
    }),
}));

vi.mock("@/server/storage/profileMedia", () => ({
    cleanupStaged: async () => {},
    commitProfilePhoto: async () => {},
}));

vi.mock("@/server/storage/watermark", () => ({
    applyGalleryWatermark: async (args: { bytes: Uint8Array | Buffer }) => {
        // No-op pra testes — devolve buffer sem alterar.
        return Buffer.isBuffer(args.bytes)
            ? args.bytes
            : Buffer.from(args.bytes);
    },
}));

vi.mock("@/server/storage/extractVideoPoster", () => ({
    extractVideoPoster: async () => null,
}));

import {
    excluirVideoApresentacao,
    publicarVideoApresentacao,
} from "@/server/storage/videoApresentacao";

const VALID_VIDEO_BYTES = new Uint8Array(2048);
const VALID_MIME = "video/mp4";

function seedProfile(userId: string): void {
    stores.profiles.set(userId, {
        userId,
        videoApresentacaoId: null,
    });
}

beforeEach(() => {
    stores.profiles.clear();
    stores.medias.clear();
    stores.nextId = 1;
});

describe("publicarVideoApresentacao — validações", () => {
    it("rejeita duração < 5s", async () => {
        seedProfile("u1");
        const r = await publicarVideoApresentacao({
            userId: "u1",
            mimeType: VALID_MIME,
            bytes: VALID_VIDEO_BYTES,
            durationSeconds: 4,
        });
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.reason).toBe("DURACAO_INVALIDA");
    });

    it("rejeita duração > 60s", async () => {
        seedProfile("u1");
        const r = await publicarVideoApresentacao({
            userId: "u1",
            mimeType: VALID_MIME,
            bytes: VALID_VIDEO_BYTES,
            durationSeconds: 61,
        });
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.reason).toBe("DURACAO_INVALIDA");
    });

    it("rejeita duração NaN", async () => {
        seedProfile("u1");
        const r = await publicarVideoApresentacao({
            userId: "u1",
            mimeType: VALID_MIME,
            bytes: VALID_VIDEO_BYTES,
            durationSeconds: Number.NaN,
        });
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.reason).toBe("DURACAO_INVALIDA");
    });

    it("rejeita MIME audio", async () => {
        seedProfile("u1");
        const r = await publicarVideoApresentacao({
            userId: "u1",
            mimeType: "audio/webm",
            bytes: VALID_VIDEO_BYTES,
            durationSeconds: 30,
        });
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.reason).toBe("VIDEO_INVALIDO");
    });

    it("rejeita size 0", async () => {
        seedProfile("u1");
        const r = await publicarVideoApresentacao({
            userId: "u1",
            mimeType: VALID_MIME,
            bytes: new Uint8Array(0),
            durationSeconds: 30,
        });
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.reason).toBe("VIDEO_INVALIDO");
    });

    it("rejeita perfil inexistente", async () => {
        const r = await publicarVideoApresentacao({
            userId: "fantasma",
            mimeType: VALID_MIME,
            bytes: VALID_VIDEO_BYTES,
            durationSeconds: 30,
        });
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.reason).toBe("PERFIL_NAO_ENCONTRADO");
    });
});

describe("publicarVideoApresentacao — sucesso", () => {
    it("cria media e atualiza slot", async () => {
        seedProfile("u1");
        const r = await publicarVideoApresentacao({
            userId: "u1",
            mimeType: VALID_MIME,
            bytes: VALID_VIDEO_BYTES,
            durationSeconds: 30,
        });
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        const profile = stores.profiles.get("u1");
        expect(profile?.videoApresentacaoId).toBe(r.mediaId);

        const media = stores.medias.get(r.mediaId);
        expect(media?.role).toBe("VIDEO_PRESENTATION");
        expect(media?.status).toBe("COMMITTED");
        expect(media?.kind).toBe("VIDEO");
        expect(media?.durationSeconds).toBe(30);
    });

    it("substituição: anterior vira DELETED, slot aponta pra novo", async () => {
        seedProfile("u1");
        const r1 = await publicarVideoApresentacao({
            userId: "u1",
            mimeType: VALID_MIME,
            bytes: VALID_VIDEO_BYTES,
            durationSeconds: 20,
        });
        expect(r1.ok).toBe(true);
        if (!r1.ok) return;

        const r2 = await publicarVideoApresentacao({
            userId: "u1",
            mimeType: VALID_MIME,
            bytes: VALID_VIDEO_BYTES,
            durationSeconds: 30,
        });
        expect(r2.ok).toBe(true);
        if (!r2.ok) return;

        const old = stores.medias.get(r1.mediaId);
        const novo = stores.medias.get(r2.mediaId);
        expect(old?.status).toBe("DELETED");
        expect(novo?.status).toBe("COMMITTED");
        expect(stores.profiles.get("u1")?.videoApresentacaoId).toBe(r2.mediaId);
    });
});

describe("excluirVideoApresentacao", () => {
    it("zera slot e marca media como DELETED", async () => {
        seedProfile("u1");
        const r1 = await publicarVideoApresentacao({
            userId: "u1",
            mimeType: VALID_MIME,
            bytes: VALID_VIDEO_BYTES,
            durationSeconds: 20,
        });
        expect(r1.ok).toBe(true);
        if (!r1.ok) return;

        const r2 = await excluirVideoApresentacao("u1");
        expect(r2.ok).toBe(true);
        expect(stores.profiles.get("u1")?.videoApresentacaoId).toBe(null);
        expect(stores.medias.get(r1.mediaId)?.status).toBe("DELETED");
    });

    it("rejeita quando não há vídeo", async () => {
        seedProfile("u1");
        const r = await excluirVideoApresentacao("u1");
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.reason).toBe("VIDEO_NAO_ENCONTRADO");
    });

    it("rejeita perfil inexistente", async () => {
        const r = await excluirVideoApresentacao("fantasma");
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.reason).toBe("PERFIL_NAO_ENCONTRADO");
    });
});
