/**
 * Onboarding draft service — Sistema_de_Onboarding.
 *
 * Owns the lifecycle of the partial state collected during the multi-step
 * Onboarding_Acompanhante flow described in `design.md`:
 *
 * - {@link iniciar} opens a fresh draft with an empty payload.
 * - {@link atualizarEtapa} merges a patch into the payload (shallow,
 *   last-write-wins per key) and resets the 60-minute inactivity window.
 * - {@link obter} reads a draft, returning `null` (and lazily cleaning up)
 *   when the draft has expired.
 * - {@link uploadFoto} validates the Foto_de_Perfil, writes the bytes to
 *   `staged/<uuid>` in Cloudflare R2 and records the resulting key on the
 *   draft so {@link descartar} / `finalizar` can move it forward.
 * - {@link descartar} removes the draft row plus the staged Foto_de_Perfil
 *   in Cloudflare R2, if any.
 *
 * Each draft has `expiresAt = updatedAt + 60 minutes` (Requirements 3.3 and
 * 3.4). Browsers track the active draft via the `onboardingId` cookie
 * exposed by {@link serializeOnboardingCookie} / {@link parseOnboardingCookie}.
 * The cookie is HttpOnly + SameSite=Lax with a max-age slightly larger
 * than the server-side TTL so the browser still sends the id when the
 * user returns near the end of the window. The id is an opaque UUID and
 * does not need an HMAC: it is only useful while the row exists and is not
 * expired.
 *
 * Requirements: 3.2, 3.3, 3.4, 3.10.
 */

import type { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { validarFotoPerfil } from "@/domain/validation";
import { createR2Client, type R2Client } from "@/lib/storage/r2";
import {
    InvalidProfilePhotoError,
    stageProfilePhoto,
    __setR2ClientForTests as __setProfileMediaR2,
} from "@/server/storage/profileMedia";

/**
 * Alias legado mantido para compatibilidade com os consumidores que já
 * importavam `InvalidFotoPerfilError` deste módulo (testes, server
 * actions e mensagens de UI). Estruturalmente é o mesmo erro
 * canônico em `@/server/storage/profileMedia`, então
 * `instanceof InvalidFotoPerfilError` continua válido nos dois caminhos
 * (Onboarding_Acompanhante e cadastro de Cliente).
 */
const InvalidFotoPerfilError = InvalidProfilePhotoError;
export { InvalidFotoPerfilError };
export type { InvalidProfilePhotoError as InvalidFotoPerfilErrorType } from "@/server/storage/profileMedia";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Inactivity TTL for an onboarding draft (60 minutes, Requirement 3.3). */
export const DRAFT_TTL_MS = 60 * 60 * 1000;

/** Name of the cookie that carries the opaque draft id. */
export const ONBOARDING_COOKIE_NAME = "onboardingId";

/**
 * Lifetime of the cookie in seconds. A few minutes longer than the
 * server-side TTL so the browser does not drop the cookie just before the
 * server has a chance to surface the "draft expired" UX.
 */
export const ONBOARDING_COOKIE_MAX_AGE_SECONDS = 65 * 60;

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/**
 * Thrown by {@link atualizarEtapa} when the supplied `onboardingId` does
 * not correspond to any draft row.
 */
export class DraftNotFoundError extends Error {
    public readonly code = "DRAFT_NOT_FOUND" as const;

    constructor(onboardingId: string) {
        super(`Onboarding draft '${onboardingId}' not found.`);
        this.name = "DraftNotFoundError";
    }
}

/**
 * Thrown by {@link atualizarEtapa} when the draft is found but its
 * `expiresAt` has already elapsed (Requirement 3.4).
 */
export class DraftExpiredError extends Error {
    public readonly code = "DRAFT_EXPIRED" as const;

    constructor(onboardingId: string) {
        super(`Onboarding draft '${onboardingId}' has expired.`);
        this.name = "DraftExpiredError";
    }
}

/**
 * Thrown by {@link uploadFoto} when the supplied file fails the
 * {@link validarFotoPerfil} check (MIME type or size). Refusing the upload
 * before touching R2 keeps the staging area free of invalid blobs
 * (Requirement 3.10).
 *
 * O erro canônico vive em `@/server/storage/profileMedia` e é
 * compartilhado com o cadastro de Cliente; aqui apenas re-exportamos
 * com o nome legado para preservar consumidores existentes.
 */

// ---------------------------------------------------------------------------
// R2 client (lazy + test seam)
// ---------------------------------------------------------------------------

let r2ClientSingleton: R2Client | null = null;

function getR2Client(): R2Client {
    if (!r2ClientSingleton) {
        r2ClientSingleton = createR2Client();
    }
    return r2ClientSingleton;
}

/**
 * Test-only seam que substitui o `R2Client` usado por todos os helpers
 * de mídia de perfil (compartilhados entre `Sistema_de_Onboarding` e
 * `Sistema_de_Cadastro_Cliente`). Mantido aqui por compatibilidade com
 * os testes existentes que importam de `@/server/onboarding/drafts`.
 *
 * Pass `null` para esquecer o override e forçar a próxima chamada a
 * reconstruir o cliente a partir de `process.env`. Production code
 * MUST NOT call this.
 */
export function __setR2ClientForTests(client: R2Client | null): void {
    r2ClientSingleton = client;
    __setProfileMediaR2(client);
}

// ---------------------------------------------------------------------------
// Public payload + helpers
// ---------------------------------------------------------------------------

/**
 * Drafts hold arbitrary JSON-serialisable maps. The exact shape is defined
 * by the onboarding steps in `design.md` (`OnboardingData`); this module
 * deliberately stays schema-agnostic so each step can evolve independently.
 */
export type DraftPayload = Record<string, unknown>;

interface NowOptions {
    /**
     * Override the current time. Used by tests covering the lifecycle
     * (Properties 13 and 14) so they can step the clock forward without
     * sleeping. Defaults to `new Date()`.
     */
    now?: Date;
}

function resolveNow(opts?: NowOptions): Date {
    return opts?.now ?? new Date();
}

function plusTtl(now: Date): Date {
    return new Date(now.getTime() + DRAFT_TTL_MS);
}

/**
 * Coerces a Prisma `Json` value back to {@link DraftPayload}. Drafts are
 * always written with a plain object payload, but `Prisma.JsonValue` also
 * allows scalars and arrays so we narrow defensively.
 */
function asPayload(value: Prisma.JsonValue): DraftPayload {
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
        return value as DraftPayload;
    }
    return {};
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Creates a new draft row with an empty payload. The returned
 * `onboardingId` is the value to place in the `onboardingId` cookie via
 * {@link serializeOnboardingCookie}. `expiresAt` is `now + 60 minutes`.
 */
export async function iniciar(
    opts?: NowOptions,
): Promise<{ onboardingId: string; expiresAt: Date }> {
    const now = resolveNow(opts);
    const expiresAt = plusTtl(now);

    const draft = await db.onboardingDraft.create({
        data: {
            payload: {} as Prisma.InputJsonValue,
            expiresAt,
        },
        select: { id: true, expiresAt: true },
    });

    return { onboardingId: draft.id, expiresAt: draft.expiresAt };
}

/**
 * Merges `patch` into the draft payload using a shallow object spread
 * (last-write-wins per top-level key, Requirement 3.2 / Property 13),
 * bumps `updatedAt` to `now` and `expiresAt` to `now + 60 minutes`.
 *
 * @throws {DraftNotFoundError} when the id is unknown.
 * @throws {DraftExpiredError} when the draft expired before the call.
 */
export async function atualizarEtapa(
    onboardingId: string,
    patch: DraftPayload,
    opts?: NowOptions,
): Promise<{
    onboardingId: string;
    data: DraftPayload;
    expiresAt: Date;
}> {
    const now = resolveNow(opts);

    const existing = await db.onboardingDraft.findUnique({
        where: { id: onboardingId },
        select: { id: true, payload: true, expiresAt: true },
    });

    if (!existing) {
        throw new DraftNotFoundError(onboardingId);
    }

    if (existing.expiresAt.getTime() <= now.getTime()) {
        throw new DraftExpiredError(onboardingId);
    }

    const merged: DraftPayload = { ...asPayload(existing.payload), ...patch };
    const expiresAt = plusTtl(now);

    const updated = await db.onboardingDraft.update({
        where: { id: onboardingId },
        data: {
            payload: merged as Prisma.InputJsonValue,
            expiresAt,
        },
        select: { id: true, payload: true, expiresAt: true },
    });

    return {
        onboardingId: updated.id,
        data: asPayload(updated.payload),
        expiresAt: updated.expiresAt,
    };
}

/**
 * Uploads the Foto_de_Perfil for the active onboarding draft.
 *
 * Validates `mimeType` and `sizeBytes` with {@link validarFotoPerfil}
 * (Requirement 3.10) BEFORE touching R2, so an invalid file never produces
 * a staged object. Generates a fresh `staged/<uuid>` key, writes the bytes
 * via {@link R2Client.putStaged}, and records the key on the draft row.
 *
 * If the draft already had a previous staged photo, that earlier object is
 * deleted (best-effort) after the new one is recorded so storage does not
 * accumulate orphans when the user re-uploads. R2 failures during this
 * cleanup are swallowed; the periodic sweep (task 11.9) eventually reaps
 * any survivor.
 *
 * The call also bumps `updatedAt`/`expiresAt` to `now + 60 minutes`,
 * matching {@link atualizarEtapa}.
 *
 * @throws {DraftNotFoundError} when the id is unknown.
 * @throws {DraftExpiredError} when the draft expired before the call.
 * @throws {InvalidFotoPerfilError} when MIME or size violate Requirement 3.10.
 * @throws {Error} R2 upload errors propagate as `R2Error` from
 *   `lib/storage/r2`. Callers should surface them as a generic upload
 *   failure to the UI.
 */
export async function uploadFoto(
    onboardingId: string,
    file: { mimeType: string; bytes: Uint8Array | Buffer },
    opts?: NowOptions,
): Promise<{ stagedKey: string }> {
    // Validação canônica de MIME/tamanho **antes** de qualquer I/O
    // (DB ou R2). Mantemos a checagem aqui (e não delegamos só ao
    // staging) para preservar a ordem de erros observada pela UI:
    // `InvalidFotoPerfilError` precede `DraftExpiredError` /
    // `DraftNotFoundError`, evitando relatar "draft expirado" quando o
    // problema real é o arquivo. O `stageProfilePhoto` revalida antes
    // do put como defesa em profundidade.
    const sizeBytes = file.bytes.byteLength;
    if (!validarFotoPerfil({ mimeType: file.mimeType, sizeBytes })) {
        throw new InvalidFotoPerfilError();
    }

    const now = resolveNow(opts);

    const existing = await db.onboardingDraft.findUnique({
        where: { id: onboardingId },
        select: { id: true, stagedKey: true, expiresAt: true },
    });

    if (!existing) {
        throw new DraftNotFoundError(onboardingId);
    }

    if (existing.expiresAt.getTime() <= now.getTime()) {
        throw new DraftExpiredError(onboardingId);
    }

    // Delegamos o staging em R2 para o helper compartilhado. A camada
    // de draft fica responsável apenas pela parte específica do
    // `OnboardingDraft`: persistir a chave gerada e descartar a chave
    // anterior, se houver.
    const { stagedKey } = await stageProfilePhoto({
        mimeType: file.mimeType,
        bytes: file.bytes,
    });

    const expiresAt = plusTtl(now);

    try {
        await db.onboardingDraft.update({
            where: { id: onboardingId },
            data: { stagedKey, expiresAt },
        });
    } catch (err) {
        // Persisting the new key failed: undo the upload so the staging
        // area does not accumulate orphans tied to a draft that never
        // learned about the object.
        try {
            await getR2Client().deleteObject(stagedKey);
        } catch {
            // Best-effort: swept by the periodic cleanup (task 11.9).
        }
        throw err;
    }

    if (existing.stagedKey && existing.stagedKey !== stagedKey) {
        try {
            await getR2Client().deleteObject(existing.stagedKey);
        } catch {
            // Best-effort: swept by the periodic cleanup (task 11.9).
        }
    }

    return { stagedKey };
}

/**
 * Reads a draft. Returns `null` when the row is missing or expired. When
 * the draft is found but expired, the row (and the staged photo, if any)
 * is removed via {@link descartar} as a lazy cleanup, satisfying the
 * "discard expired drafts" half of Requirement 3.4.
 */
export async function obter(
    onboardingId: string,
    opts?: NowOptions,
): Promise<{
    data: DraftPayload;
    stagedKey: string | null;
    expiresAt: Date;
} | null> {
    const now = resolveNow(opts);

    const draft = await db.onboardingDraft.findUnique({
        where: { id: onboardingId },
        select: {
            id: true,
            payload: true,
            stagedKey: true,
            expiresAt: true,
        },
    });

    if (!draft) {
        return null;
    }

    if (draft.expiresAt.getTime() <= now.getTime()) {
        await descartar(onboardingId);
        return null;
    }

    return {
        data: asPayload(draft.payload),
        stagedKey: draft.stagedKey,
        expiresAt: draft.expiresAt,
    };
}

/**
 * Removes the draft row and any staged R2 object uploaded for it. R2
 * failures are swallowed: the database row is the source of truth, and
 * orphaned `staged/` objects are reaped by the periodic cleanup job
 * described in `design.md` (Sistema_de_Onboarding, Requirement 3.6).
 *
 * Calling `descartar` on an unknown id is a no-op.
 */
export async function descartar(onboardingId: string): Promise<void> {
    const draft = await db.onboardingDraft.findUnique({
        where: { id: onboardingId },
        select: { stagedKey: true },
    });

    if (!draft) {
        return;
    }

    if (draft.stagedKey) {
        try {
            await getR2Client().deleteObject(draft.stagedKey);
        } catch {
            // Best-effort: orphan staged objects are swept by the
            // cleanup task wired in 11.9. Swallowing keeps the DB row
            // deletion below unconditional.
        }
    }

    try {
        await db.onboardingDraft.delete({ where: { id: onboardingId } });
    } catch {
        // Concurrent deletion is acceptable — the post-condition (no row
        // for `onboardingId`) already holds.
    }
}

// ---------------------------------------------------------------------------
// Cookie helpers
// ---------------------------------------------------------------------------

/**
 * Builds the `Set-Cookie` value for the opaque `onboardingId` cookie. The
 * cookie is `HttpOnly` and `SameSite=Lax`, scoped to the whole site, and
 * lives for {@link ONBOARDING_COOKIE_MAX_AGE_SECONDS}. `Secure` is added
 * when running in production so the cookie never travels over plain HTTP.
 */
export function serializeOnboardingCookie(onboardingId: string): string {
    const parts = [
        `${ONBOARDING_COOKIE_NAME}=${encodeURIComponent(onboardingId)}`,
        "Path=/",
        `Max-Age=${ONBOARDING_COOKIE_MAX_AGE_SECONDS}`,
        "HttpOnly",
        "SameSite=Lax",
    ];

    if (process.env.NODE_ENV === "production") {
        parts.push("Secure");
    }

    return parts.join("; ");
}

/**
 * Extracts the `onboardingId` value from a raw `Cookie` header (e.g.
 * `"onboardingId=abc123; theme=dark"`). Returns `null` when the header is
 * missing, when the cookie is absent, or when the value cannot be decoded.
 */
export function parseOnboardingCookie(
    value: string | null | undefined,
): string | null {
    if (!value) {
        return null;
    }

    for (const segment of value.split(";")) {
        const eq = segment.indexOf("=");
        if (eq === -1) {
            continue;
        }
        const name = segment.slice(0, eq).trim();
        if (name !== ONBOARDING_COOKIE_NAME) {
            continue;
        }
        const raw = segment.slice(eq + 1).trim();
        if (!raw) {
            return null;
        }
        try {
            return decodeURIComponent(raw);
        } catch {
            return null;
        }
    }

    return null;
}
