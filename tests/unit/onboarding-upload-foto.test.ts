/**
 * Unit tests for `uploadFoto` from `src/server/onboarding/drafts.ts`
 * (Task 11.4, Requirement 3.10).
 *
 * Coverage:
 *   - Invalid MIME types and over-sized payloads are rejected up front by
 *     `validarFotoPerfil`, never producing a staged R2 object.
 *   - A valid upload writes bytes to `staged/<uuid>` via the R2 client and
 *     records the resulting key on the draft row.
 *   - When the draft already had a previous `stagedKey`, the old object is
 *     deleted (best-effort) after the new key is persisted.
 *   - Missing/expired drafts surface `DraftNotFoundError` / `DraftExpiredError`
 *     without touching R2.
 *
 * The Prisma client (`@/lib/db`) is mocked with an in-memory store so the
 * tests do not require a running Postgres instance. The R2 client is the
 * shared test stub from `tests/helpers/r2-stub.ts`.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createR2Stub } from "../helpers/r2-stub";

// ---------------------------------------------------------------------------
// In-memory Prisma stub
// ---------------------------------------------------------------------------

type DraftRow = {
    id: string;
    payload: Record<string, unknown>;
    stagedKey: string | null;
    createdAt: Date;
    updatedAt: Date;
    expiresAt: Date;
};

const draftStore = new Map<string, DraftRow>();

function pickFields<T extends DraftRow>(
    row: T,
    select?: Partial<Record<keyof DraftRow, boolean>>,
): Partial<DraftRow> {
    if (!select) return { ...row };
    const out: Partial<DraftRow> = {};
    for (const key of Object.keys(select) as (keyof DraftRow)[]) {
        if (select[key]) {
            (out as Record<string, unknown>)[key] = row[key];
        }
    }
    return out;
}

vi.mock("@/lib/db", () => {
    return {
        db: {
            onboardingDraft: {
                async findUnique({
                    where,
                    select,
                }: {
                    where: { id: string };
                    select?: Partial<Record<keyof DraftRow, boolean>>;
                }) {
                    const row = draftStore.get(where.id);
                    if (!row) return null;
                    return pickFields(row, select);
                },
                async update({
                    where,
                    data,
                    select,
                }: {
                    where: { id: string };
                    data: Partial<DraftRow>;
                    select?: Partial<Record<keyof DraftRow, boolean>>;
                }) {
                    const row = draftStore.get(where.id);
                    if (!row) {
                        throw new Error(`draft '${where.id}' not found`);
                    }
                    const next: DraftRow = {
                        ...row,
                        ...data,
                        updatedAt: new Date(),
                    };
                    draftStore.set(next.id, next);
                    return pickFields(next, select);
                },
            },
        },
    };
});

// Imports must come after `vi.mock` so the mock takes effect.
import {
    DraftExpiredError,
    DraftNotFoundError,
    InvalidFotoPerfilError,
    __setR2ClientForTests,
    uploadFoto,
} from "@/server/onboarding/drafts";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const TEN_MB = 10 * 1024 * 1024;
const NOW = new Date("2025-01-01T12:00:00.000Z");
const FUTURE = new Date(NOW.getTime() + 30 * 60 * 1000); // 30 min in the future
const PAST = new Date(NOW.getTime() - 1); // 1 ms in the past

function seedDraft(overrides: Partial<DraftRow> = {}): DraftRow {
    const row: DraftRow = {
        id: overrides.id ?? "draft-1",
        payload: overrides.payload ?? {},
        stagedKey: overrides.stagedKey ?? null,
        createdAt: overrides.createdAt ?? NOW,
        updatedAt: overrides.updatedAt ?? NOW,
        expiresAt: overrides.expiresAt ?? FUTURE,
    };
    draftStore.set(row.id, row);
    return row;
}

const validFile = {
    mimeType: "image/jpeg",
    bytes: new Uint8Array([1, 2, 3, 4]),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("uploadFoto (Task 11.4, Requirement 3.10)", () => {
    let r2: ReturnType<typeof createR2Stub>;

    beforeEach(() => {
        draftStore.clear();
        r2 = createR2Stub();
        __setR2ClientForTests(r2);
    });

    afterEach(() => {
        __setR2ClientForTests(null);
    });

    it("rejects an unsupported mime type before touching R2", async () => {
        seedDraft();

        await expect(
            uploadFoto(
                "draft-1",
                { mimeType: "image/gif", bytes: validFile.bytes },
                { now: NOW },
            ),
        ).rejects.toBeInstanceOf(InvalidFotoPerfilError);

        expect(r2.snapshot()).toEqual([]);
        expect(draftStore.get("draft-1")?.stagedKey).toBeNull();
    });

    it("rejects an oversized file before touching R2", async () => {
        seedDraft();

        await expect(
            uploadFoto(
                "draft-1",
                {
                    mimeType: "image/png",
                    // We only need `byteLength` to exceed the limit, so a
                    // sparse Uint8Array of the right size is enough.
                    bytes: new Uint8Array(TEN_MB + 1),
                },
                { now: NOW },
            ),
        ).rejects.toBeInstanceOf(InvalidFotoPerfilError);

        expect(r2.snapshot()).toEqual([]);
        expect(draftStore.get("draft-1")?.stagedKey).toBeNull();
    });

    it("uploads to staged/<uuid> and records the key on the draft", async () => {
        seedDraft();

        const { stagedKey } = await uploadFoto("draft-1", validFile, {
            now: NOW,
        });

        expect(stagedKey).toMatch(/^staged\/[0-9a-f-]{36}$/i);

        // R2 received exactly one staged object with the expected mime/bytes.
        const objects = r2.snapshot();
        expect(objects).toHaveLength(1);
        expect(objects[0].key).toBe(stagedKey);
        expect(objects[0].mimeType).toBe("image/jpeg");
        expect(objects[0].bytes).toEqual(validFile.bytes);

        // Draft row was updated with the new staged key and a fresh TTL.
        const row = draftStore.get("draft-1")!;
        expect(row.stagedKey).toBe(stagedKey);
        expect(row.expiresAt.getTime()).toBe(NOW.getTime() + 60 * 60 * 1000);
    });

    it("deletes the previous staged object when re-uploading on the same draft", async () => {
        const previousKey = "staged/previous-object";
        seedDraft({ stagedKey: previousKey });

        // Pre-seed the stub with the previous staged object as if a prior
        // upload had stored it.
        await r2.putStaged(previousKey, new Uint8Array([9]), "image/jpeg");
        expect(r2.has(previousKey)).toBe(true);

        const { stagedKey } = await uploadFoto("draft-1", validFile, {
            now: NOW,
        });

        expect(stagedKey).not.toBe(previousKey);
        expect(r2.has(previousKey)).toBe(false);
        expect(r2.has(stagedKey)).toBe(true);
        expect(draftStore.get("draft-1")?.stagedKey).toBe(stagedKey);
    });

    it("throws DraftNotFoundError without uploading when the draft is missing", async () => {
        await expect(
            uploadFoto("missing-draft", validFile, { now: NOW }),
        ).rejects.toBeInstanceOf(DraftNotFoundError);

        expect(r2.snapshot()).toEqual([]);
    });

    it("throws DraftExpiredError without uploading when the draft is expired", async () => {
        seedDraft({ expiresAt: PAST });

        await expect(
            uploadFoto("draft-1", validFile, { now: NOW }),
        ).rejects.toBeInstanceOf(DraftExpiredError);

        expect(r2.snapshot()).toEqual([]);
        expect(draftStore.get("draft-1")?.stagedKey).toBeNull();
    });
});
