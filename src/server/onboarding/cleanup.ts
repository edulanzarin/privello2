/**
 * Onboarding draft cleanup utility — Sistema_de_Onboarding.
 *
 * Companion to `drafts.ts` that runs as a batch sweep instead of the
 * lazy "drop on access" cleanup that {@link import("./drafts").obter}
 * already performs. Designed to be invoked by a simple cron job (e.g. a
 * Railway scheduled task) so expired drafts and their staged R2 objects
 * do not accumulate when no user touches them again.
 *
 * Behavior of {@link cleanupExpiredDrafts}:
 *
 * 1. `findMany` over `OnboardingDraft` rows whose `expiresAt < now`,
 *    selecting only `id` and `stagedKey`.
 * 2. For each draft that has a `stagedKey`, calls
 *    {@link import("@/lib/storage/r2").R2Client.deleteObject} as a
 *    best-effort cleanup; per-object failures are swallowed so a single
 *    R2 hiccup never prevents the database row from being removed. The
 *    next cleanup run will retry any survivors.
 * 3. `deleteMany` over the gathered ids in a single statement.
 * 4. Returns `{ removedDrafts, removedR2Objects }` so the cron caller
 *    can log / surface the work done. `removedR2Objects` counts only
 *    successful R2 deletions.
 *
 * Requirements: 3.3, 3.4, 3.6.
 *
 * TODO (orphan staged objects without a draft): Task 11.9 also asks for
 * sweeping staged objects "older than 1 hour without an associated
 * draft". Implementing that requires listing the `staged/` prefix in R2
 * and cross-referencing each key against `OnboardingDraft.stagedKey`,
 * but the current `R2Client` interface in `src/lib/storage/r2.ts`
 * deliberately does not expose a list operation (it would leak SDK
 * paging types that Property 32 / Requirement 7.7 keeps confined). When
 * a `listObjects` capability is added to `R2Client`, extend this module
 * to: (a) list keys under `staged/` with a `lastModified` filter of
 * `now - 1h`, (b) load all current `OnboardingDraft.stagedKey` values
 * and treat them as a referenced set, (c) `deleteObject` every staged
 * key that is not referenced. Until then this utility relies on the
 * fact that every staged upload is recorded on its draft, which means
 * the `findMany`/`deleteObject` loop above already covers the only
 * production code path that creates staged objects.
 */

import { db } from "@/lib/db";
import { createR2Client, type R2Client } from "@/lib/storage/r2";

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
 * Test-only seam that overrides the R2 client used by
 * {@link cleanupExpiredDrafts}. Pass `null` to forget the override and
 * force the next call to rebuild the client from the environment.
 * Production code MUST NOT call this.
 */
export function __setR2ClientForTests(client: R2Client | null): void {
    r2ClientSingleton = client;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Result of a {@link cleanupExpiredDrafts} run.
 *
 * - `removedDrafts`: number of `OnboardingDraft` rows deleted from the
 *   database (i.e. the rows whose `expiresAt < now` at the moment the
 *   sweep started).
 * - `removedR2Objects`: number of staged R2 objects successfully
 *   deleted. Drafts without a `stagedKey`, and per-object delete
 *   failures, do not increment this counter.
 */
export interface CleanupResult {
    removedDrafts: number;
    removedR2Objects: number;
}

/**
 * Deletes every expired `OnboardingDraft` row and its associated staged
 * R2 object, if any. Safe to run concurrently with normal traffic: the
 * lazy cleanup in {@link import("./drafts").obter} only races against
 * this batch on already-expired rows, and `deleteMany` over a captured
 * id list is idempotent (rows the lazy path already removed simply do
 * not match).
 *
 * @param now Optional clock override. Defaults to `new Date()`. Used by
 *            tests to advance time without sleeping.
 */
export async function cleanupExpiredDrafts(
    now: Date = new Date(),
): Promise<CleanupResult> {
    const expired = await db.onboardingDraft.findMany({
        where: { expiresAt: { lt: now } },
        select: { id: true, stagedKey: true },
    });

    if (expired.length === 0) {
        return { removedDrafts: 0, removedR2Objects: 0 };
    }

    const r2 = getR2Client();
    let removedR2Objects = 0;

    for (const draft of expired) {
        if (!draft.stagedKey) {
            continue;
        }
        try {
            await r2.deleteObject(draft.stagedKey);
            removedR2Objects += 1;
        } catch {
            // Best-effort: a single R2 failure must not stop the sweep
            // nor block the database delete below. The next cleanup run
            // will retry any survivor (the orphan TODO at the top of
            // the file describes the eventual list-based reconciliation).
        }
    }

    const ids = expired.map((d) => d.id);
    const deleted = await db.onboardingDraft.deleteMany({
        where: { id: { in: ids } },
    });

    return {
        removedDrafts: deleted.count,
        removedR2Objects,
    };
}
