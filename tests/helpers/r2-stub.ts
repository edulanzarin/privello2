/**
 * In-memory stub for the Cloudflare R2 client described in `design.md`.
 *
 * Exposes the same contract used by `src/lib/storage/r2.ts`:
 *
 *   - `putStaged(key, bytes, mime)`
 *   - `commit(stagedKey, finalKey)`
 *   - `deleteObject(key)`
 *   - `presignedUrl(key)`
 *
 * Tests can swap this implementation in instead of the real S3-compatible
 * client to exercise onboarding/atomicity paths (Property 15) and the
 * confinement strategy (Properties 32) without contacting the network.
 */

export interface R2Object {
    key: string;
    bytes: Uint8Array;
    mimeType: string;
}

/**
 * Errors translated to internal codes (mirrors design.md's "no SDK types
 * leak across the boundary" rule).
 */
export type R2ErrorCode =
    | "R2_NOT_FOUND"
    | "R2_UPLOAD_FAILED"
    | "R2_COMMIT_FAILED"
    | "R2_DELETE_FAILED";

export class R2StubError extends Error {
    constructor(public readonly code: R2ErrorCode, message?: string) {
        super(message ?? code);
        this.name = "R2StubError";
    }
}

/**
 * Minimal `R2Client` interface every adapter (real or stub) must satisfy.
 */
export interface R2Client {
    putStaged(
        key: string,
        bytes: Uint8Array,
        mimeType: string,
    ): Promise<{ key: string }>;
    commit(stagedKey: string, finalKey: string): Promise<{ key: string }>;
    deleteObject(key: string): Promise<void>;
    presignedUrl(key: string): Promise<string>;
    fetch(key: string): Promise<Uint8Array | null>;
}

export interface R2StubOptions {
    /**
     * If set, the stub fails with `R2_UPLOAD_FAILED` when the matcher returns
     * true for an incoming `putStaged` key. Useful to simulate upload errors.
     */
    failOnPutStaged?: (key: string) => boolean;
    /**
     * If set, the stub fails with `R2_COMMIT_FAILED` when the matcher matches
     * the `(stagedKey, finalKey)` pair. Useful to test post-commit recovery.
     */
    failOnCommit?: (stagedKey: string, finalKey: string) => boolean;
    /** Base URL used by `presignedUrl` to form the returned URL. */
    publicBaseUrl?: string;
}

/**
 * Creates an in-memory `R2Client` whose state lives in a `Map` keyed by the
 * full object key. Two helper accessors (`snapshot`, `reset`) are exposed so
 * tests can assert post-conditions without touching internals directly.
 */
export function createR2Stub(options: R2StubOptions = {}): R2Client & {
    snapshot: () => R2Object[];
    reset: () => void;
    has: (key: string) => boolean;
} {
    const store = new Map<string, R2Object>();
    const baseUrl = options.publicBaseUrl ?? "https://r2.test.local";

    const requireStagedPrefix = (key: string) => {
        if (!key.startsWith("staged/")) {
            throw new R2StubError(
                "R2_UPLOAD_FAILED",
                `R2 stub: putStaged keys must start with 'staged/' (got '${key}')`,
            );
        }
    };

    return {
        async putStaged(key, bytes, mimeType) {
            requireStagedPrefix(key);
            if (options.failOnPutStaged?.(key)) {
                throw new R2StubError("R2_UPLOAD_FAILED");
            }
            store.set(key, { key, bytes, mimeType });
            return { key };
        },

        async commit(stagedKey, finalKey) {
            const src = store.get(stagedKey);
            if (!src) {
                throw new R2StubError(
                    "R2_NOT_FOUND",
                    `R2 stub: staged key '${stagedKey}' does not exist`,
                );
            }
            if (options.failOnCommit?.(stagedKey, finalKey)) {
                throw new R2StubError("R2_COMMIT_FAILED");
            }
            store.set(finalKey, { ...src, key: finalKey });
            store.delete(stagedKey);
            return { key: finalKey };
        },

        async deleteObject(key) {
            // DELETE is idempotent: removing a non-existent key is not an error.
            store.delete(key);
        },

        async presignedUrl(key) {
            if (!store.has(key)) {
                throw new R2StubError(
                    "R2_NOT_FOUND",
                    `R2 stub: cannot presign missing key '${key}'`,
                );
            }
            return `${baseUrl}/${encodeURIComponent(key)}?sig=stub`;
        },

        async fetch(key) {
            const obj = store.get(key);
            return obj ? obj.bytes : null;
        },

        snapshot() {
            return Array.from(store.values()).map((o) => ({
                ...o,
                bytes: o.bytes,
            }));
        },

        reset() {
            store.clear();
        },

        has(key) {
            return store.has(key);
        },
    };
}
