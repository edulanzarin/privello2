/**
 * Prisma test helper.
 *
 * Wraps each test in a transaction that is rolled back at the end so suites
 * stay isolated. The full implementation needs `@prisma/client` produced by
 * task 1.2's schema; until that lands we expose typed stubs so other tests
 * (e.g. property tests of validators) can import the contract without the
 * Prisma runtime being available.
 *
 * TODO(task 1.2): replace the stubs with the real Prisma rollback helper once
 * `@prisma/client` is generated and `src/lib/db.ts` exports the shared client.
 */

/**
 * Minimal subset of the Prisma transaction client we rely on in tests.
 * Kept structural so tests can mock it without importing the full Prisma
 * generated types.
 */
export interface TestDbClient {
    /** Raw escape hatch used by some tests that need ad-hoc SQL. */
    $executeRawUnsafe?: (sql: string, ...args: unknown[]) => Promise<number>;
    /** Marker so consumers know whether the helper is in stub mode. */
    readonly __stub?: true;
}

/** Symbol used to flag a deliberate rollback (so test errors are not swallowed). */
const ROLLBACK = Symbol("PRIVELLO_TEST_ROLLBACK");

/**
 * Runs `fn` inside a transaction and rolls back when it returns (success or
 * failure). Throws back the original error after the rollback so tests still
 * fail loudly.
 *
 * Until task 1.2 generates the Prisma client, this function throws to make it
 * explicit that the helper has not been wired yet.
 */
export async function withRollback<T>(
    fn: (tx: TestDbClient) => Promise<T>,
): Promise<T> {
    // Force unused-arg lint to not complain while keeping the public signature.
    void fn;
    throw new Error(
        "[tests/helpers/db] withRollback is stubbed until task 1.2 generates @prisma/client.",
    );
}

/**
 * Convenience wrapper for property-based tests that want to scope each
 * iteration of a property. Mirrors the `withRollback` shape but accepts a
 * synchronous body for properties that don't need awaits.
 */
export async function withTestDb<T>(
    fn: (tx: TestDbClient) => Promise<T>,
): Promise<T> {
    return withRollback(fn);
}

export const TEST_DB_ROLLBACK_SYMBOL = ROLLBACK;
