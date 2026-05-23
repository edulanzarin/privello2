/**
 * Property 30 — Environment example/schema parity.
 *
 * The list of environment variables the application reads at runtime MUST be
 * the EXACT same set in four places:
 *
 *   1. `.env.example`                          (developer-facing template)
 *   2. `ENV_KEYS` exported from `src/lib/env.ts` (canonical ordered tuple)
 *   3. `ENV_SCHEMA.shape` from `src/lib/env.ts` (Zod object validating env)
 *   4. `REQUIRED_ENV_KEYS` in `scripts/check-env.js` (Docker boot gate, runs
 *      in plain Node so it cannot import the TypeScript source)
 *
 * Any drift between these four sources is a bug: a variable could be required
 * by runtime code but never documented in `.env.example`, or the Docker boot
 * gate could fail to detect a missing variable that the Zod schema requires.
 *
 * This is a structural fixed-input check (no randomness needed), but it is
 * phrased through `fc.assert` with a degenerate generator so the test ledger
 * counts it alongside the other property tests.
 *
 * **Validates: Requirements 7.4**
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import * as fc from "fast-check";

import { ENV_KEYS, ENV_SCHEMA } from "@/lib/env";

const PROJECT_ROOT = resolve(__dirname, "..", "..");
const ENV_EXAMPLE_PATH = resolve(PROJECT_ROOT, ".env.example");
const CHECK_ENV_PATH = resolve(PROJECT_ROOT, "scripts", "check-env.js");

/**
 * Parse a `.env`-style file into the set of variable names it declares.
 *
 * - Skips blank lines.
 * - Skips full-line comments (lines whose first non-whitespace char is `#`).
 * - Accepts the `KEY=VALUE` form (the value, including the `=` and anything
 *   after it, is irrelevant — we only care which keys are present).
 * - A line without `=` is considered malformed for this test's purposes and
 *   will surface as an extra "key" that won't match the schema, which is
 *   exactly the kind of drift we want to catch.
 */
function parseEnvExampleKeys(text: string): Set<string> {
    const keys = new Set<string>();
    for (const rawLine of text.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (line === "" || line.startsWith("#")) continue;
        const eq = line.indexOf("=");
        const key = (eq === -1 ? line : line.slice(0, eq)).trim();
        if (key !== "") keys.add(key);
    }
    return keys;
}

/**
 * Extract the `REQUIRED_ENV_KEYS` array literal from `scripts/check-env.js`.
 *
 * The script is plain JavaScript with a single `const REQUIRED_ENV_KEYS = [...]`
 * declaration; we parse it with a regex rather than evaluating the file so we
 * never execute its `main()` (which calls `process.exit`).
 */
function parseCheckEnvKeys(text: string): Set<string> {
    const match = text.match(
        /const\s+REQUIRED_ENV_KEYS\s*=\s*\[([\s\S]*?)\]\s*;/,
    );
    if (match === null) {
        throw new Error(
            "Não foi possível localizar a constante REQUIRED_ENV_KEYS em scripts/check-env.js",
        );
    }
    const body = match[1];
    const keys = new Set<string>();
    // Match each string literal inside the array (single, double, or backtick).
    const stringLiteralRe = /["'`]([^"'`]+)["'`]/g;
    let m: RegExpExecArray | null;
    while ((m = stringLiteralRe.exec(body)) !== null) {
        keys.add(m[1]);
    }
    return keys;
}

/** Return the elements of `a` that are not in `b`. */
function difference<T>(a: Set<T>, b: Set<T>): T[] {
    return [...a].filter((x) => !b.has(x)).sort();
}

/**
 * Build a human-readable diagnostic comparing two key sets when they differ.
 * Returns `null` when the sets are equal.
 */
function describeDifference(
    leftLabel: string,
    leftKeys: Set<string>,
    rightLabel: string,
    rightKeys: Set<string>,
): string | null {
    const onlyInLeft = difference(leftKeys, rightKeys);
    const onlyInRight = difference(rightKeys, leftKeys);
    if (onlyInLeft.length === 0 && onlyInRight.length === 0) return null;
    const parts: string[] = [
        `Divergência entre ${leftLabel} e ${rightLabel}:`,
    ];
    if (onlyInLeft.length > 0) {
        parts.push(
            `  presentes em ${leftLabel} mas ausentes em ${rightLabel}: ${onlyInLeft.join(", ")}`,
        );
    }
    if (onlyInRight.length > 0) {
        parts.push(
            `  presentes em ${rightLabel} mas ausentes em ${leftLabel}: ${onlyInRight.join(", ")}`,
        );
    }
    return parts.join("\n");
}

describe("Property 30: environment example/schema parity", () => {
    it("`.env.example`, ENV_KEYS, ENV_SCHEMA.shape, and check-env.js declare the exact same set of keys", () => {
        const envExampleText = readFileSync(ENV_EXAMPLE_PATH, "utf8");
        const checkEnvText = readFileSync(CHECK_ENV_PATH, "utf8");

        const envExampleKeys = parseEnvExampleKeys(envExampleText);
        const envKeysSet = new Set<string>(ENV_KEYS);
        const envSchemaKeys = new Set<string>(Object.keys(ENV_SCHEMA.shape));
        const checkEnvKeys = parseCheckEnvKeys(checkEnvText);

        // Use fc.assert with a degenerate generator so this test is counted
        // among the property suite even though the input space is fixed.
        fc.assert(
            fc.property(fc.constant(null), () => {
                const sources: ReadonlyArray<readonly [string, Set<string>]> = [
                    [".env.example", envExampleKeys],
                    ["ENV_KEYS", envKeysSet],
                    ["ENV_SCHEMA.shape", envSchemaKeys],
                    ["scripts/check-env.js (REQUIRED_ENV_KEYS)", checkEnvKeys],
                ];
                const diagnostics: string[] = [];
                for (let i = 0; i < sources.length; i++) {
                    for (let j = i + 1; j < sources.length; j++) {
                        const diff = describeDifference(
                            sources[i][0],
                            sources[i][1],
                            sources[j][0],
                            sources[j][1],
                        );
                        if (diff !== null) diagnostics.push(diff);
                    }
                }
                if (diagnostics.length > 0) {
                    throw new Error(
                        "Quebra de paridade entre fontes de variáveis de ambiente:\n" +
                        diagnostics.join("\n"),
                    );
                }
            }),
            { numRuns: 1 },
        );

        // Also surface the same checks via direct Vitest assertions so the
        // failure output points at the specific set that disagrees, in the
        // (likely) case someone reads only the first failed expectation.
        expect(envExampleKeys, ".env.example vs ENV_KEYS").toEqual(envKeysSet);
        expect(envSchemaKeys, "ENV_SCHEMA.shape vs ENV_KEYS").toEqual(envKeysSet);
        expect(checkEnvKeys, "scripts/check-env.js vs ENV_KEYS").toEqual(envKeysSet);
    });
});
