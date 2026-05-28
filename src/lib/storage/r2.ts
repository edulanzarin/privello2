/**
 * Single point of contact between the Privello platform and Cloudflare R2.
 *
 * Cloudflare R2 is S3-compatible, so this module wraps the AWS SDK's
 * `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner` packages behind a
 * stable, SDK-free surface. All consumers MUST import only from this module
 * (`src/lib/storage/r2.ts`) — no other file may import the AWS SDK directly.
 * That confinement is enforced by Property 32 (Requirement 7.7) and is the
 * reason no SDK types or values leak through this file's public exports.
 *
 * Public surface:
 * - `R2ErrorCode` / `R2Error`: internal error vocabulary, never exposes
 *   `AWS.*Error` subclasses or HTTP metadata from the SDK.
 * - `R2Client`: stable interface with `putStaged`, `commit`, `deleteObject`
 *   and `presignedUrl`.
 * - `createR2Client(env?)`: factory that reads `R2_*` env variables and
 *   builds an S3 client targeting the Cloudflare R2 endpoint
 *   `https://<account-id>.r2.cloudflarestorage.com` with `region="auto"`.
 *
 * Requirements: 7.7.
 */

import {
    CopyObjectCommand,
    DeleteObjectCommand,
    GetObjectCommand,
    PutObjectCommand,
    S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import * as fs from "node:fs";
import * as path from "node:path";

/** Internal error codes — these are the only failure values external code can observe. */
export type R2ErrorCode =
    | "R2_UPLOAD_FAILED"
    | "R2_COMMIT_FAILED"
    | "R2_DELETE_FAILED"
    | "R2_NOT_FOUND"
    | "R2_PRESIGN_FAILED";

/**
 * Error type thrown by every `R2Client` method. Carries one of the
 * `R2ErrorCode` values plus a human-readable message. The `cause` is
 * preserved for logging but its concrete type is intentionally untyped so
 * that no SDK type leaks into consumers.
 */
export class R2Error extends Error {
    public readonly code: R2ErrorCode;

    constructor(code: R2ErrorCode, message?: string, cause?: unknown) {
        super(message ?? code);
        this.name = "R2Error";
        this.code = code;
        if (cause !== undefined) {
            // Use a plain assignment so we don't depend on the ES2022
            // `cause` option being honored by every runtime.
            (this as { cause?: unknown }).cause = cause;
        }
    }
}

/** Options accepted by `R2Client.presignedUrl`. */
export interface PresignedUrlOptions {
    /** Validity window in seconds. Defaults to 300 (5 minutes). */
    expiresInSeconds?: number;
}

/**
 * Stable interface that the rest of the platform consumes for R2 storage.
 * All inputs and outputs use plain TypeScript values — no SDK types.
 */
export interface R2Client {
    /**
     * Uploads `bytes` to the staging area of the configured bucket. The
     * `key` MUST start with `staged/`; otherwise the call fails fast with
     * `R2_UPLOAD_FAILED` before any network request is attempted. Used by
     * the onboarding flow to upload the profile photo before the database
     * transaction commits.
     */
    putStaged(
        key: string,
        bytes: Uint8Array | Buffer,
        mime: string,
    ): Promise<{ key: string }>;

    /**
     * Promotes a staged object to its final key by copying it within the
     * same bucket and then deleting the staged source. Returns the final
     * key on success.
     */
    commit(stagedKey: string, finalKey: string): Promise<{ key: string }>;

    /**
     * Removes an object from the bucket. The operation is idempotent: if
     * the key does not exist, the call resolves successfully instead of
     * throwing.
     */
    deleteObject(key: string): Promise<void>;

    /**
     * Builds a short-lived presigned GET URL for the given key. The
     * default validity is 300 seconds; callers can override via `opts`.
     */
    presignedUrl(key: string, opts?: PresignedUrlOptions): Promise<string>;

    /**
     * Reads the raw bytes of an object. Returns `null` when the key
     * does not exist. Used by private endpoints (e.g. admin viewing
     * verification photos) that must serve content server-side
     * instead of redirecting to a presigned URL.
     */
    fetch(key: string): Promise<Uint8Array | null>;
}

/** Subset of `process.env` consumed by `createR2Client`. */
export type R2EnvKey =
    | "R2_ACCOUNT_ID"
    | "R2_ACCESS_KEY_ID"
    | "R2_SECRET_ACCESS_KEY"
    | "R2_BUCKET";

const REQUIRED_KEYS: readonly R2EnvKey[] = [
    "R2_ACCOUNT_ID",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_BUCKET",
];

const STAGED_PREFIX = "staged/";
const DEFAULT_EXPIRES_IN_SECONDS = 300;

interface ResolvedConfig {
    accountId: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucket: string;
}

function resolveConfig(
    overrides: Partial<Record<R2EnvKey, string>> | undefined,
): ResolvedConfig {
    const source: Partial<Record<R2EnvKey, string>> = overrides ?? {};
    const env = process.env;
    const missing: R2EnvKey[] = [];
    const values: Partial<Record<R2EnvKey, string>> = {};

    for (const key of REQUIRED_KEYS) {
        const raw = source[key] ?? env[key];
        if (raw === undefined || raw === "") {
            missing.push(key);
        } else {
            values[key] = raw;
        }
    }

    if (missing.length > 0) {
        throw new R2Error(
            "R2_UPLOAD_FAILED",
            `R2 client misconfigured: missing required env variables (${missing.join(", ")}).`,
        );
    }

    return {
        accountId: values.R2_ACCOUNT_ID as string,
        accessKeyId: values.R2_ACCESS_KEY_ID as string,
        secretAccessKey: values.R2_SECRET_ACCESS_KEY as string,
        bucket: values.R2_BUCKET as string,
    };
}

/**
 * Best-effort extraction of an SDK error's discriminator. The S3 SDK uses
 * either a `name` field or a `Code` property depending on the failure path;
 * we read both without ever exposing the values themselves.
 */
function sdkErrorName(err: unknown): string | undefined {
    if (err && typeof err === "object") {
        const e = err as { name?: unknown; Code?: unknown };
        if (typeof e.name === "string") return e.name;
        if (typeof e.Code === "string") return e.Code;
    }
    return undefined;
}

function isNoSuchKey(err: unknown): boolean {
    const name = sdkErrorName(err);
    return name === "NoSuchKey" || name === "NotFound" || name === "404";
}

function ensureStagedKey(key: string): void {
    if (!key.startsWith(STAGED_PREFIX)) {
        throw new R2Error(
            "R2_UPLOAD_FAILED",
            `R2 staged keys must start with '${STAGED_PREFIX}' (got '${key}').`,
        );
    }
}

/**
 * Creates a fully configured `R2Client` backed by the AWS S3 SDK targeting
 * Cloudflare R2. All SDK types are kept private to this closure.
 *
 * In development (`NODE_ENV !== "production"`), returns a local filesystem
 * client that stores files under `.storage/` in the project root. This
 * avoids needing real R2 credentials during local dev.
 */
export function createR2Client(
    overrides?: Partial<Record<R2EnvKey, string>>,
): R2Client {
    if (process.env.NODE_ENV !== "production") {
        return createLocalR2Client();
    }

    const config = resolveConfig(overrides);

    const s3 = new S3Client({
        region: "auto",
        endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
        credentials: {
            accessKeyId: config.accessKeyId,
            secretAccessKey: config.secretAccessKey,
        },
        forcePathStyle: false,
    });

    const bucket = config.bucket;

    return {
        async putStaged(key, bytes, mime) {
            ensureStagedKey(key);

            const body =
                bytes instanceof Uint8Array
                    ? bytes
                    : Uint8Array.from(bytes as Buffer);

            try {
                await s3.send(
                    new PutObjectCommand({
                        Bucket: bucket,
                        Key: key,
                        Body: body,
                        ContentType: mime,
                    }),
                );
                return { key };
            } catch (err) {
                throw new R2Error(
                    "R2_UPLOAD_FAILED",
                    `Failed to upload staged object '${key}'.`,
                    err,
                );
            }
        },

        async commit(stagedKey, finalKey) {
            try {
                await s3.send(
                    new CopyObjectCommand({
                        Bucket: bucket,
                        // S3 expects the source as `${bucket}/${key}` URL-encoded.
                        CopySource: `/${bucket}/${encodeURIComponent(stagedKey).replace(/%2F/g, "/")}`,
                        Key: finalKey,
                    }),
                );
            } catch (err) {
                if (isNoSuchKey(err)) {
                    throw new R2Error(
                        "R2_NOT_FOUND",
                        `Cannot commit: staged object '${stagedKey}' not found.`,
                        err,
                    );
                }
                throw new R2Error(
                    "R2_COMMIT_FAILED",
                    `Failed to copy '${stagedKey}' to '${finalKey}'.`,
                    err,
                );
            }

            try {
                await s3.send(
                    new DeleteObjectCommand({
                        Bucket: bucket,
                        Key: stagedKey,
                    }),
                );
            } catch (err) {
                if (isNoSuchKey(err)) {
                    // Nothing to delete: copy already succeeded, treat as success.
                    return { key: finalKey };
                }
                throw new R2Error(
                    "R2_COMMIT_FAILED",
                    `Failed to remove staged object '${stagedKey}' after copy.`,
                    err,
                );
            }

            return { key: finalKey };
        },

        async deleteObject(key) {
            try {
                await s3.send(
                    new DeleteObjectCommand({
                        Bucket: bucket,
                        Key: key,
                    }),
                );
            } catch (err) {
                if (isNoSuchKey(err)) {
                    return;
                }
                throw new R2Error(
                    "R2_DELETE_FAILED",
                    `Failed to delete object '${key}'.`,
                    err,
                );
            }
        },

        async presignedUrl(key, opts) {
            const expiresIn = opts?.expiresInSeconds ?? DEFAULT_EXPIRES_IN_SECONDS;
            try {
                return await getSignedUrl(
                    s3,
                    new GetObjectCommand({
                        Bucket: bucket,
                        Key: key,
                    }),
                    { expiresIn },
                );
            } catch (err) {
                throw new R2Error(
                    "R2_PRESIGN_FAILED",
                    `Failed to presign GET URL for '${key}'.`,
                    err,
                );
            }
        },

        async fetch(key) {
            try {
                const out = await s3.send(
                    new GetObjectCommand({
                        Bucket: bucket,
                        Key: key,
                    }),
                );
                const body = out.Body as
                    | { transformToByteArray?: () => Promise<Uint8Array> }
                    | undefined;
                if (!body || typeof body.transformToByteArray !== "function") {
                    return null;
                }
                return await body.transformToByteArray();
            } catch (err) {
                if (isNoSuchKey(err)) return null;
                throw new R2Error(
                    "R2_NOT_FOUND",
                    `Failed to fetch object '${key}'.`,
                    err,
                );
            }
        },
    };
}


// ---------------------------------------------------------------------------
// Local filesystem R2 client for development.
//
// Stores files under `.storage/` in the project root. Mimics the same
// interface as the real R2 client so the rest of the app doesn't know
// the difference. Only used when `NODE_ENV !== "production"`.
// ---------------------------------------------------------------------------

const LOCAL_STORAGE_DIR = path.resolve(process.cwd(), ".storage");

function ensureDir(filePath: string): void {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

function localPath(key: string): string {
    return path.join(LOCAL_STORAGE_DIR, ...key.split("/"));
}

function createLocalR2Client(): R2Client {
    return {
        async putStaged(key, bytes, _mime) {
            ensureStagedKey(key);
            const dest = localPath(key);
            ensureDir(dest);
            fs.writeFileSync(dest, bytes);
            return { key };
        },

        async commit(stagedKey, finalKey) {
            const src = localPath(stagedKey);
            const dest = localPath(finalKey);
            ensureDir(dest);
            if (fs.existsSync(src)) {
                fs.copyFileSync(src, dest);
                fs.unlinkSync(src);
            }
            return { key: finalKey };
        },

        async deleteObject(key) {
            const filePath = localPath(key);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        },

        async presignedUrl(key, _opts) {
            // In dev, just return a local path that can be served statically.
            return `/.storage/${key}`;
        },

        async fetch(key) {
            const filePath = localPath(key);
            if (!fs.existsSync(filePath)) return null;
            const buf = fs.readFileSync(filePath);
            return Uint8Array.from(buf);
        },
    };
}
