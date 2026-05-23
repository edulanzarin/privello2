/**
 * Feature: privello-platform, Property 4: Ciclo de vida da sessão é consistente
 *
 * For any session `s` and any instant `t`, `resolveSession(s.id)` must return
 * the session (carrying its original `userType`) **if and only if** all of the
 * following hold simultaneously:
 *
 *   1. `t >= s.createdAt`
 *   2. `t <  s.expiresAt`
 *   3. `s.revokedAt === null`
 *
 * Otherwise, it must return `null`. In particular, after `logout(s.id)` (which
 * we model with `revokeSession`), any subsequent call to `resolveSession(s.id)`
 * must return `null`, regardless of how soon it is invoked.
 *
 * The implementation in `src/server/auth/sessions.ts` reads the session row
 * via Prisma and then applies the same rules in memory. To exercise the rules
 * without a live PostgreSQL we stub `@/lib/db` with a small in-memory store
 * that mimics the surface used by `resolveSession`/`revokeSession`:
 *
 *   - `db.session.findUnique({ where: { id }, select })` returns the stored row
 *     (including `user.type`) or `null`.
 *   - `db.session.update({ where: { id }, data: { lastSeenAt } })` updates the
 *     `lastSeenAt` throttle bookkeeping.
 *   - `db.session.updateMany({ where: { id, revokedAt: null }, data })`
 *     applies the conditional revocation used by `revokeSession`.
 *
 * This keeps the property focused on the lifecycle logic — exactly what the
 * design contract describes — without coupling the test to Prisma's runtime.
 *
 * **Validates: Requirements 1.5, 1.6, 1.7**
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import * as fc from "fast-check";

// ---------------------------------------------------------------------------
// In-memory mock of `@/lib/db`
// ---------------------------------------------------------------------------
//
// `vi.mock` factories are hoisted to the top of the module, *before* the
// surrounding `const`/`let` bindings exist. To safely share state between the
// factory and the test body we wrap the store in `vi.hoisted` so it is itself
// hoisted alongside the mock.

const { sessionStore } = vi.hoisted(() => {
    type StoredSession = {
        id: string;
        userId: string;
        expiresAt: Date;
        revokedAt: Date | null;
        lastSeenAt: Date;
        user: { type: "CLIENTE" | "ACOMPANHANTE" };
    };
    const sessionStore = new Map<string, StoredSession>();
    return { sessionStore };
});

vi.mock("@/lib/db", () => {
    return {
        db: {
            session: {
                async findUnique(args: { where: { id: string } }) {
                    const row = sessionStore.get(args.where.id);
                    return row ?? null;
                },
                async update(args: {
                    where: { id: string };
                    data: { lastSeenAt?: Date; revokedAt?: Date | null };
                }) {
                    const row = sessionStore.get(args.where.id);
                    if (!row) {
                        throw new Error(
                            `mock db.session.update: no row for id=${args.where.id}`,
                        );
                    }
                    if (args.data.lastSeenAt !== undefined) {
                        row.lastSeenAt = args.data.lastSeenAt;
                    }
                    if (args.data.revokedAt !== undefined) {
                        row.revokedAt = args.data.revokedAt;
                    }
                    return row;
                },
                async updateMany(args: {
                    where: { id: string; revokedAt: Date | null };
                    data: { revokedAt?: Date | null };
                }) {
                    const row = sessionStore.get(args.where.id);
                    if (!row) {
                        return { count: 0 };
                    }
                    // Only revoke when currently active, mirroring the
                    // `revokedAt: null` filter used by `revokeSession`.
                    if (
                        args.where.revokedAt === null &&
                        row.revokedAt !== null
                    ) {
                        return { count: 0 };
                    }
                    if (args.data.revokedAt !== undefined) {
                        row.revokedAt = args.data.revokedAt;
                    }
                    return { count: 1 };
                },
            },
        },
    };
});

// Imports must come *after* `vi.mock` to ensure the stub replaces `@/lib/db`
// before `sessions.ts` is evaluated.
import { resolveSession, revokeSession } from "@/server/auth/sessions";

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

beforeEach(() => {
    sessionStore.clear();
});

/**
 * Picks a fresh, unique session id per scenario. Property runs are not
 * concurrent in the same test, so a monotonic counter is enough; we still
 * include a random suffix so that any accidental cross-iteration interaction
 * surfaces immediately as a duplicate-id assertion failure.
 */
let sessionIdCounter = 0;
function freshSessionId(): string {
    sessionIdCounter += 1;
    return `sess-${sessionIdCounter}-${Math.random().toString(36).slice(2, 10)}`;
}

// Range constants used by the arbitraries.
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const THIRTY_DAYS_MS = 30 * ONE_DAY_MS;

// Base date so we work with concrete `Date` instances. The exact value does
// not matter, only that the offsets we apply are well-defined.
const BASE_TIME_MS = Date.UTC(2025, 0, 1, 0, 0, 0);

const userTypeArb = fc.constantFrom<"CLIENTE" | "ACOMPANHANTE">(
    "CLIENTE",
    "ACOMPANHANTE",
);

/**
 * Generates a full lifecycle scenario:
 *
 *   - `createdOffsetMs`: shifts `createdAt` away from `BASE_TIME_MS` so we do
 *     not lock onto a single absolute date.
 *   - `durationMs`: positive duration in `[1ms, 30 days]`, the maximum allowed
 *     by Requirement 1.1.
 *   - `revokedOffsetMs`: optional offset (relative to `createdAt`) at which
 *     the session is logged out. `null` means "still active".
 *   - `observeOffsetMs`: instant `t` at which we call `resolveSession`,
 *     constrained to `t >= createdAt` to match physical reality.
 */
const lifecycleScenarioArb = fc.record({
    createdOffsetMs: fc.integer({ min: 0, max: 365 * ONE_DAY_MS }),
    durationMs: fc.integer({ min: 1, max: THIRTY_DAYS_MS }),
    revokedOffsetMs: fc.option(
        fc.integer({ min: 0, max: 90 * ONE_DAY_MS }),
        { nil: null },
    ),
    observeOffsetMs: fc.integer({ min: 0, max: 60 * ONE_DAY_MS }),
    userType: userTypeArb,
});

// ---------------------------------------------------------------------------
// Property tests
// ---------------------------------------------------------------------------

describe("Property 4: ciclo de vida da sessão é consistente", () => {
    it("resolveSession is non-null iff t in [createdAt, expiresAt) and revokedAt is null", async () => {
        await fc.assert(
            fc.asyncProperty(lifecycleScenarioArb, async (scenario) => {
                sessionStore.clear();

                const createdAt = new Date(
                    BASE_TIME_MS + scenario.createdOffsetMs,
                );
                const expiresAt = new Date(
                    createdAt.getTime() + scenario.durationMs,
                );
                const revokedAt =
                    scenario.revokedOffsetMs === null
                        ? null
                        : new Date(
                            createdAt.getTime() + scenario.revokedOffsetMs,
                        );
                const observeAt = new Date(
                    createdAt.getTime() + scenario.observeOffsetMs,
                );

                const sessionId = freshSessionId();
                const userId = `user-${sessionId}`;

                sessionStore.set(sessionId, {
                    id: sessionId,
                    userId,
                    expiresAt,
                    revokedAt,
                    lastSeenAt: createdAt,
                    user: { type: scenario.userType },
                });

                const result = await resolveSession(sessionId, {
                    now: observeAt,
                });

                // Reference oracle for the iff — encodes the design rule
                // exactly. `t >= createdAt` is enforced by construction
                // because `observeOffsetMs >= 0`.
                const isLive =
                    revokedAt === null &&
                    observeAt.getTime() < expiresAt.getTime();

                if (isLive) {
                    expect(
                        result,
                        "expected live session to resolve, got null",
                    ).not.toBeNull();
                    expect(result!.id).toBe(sessionId);
                    expect(result!.userId).toBe(userId);
                    expect(result!.userType).toBe(scenario.userType);
                    expect(result!.revokedAt).toBeNull();
                    expect(result!.expiresAt.getTime()).toBe(
                        expiresAt.getTime(),
                    );
                } else {
                    expect(
                        result,
                        "expected non-live session to resolve to null",
                    ).toBeNull();
                }
            }),
            { numRuns: 200 },
        );
    });

    it("after revokeSession, any subsequent resolveSession returns null", async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.record({
                    createdOffsetMs: fc.integer({ min: 0, max: 365 * ONE_DAY_MS }),
                    // Use a generous duration so the session is comfortably
                    // active at `revokeAt`/`observeAt`.
                    durationMs: fc.integer({
                        min: 60 * 60 * 1000, // 1h
                        max: THIRTY_DAYS_MS,
                    }),
                    // Where (relative to createdAt) we observe *before* logout.
                    preLogoutObserveMs: fc.integer({
                        min: 0,
                        max: 30 * 60 * 1000, // 30 min
                    }),
                    // Additional delay between logout and the post-logout
                    // observation. Even 0 ms must produce `null`.
                    postLogoutObserveMs: fc.integer({
                        min: 0,
                        max: 24 * 60 * 60 * 1000,
                    }),
                    userType: userTypeArb,
                }),
                async (s) => {
                    sessionStore.clear();

                    const createdAt = new Date(
                        BASE_TIME_MS + s.createdOffsetMs,
                    );
                    const expiresAt = new Date(
                        createdAt.getTime() + s.durationMs,
                    );

                    const sessionId = freshSessionId();
                    const userId = `user-${sessionId}`;

                    sessionStore.set(sessionId, {
                        id: sessionId,
                        userId,
                        expiresAt,
                        revokedAt: null,
                        lastSeenAt: createdAt,
                        user: { type: s.userType },
                    });

                    // Sanity: while still active, the session resolves.
                    const before = await resolveSession(sessionId, {
                        now: new Date(
                            createdAt.getTime() + s.preLogoutObserveMs,
                        ),
                    });
                    expect(before).not.toBeNull();
                    expect(before!.userType).toBe(s.userType);

                    // Logout.
                    await revokeSession(sessionId);

                    // Any subsequent observation, regardless of how soon, must
                    // yield null. We test at `now = revokedAt + delta` where
                    // delta >= 0.
                    const stored = sessionStore.get(sessionId)!;
                    expect(stored.revokedAt).not.toBeNull();
                    const after = await resolveSession(sessionId, {
                        now: new Date(
                            stored.revokedAt!.getTime() +
                            s.postLogoutObserveMs,
                        ),
                    });
                    expect(after).toBeNull();
                },
            ),
            { numRuns: 100 },
        );
    });
});
