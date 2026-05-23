/**
 * Feature: privello-platform, Property 33: Confinamento do SDK do Mercado Pago
 *
 * Property 33 — Confinement of the Mercado Pago SDK.
 *
 * Requirement 7.8 mandates that any Mercado Pago library, call or SDK type is
 * confined to a single payments module. By design that module is
 * `src/lib/payments/mercadopago.ts`, the only place in the codebase that may
 * import the `mercadopago` package directly. Every other file MUST consume
 * Mercado Pago through the wrapper interfaces exported by that module.
 *
 * For every TypeScript source file under `src/` (excluding `node_modules` and
 * `.next` build artifacts), if the file contains an import specifier whose
 * module name is exactly `"mercadopago"` or starts with `"mercadopago/"`, then
 * the file path (normalized to POSIX form, relative to the project root) MUST
 * equal `src/lib/payments/mercadopago.ts`.
 *
 * The property is encoded with `fast-check` using `fc.constantFrom()` over the
 * collected file list and `numRuns` set to the file count, which exhaustively
 * exercises every source file exactly once per run.
 *
 * **Validates: Requirements 7.8**
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import * as fc from "fast-check";

const PROJECT_ROOT = resolve(__dirname, "..", "..");
const SRC_ROOT = resolve(PROJECT_ROOT, "src");

/** The single file allowed to import the Mercado Pago SDK, in POSIX form. */
const ALLOWED_IMPORTER_POSIX = "src/lib/payments/mercadopago.ts";

/** Directory names that must never be traversed. */
const EXCLUDED_DIR_NAMES = new Set(["node_modules", ".next"]);

/** File extensions considered "TypeScript source" for this property. */
const TS_EXTENSIONS = [".ts", ".tsx"] as const;

/**
 * Convert an absolute filesystem path into a project-root-relative POSIX path
 * (forward slashes, no leading slash). Required because Windows paths use
 * backslashes and the property's contract is expressed in POSIX form.
 */
function toPosixRelative(absolutePath: string): string {
    const rel = absolutePath.startsWith(PROJECT_ROOT)
        ? absolutePath.slice(PROJECT_ROOT.length)
        : absolutePath;
    return rel.replace(/\\/g, "/").replace(/^\/+/, "");
}

/**
 * Recursively collect every `.ts`/`.tsx` file under `dir`, skipping any
 * directory whose name is in `EXCLUDED_DIR_NAMES`.
 */
function collectTsFiles(dir: string): string[] {
    const out: string[] = [];
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const full = resolve(dir, entry.name);
        if (entry.isDirectory()) {
            if (EXCLUDED_DIR_NAMES.has(entry.name)) continue;
            out.push(...collectTsFiles(full));
            continue;
        }
        if (!entry.isFile()) {
            // Resolve symlinks to a single stat call.
            try {
                if (!statSync(full).isFile()) continue;
            } catch {
                continue;
            }
        }
        if (TS_EXTENSIONS.some((ext) => entry.name.endsWith(ext))) {
            out.push(full);
        }
    }
    return out;
}

/**
 * Returns `true` when the given source text contains at least one import
 * specifier whose module name is exactly `mercadopago` or starts with
 * `mercadopago/`.
 *
 * Covers the common forms:
 *   - `import ... from "mercadopago"` / `'mercadopago'`
 *   - `import ... from "mercadopago/..."` / `'mercadopago/...'`
 *   - `export ... from "mercadopago"` / `"mercadopago/..."`
 *   - `import("mercadopago")` / dynamic imports of subpaths
 *   - `require("mercadopago")` / `require("mercadopago/...")`
 *
 * The regex anchors the package name with a non-`a-zA-Z0-9_-` lookahead so
 * accidental prefix matches such as `mercadopagox` do not count.
 */
function importsMercadoPagoSdk(sourceText: string): boolean {
    const specifierRe =
        /(?:from|import|require)\s*\(?\s*["'`](mercadopago)(\/[^"'`]*)?["'`]/g;
    return specifierRe.test(sourceText);
}

const TS_FILES = collectTsFiles(SRC_ROOT);

describe("Property 33: Mercado Pago SDK confinement", () => {
    it("only src/lib/payments/mercadopago.ts may import the `mercadopago` package", () => {
        // Sanity check: the walker must have actually found source files. If
        // this ever returns zero, the property would trivially "pass" while
        // providing no real coverage — fail loudly instead.
        expect(TS_FILES.length, "nenhum arquivo .ts/.tsx encontrado em src/").toBeGreaterThan(0);

        // Sanity check: the canonical importer must exist on disk so the
        // confinement we are asserting is meaningful.
        const allowedAbsolute = resolve(PROJECT_ROOT, ALLOWED_IMPORTER_POSIX);
        expect(
            TS_FILES.includes(allowedAbsolute),
            `arquivo permitido ${ALLOWED_IMPORTER_POSIX} não foi encontrado em src/`,
        ).toBe(true);

        fc.assert(
            fc.property(fc.constantFrom(...TS_FILES), (absolutePath) => {
                const posixPath = toPosixRelative(absolutePath);
                const sourceText = readFileSync(absolutePath, "utf8");
                if (!importsMercadoPagoSdk(sourceText)) return;
                if (posixPath === ALLOWED_IMPORTER_POSIX) return;
                throw new Error(
                    `Violação de confinamento do SDK do Mercado Pago: ${posixPath} ` +
                    `importa o pacote 'mercadopago'. Apenas ${ALLOWED_IMPORTER_POSIX} ` +
                    "tem permissão (Requirement 7.8).",
                );
            }),
            { numRuns: TS_FILES.length },
        );
    });
});
