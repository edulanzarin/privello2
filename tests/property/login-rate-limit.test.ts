/**
 * Feature: privello-platform, Property 5: Rate limit por email aplica corte
 * exato em 5 falhas em 15 minutos.
 *
 * For any email `e` and any history `H` of `LoginAttempt` rows for that
 * email, define
 *
 *     n = | { a in H | a.success === false  AND  (t - a.createdAt) < 15min } |
 *
 * Then `login(e, _, { now: t })` returns
 *
 *   - `{ ok: false, reason: "RATE_LIMITED" }` if and only if `n >= 5`;
 *   - otherwise the call proceeds normally to credential verification (and
 *     therefore the result is determined by whether the email exists and
 *     the password matches).
 *
 * Notes:
 *   - The cutoff is **strict at 5**: 4 within-window failures must still
 *     allow verification; the 5th already blocks. This boundary is also
 *     exercised by two dedicated example tests at the bottom of the file.
 *   - The 15-minute window is half-open: failures whose age is `>= 15min`
 *     do not count. Our generators stay strictly inside `(0, 15min)` for
 *     within-window and `> 15min` for outside-window so the test never sits
 *     on the exact boundary (which would conflate two unrelated corner
 *     cases).
 *   - Because the login service performs the failure count + the user
 *     lookup inside a single `prisma.$transaction`, we mock `@/lib/db`
 *     with an in-memory store that exposes the same surface (`$transaction`
 *     applies the callback against the store directly) and provides a
 *     `loginAttempt.createMany` method used by the test to pre-seed the
 *     history per iteration, as required by the task.
 *   - `verifyPassword` is mocked as a deterministic string compare so the
 *     property runs in milliseconds rather than seconds. The actual
 *     argon2 round-trip is covered by Property 1.
 *
 * **Validates: Requirements 1.8**
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import * as fc from "fast-check";

// ---------------------------------------------------------------------------
// In-memory mock of `@/lib/db`
// ---------------------------------------------------------------------------
//
// `vi.hoisted` lifts the shared store next to `vi.mock`, so the factory can
// see it. We expose only the surface that `src/server/auth/login.ts` and the
// test pre-seed step actually reach for: `loginAttempt.{count,create,createMany}`,
// `user.findUnique`, `session.create` and `$transaction`. Anything else
// purposefully throws so a regression that drifts off-script blows up loudly.

const { state } = vi.hoisted(() => {
    type LoginAttemptRow = {
        id: string;
        email: string;
        success: boolean;
        userId: string | null;
        createdAt: Date;
    };
    type UserRow = {
        id: string;
        email: string;
        type: "CLIENTE" | "ACOMPANHANTE";
        passwordHash: string;
    };
    type SessionRow = {
        id: string;
        userId: string;
        expiresAt: Date;
        revokedAt: Date | null;
        createdAt: Date;
        lastSeenAt: Date;
    };
    const state = {
        usersByEmail: new Map<string, UserRow>(),
        attempts: [] as LoginAttemptRow[],
        sessions: [] as SessionRow[],
        nextAttemptId: 0,
        nextSessionId: 0,
    };
    return { state };
});

type CountWhere = {
    email: string;
    success: boolean;
    createdAt: { gt: Date; lte: Date };
};

type CreateAttemptArgs = {
    data: {
        email: string;
        success: boolean;
        userId: string | null;
        createdAt: Date;
    };
};

type CreateManyAttemptArgs = {
    data: Array<CreateAttemptArgs["data"]>;
};

type FindUserArgs = {
    where: { email: string };
    select?: Partial<Record<"id" | "type" | "passwordHash" | "email", boolean>>;
};

type CreateSessionArgs = {
    data: {
        userId: string;
        createdAt: Date;
        expiresAt: Date;
        lastSeenAt: Date;
    };
    select?: Partial<
        Record<"id" | "userId" | "expiresAt" | "revokedAt", boolean>
    >;
};

vi.mock("@/lib/db", () => {
    function pick<T extends Record<string, unknown>>(
        row: T,
        select?: Partial<Record<keyof T, boolean>>,
    ): Partial<T> {
        if (!select) return { ...row };
        const out: Record<string, unknown> = {};
        for (const k of Object.keys(select) as Array<keyof T>) {
            if (select[k]) out[k as string] = row[k];
        }
        return out as Partial<T>;
    }

    const client = {
        loginAttempt: {
            async count({ where }: { where: CountWhere }) {
                return state.attempts.filter(
                    (a) =>
                        a.email === where.email &&
                        a.success === where.success &&
                        a.createdAt.getTime() > where.createdAt.gt.getTime() &&
                        a.createdAt.getTime() <= where.createdAt.lte.getTime(),
                ).length;
            },
            async create({ data }: CreateAttemptArgs) {
                state.nextAttemptId += 1;
                const row = {
                    id: `attempt-${state.nextAttemptId}`,
                    ...data,
                };
                state.attempts.push(row);
                return row;
            },
            async createMany({ data }: CreateManyAttemptArgs) {
                for (const d of data) {
                    state.nextAttemptId += 1;
                    state.attempts.push({
                        id: `attempt-${state.nextAttemptId}`,
                        ...d,
                    });
                }
                return { count: data.length };
            },
        },
        user: {
            async findUnique({ where, select }: FindUserArgs) {
                const u = state.usersByEmail.get(where.email);
                if (!u) return null;
                return pick(u, select);
            },
        },
        session: {
            async create({ data, select }: CreateSessionArgs) {
                state.nextSessionId += 1;
                const row = {
                    id: `session-${state.nextSessionId}`,
                    userId: data.userId,
                    createdAt: data.createdAt,
                    expiresAt: data.expiresAt,
                    lastSeenAt: data.lastSeenAt,
                    revokedAt: null as Date | null,
                };
                state.sessions.push(row);
                return pick(row, select);
            },
        },
    };

    return {
        db: {
            ...client,
            async $transaction<T>(
                cb: (tx: typeof client) => Promise<T>,
            ): Promise<T> {
                return cb(client);
            },
        },
    };
});

// `verifyPassword` is mocked with a trivial deterministic check so the test
// completes in milliseconds. The argon2 round-trip is covered by Property 1.
vi.mock("@/domain/auth/password", () => ({
    verifyPassword: vi.fn(
        async (plain: string, hashStr: string) => hashStr === `hash:${plain}`,
    ),
}));

// Imports MUST come after `vi.mock` so the stubs are wired before
// `src/server/auth/login.ts` is evaluated.
import { login } from "@/server/auth/login";

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

beforeEach(() => {
    state.usersByEmail.clear();
    state.attempts = [];
    state.sessions = [];
    state.nextAttemptId = 0;
    state.nextSessionId = 0;
});

const ANCHOR_MS = Date.UTC(2025, 5, 15, 12, 0, 0); // 2025-06-15T12:00:00Z
const FIFTEEN_MIN_MS = 15 * 60 * 1000;

const TEST_EMAIL = "user@example.com";
const GOOD_PASSWORD = "GoodPass!1234";
const WRONG_PASSWORD = "WrongPass!1234";
const PASSWORD_HASH = `hash:${GOOD_PASSWORD}`;

/** Inserts a user keyed by `TEST_EMAIL` into the store. */
function seedUser(): void {
    state.usersByEmail.set(TEST_EMAIL, {
        id: "user-1",
        email: TEST_EMAIL,
        type: "CLIENTE",
        passwordHash: PASSWORD_HASH,
    });
}

/**
 * Pre-seed `LoginAttempt` rows via `db.loginAttempt.createMany`, exactly as
 * the task description prescribes. Ages are expressed in milliseconds
 * relative to `ANCHOR_MS` (the clock injected into `login`). Positive ages
 * place the attempt in the past, which is the only physically meaningful
 * case for the rate-limit window.
 */
async function preSeedFailedAttempts(agesMs: ReadonlyArray<number>): Promise<void> {
    if (agesMs.length === 0) return;
    const { db } = await import("@/lib/db");
    await db.loginAttempt.createMany({
        data: agesMs.map((ageMs) => ({
            email: TEST_EMAIL,
            success: false,
            userId: null,
            createdAt: new Date(ANCHOR_MS - ageMs),
        })),
    });
}

// ---------------------------------------------------------------------------
// Property
// ---------------------------------------------------------------------------

const scenarioArb = fc.record({
    /**
     * Ages of failures **inside** the 15-minute window. Each age is in
     * `(0, 15min)`, never on the boundary, so the count of these entries is
     * exactly the property's `n`.
     */
    withinAgesMs: fc.array(
        fc.integer({ min: 1, max: FIFTEEN_MIN_MS - 1 }),
        { minLength: 0, maxLength: 10 },
    ),
    /**
     * Ages of failures **outside** the 15-minute window. These must NOT
     * count toward `n`. We push them to `> 15min` so we never collide with
     * the boundary.
     */
    outsideAgesMs: fc.array(
        fc.integer({ min: FIFTEEN_MIN_MS + 1, max: 3 * FIFTEEN_MIN_MS }),
        { minLength: 0, maxLength: 10 },
    ),
    /** Whether the user actually exists. Drives the not-rate-limited branch. */
    userExists: fc.boolean(),
    /** When `userExists`, whether the supplied password is the correct one. */
    correctPassword: fc.boolean(),
});

describe("Property 5: rate limit por email aplica corte exato em 5 falhas em 15 minutos", () => {
    it(
        "login(e, _, { now: t }) returns RATE_LIMITED iff n >= 5; otherwise proceeds to verification",
        { timeout: 60_000 },
        async () => {
            await fc.assert(
                fc.asyncProperty(scenarioArb, async (s) => {
                    state.usersByEmail.clear();
                    state.attempts = [];
                    state.sessions = [];
                    state.nextAttemptId = 0;
                    state.nextSessionId = 0;

                    if (s.userExists) seedUser();

                    await preSeedFailedAttempts([
                        ...s.withinAgesMs,
                        ...s.outsideAgesMs,
                    ]);

                    const password = s.correctPassword
                        ? GOOD_PASSWORD
                        : WRONG_PASSWORD;

                    const result = await login(TEST_EMAIL, password, {
                        now: new Date(ANCHOR_MS),
                    });

                    const n = s.withinAgesMs.length;

                    if (n >= 5) {
                        // Cutoff at >= 5: must be RATE_LIMITED, regardless of
                        // whether the user exists or the password is correct.
                        expect(result.ok).toBe(false);
                        if (result.ok === false) {
                            expect(result.reason).toBe("RATE_LIMITED");
                        }
                        // No new attempt is recorded on rate-limited responses
                        // and no session is created.
                        expect(state.attempts.length).toBe(
                            s.withinAgesMs.length + s.outsideAgesMs.length,
                        );
                        expect(state.sessions.length).toBe(0);
                    } else {
                        // n < 5: must proceed to credential verification.
                        // The result is determined by `userExists` and
                        // `correctPassword`; in particular it is NEVER
                        // `RATE_LIMITED`.
                        if (result.ok === false) {
                            expect(result.reason).toBe("INVALID_CREDENTIALS");
                        }
                        if (s.userExists && s.correctPassword) {
                            expect(result.ok).toBe(true);
                            expect(state.sessions.length).toBe(1);
                        } else {
                            expect(result.ok).toBe(false);
                            if (result.ok === false) {
                                expect(result.reason).toBe(
                                    "INVALID_CREDENTIALS",
                                );
                            }
                            expect(state.sessions.length).toBe(0);
                        }
                    }
                }),
                { numRuns: 50 },
            );
        },
    );

    // -----------------------------------------------------------------------
    // Boundary witnesses for the exact ">= 5" cutoff (task requirement).
    // -----------------------------------------------------------------------

    it("4 within-window failures still allow credential verification", async () => {
        seedUser();

        // 4 failures inside the window + a couple outside it (which must
        // not contribute to the count).
        await preSeedFailedAttempts([
            60_000,
            2 * 60_000,
            5 * 60_000,
            10 * 60_000,
            20 * 60_000, // outside
            45 * 60_000, // outside
        ]);

        const result = await login(TEST_EMAIL, GOOD_PASSWORD, {
            now: new Date(ANCHOR_MS),
        });

        // n = 4, so we are NOT rate-limited and credentials are valid.
        expect(result.ok).toBe(true);
        if (result.ok === true) {
            expect(result.session.userId).toBe("user-1");
        }
    });

    it("5 within-window failures already block (RATE_LIMITED)", async () => {
        seedUser();

        await preSeedFailedAttempts([
            60_000,
            2 * 60_000,
            5 * 60_000,
            10 * 60_000,
            14 * 60_000,
            // outside-window noise that must not change the answer
            16 * 60_000,
            60 * 60_000,
        ]);

        const before = state.attempts.length;
        const result = await login(TEST_EMAIL, GOOD_PASSWORD, {
            now: new Date(ANCHOR_MS),
        });

        expect(result.ok).toBe(false);
        if (result.ok === false) {
            expect(result.reason).toBe("RATE_LIMITED");
        }
        // Rate-limited path short-circuits before recording any new attempt
        // or creating any session.
        expect(state.attempts.length).toBe(before);
        expect(state.sessions.length).toBe(0);
    });
});
