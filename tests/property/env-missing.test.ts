/**
 * Property test for missing environment variables.
 *
 * **Property 31: Falha de variáveis obrigatórias é determinística e completa**
 *
 * **Validates: Requirements 7.5**
 *
 * Para subconjuntos não-vazios de variáveis obrigatórias, executar
 * `validateEnv` e verificar que a mensagem de erro nomeia exatamente as
 * ausentes e o exit code do `scripts/check-env.js` é diferente de zero.
 *
 * Two complementary properties cover the requirement end-to-end:
 *
 * 1. **`validateEnv`** (in-process): given a fully-populated env, removing or
 *    blanking any non-empty subset of `ENV_KEYS` causes `validateEnv` to throw
 *    `EnvValidationError` whose `.missing` is exactly that subset in
 *    `ENV_KEYS` order, and `.invalid` is empty.
 * 2. **`scripts/check-env.js`** (spawned): the same partial env, when used to
 *    invoke the gate script, makes the process exit with a non-zero status
 *    and emit stderr that names every removed key.
 */

import { spawnSync } from "node:child_process";
import * as path from "node:path";

import * as fc from "fast-check";
import { describe, expect, it } from "vitest";

import { ENV_KEYS, EnvValidationError, validateEnv } from "../../src/lib/env";

/**
 * Valid placeholder values that satisfy `ENV_SCHEMA` for every key. Keeping
 * them as plain strings (no constructors) makes the test deterministic and
 * independent from any external process state.
 */
const PLACEHOLDERS: Record<(typeof ENV_KEYS)[number], string> = {
    DATABASE_URL: "postgresql://x:y@h:5432/d",
    SESSION_SECRET: "supersecretsessionkey1234",
    PORT: "3000",
    R2_ACCOUNT_ID: "acct-id",
    R2_ACCESS_KEY_ID: "access-key-id",
    R2_SECRET_ACCESS_KEY: "secret-access-key",
    R2_BUCKET: "bucket",
    R2_PUBLIC_BASE_URL: "https://example.com",
    IBGE_BASE_URL: "https://servicodados.ibge.gov.br/api",
    IBGE_CACHE_TTL_HOURS: "72",
};

/**
 * Picks a non-empty subset of `ENV_KEYS`. `fc.subarray` already preserves the
 * original array order, so `subset` is guaranteed to be in `ENV_KEYS` order.
 */
const subsetArb = fc
    .subarray([...ENV_KEYS] as unknown as string[])
    .filter((s) => s.length > 0);

/**
 * Builds a partial env: starts from `base`, removes every key in `ENV_KEYS`,
 * then re-adds the placeholder for every key NOT in `subset`. Keys in
 * `subset` are either left absent or set to the empty string, depending on
 * `setEmpty`.
 */
function buildPartialEnv(
    subset: string[],
    base: NodeJS.ProcessEnv,
    setEmpty: boolean,
): NodeJS.ProcessEnv {
    const env: NodeJS.ProcessEnv = { ...base };
    for (const key of ENV_KEYS) {
        delete env[key];
    }
    for (const key of ENV_KEYS) {
        if (subset.includes(key)) {
            if (setEmpty) {
                env[key] = "";
            }
        } else {
            env[key] = PLACEHOLDERS[key];
        }
    }
    return env;
}

describe("Property 31: missing env failure is deterministic and complete", () => {
    /**
     * Property 1 — `validateEnv` throws `EnvValidationError` naming exactly
     * the variables that were removed (or blanked out), in `ENV_KEYS` order.
     *
     * **Validates: Requirements 7.5**
     */
    it("validateEnv throws EnvValidationError listing exactly the missing variables", () => {
        fc.assert(
            fc.property(subsetArb, fc.boolean(), (subset, setEmpty) => {
                const partialEnv = buildPartialEnv(subset, {}, setEmpty);

                let thrown: unknown;
                try {
                    validateEnv(partialEnv);
                } catch (e) {
                    thrown = e;
                }

                expect(thrown).toBeInstanceOf(EnvValidationError);
                const err = thrown as EnvValidationError;

                const expectedMissing = ENV_KEYS.filter((k) =>
                    subset.includes(k),
                );
                expect([...err.missing]).toEqual([...expectedMissing]);
                // Removed keys are reported as missing, never as invalid.
                expect([...err.invalid]).toEqual([]);

                // The error message must name every missing variable so an
                // operator can act on it directly.
                for (const key of subset) {
                    expect(err.message).toContain(key);
                }
            }),
        );
    });

    /**
     * Property 2 — `scripts/check-env.js` exits with a non-zero status code
     * and emits stderr that names every removed variable.
     *
     * Uses `numRuns: 25` because each iteration spawns a Node child process,
     * which is significantly slower than an in-process call.
     *
     * **Validates: Requirements 7.5**
     */
    it(
        "scripts/check-env.js exits non-zero and stderr names every missing variable",
        () => {
            const scriptPath = path.resolve(
                process.cwd(),
                "scripts/check-env.js",
            );

            fc.assert(
                fc.property(subsetArb, (subset) => {
                    // Removed keys must be ABSENT (not empty string) for the
                    // spawned process, per the task description.
                    const partialEnv = buildPartialEnv(
                        subset,
                        process.env,
                        false,
                    );

                    const result = spawnSync(
                        process.execPath,
                        [scriptPath],
                        { env: partialEnv, encoding: "utf8" },
                    );

                    // The child process must have actually run.
                    expect(result.error).toBeUndefined();
                    // Non-zero exit code per Requirement 7.5.
                    expect(result.status).not.toBeNull();
                    expect(result.status).not.toBe(0);

                    const stderr = result.stderr ?? "";
                    for (const key of subset) {
                        expect(stderr).toContain(key);
                    }
                }),
                { numRuns: 25 },
            );
        },
        60_000,
    );
});
