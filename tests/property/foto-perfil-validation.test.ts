/**
 * Feature: privello-platform, Property 12: Validação da Foto_de_Perfil
 *
 * For any file with `mimeType` and `sizeBytes`, `validarFotoPerfil(arquivo)`
 * returns `true` if and only if:
 *   - `mimeType ∈ {"image/jpeg", "image/png", "image/webp"}`, AND
 *   - `sizeBytes <= 10 * 1024 * 1024`.
 *
 * Coverage:
 *   - Random combinations of permitted/forbidden mimes with sizes that span
 *     both sides of the 10 MiB limit (the bidirectional iff check).
 *   - Disallowed mime types at small sizes (forbidden mime always rejects).
 *   - Boundary at exactly 10 MiB (accepted for permitted mimes).
 *   - 10 MiB + 1 byte (rejected for permitted mimes).
 *   - Permitted mimes with sizes well under the limit (always accepted).
 *
 * **Validates: Requirements 3.10**
 */

import { describe, expect, it } from "vitest";
import * as fc from "fast-check";

import { validarFotoPerfil } from "@/domain/validation/fotoPerfil";

/** MIME types that the validator must accept. */
const MIMES_PERMITIDOS = ["image/jpeg", "image/png", "image/webp"] as const;

/**
 * MIME types that the validator must reject regardless of size. Includes
 * cousins of permitted formats (`image/gif`, `image/bmp`, `image/tiff`,
 * `image/svg+xml`), unrelated MIME types, and the empty string.
 */
const MIMES_PROIBIDOS = [
    "image/gif",
    "image/bmp",
    "image/tiff",
    "image/svg+xml",
    "image/jpg", // common typo, NOT in the allow-list
    "application/pdf",
    "application/octet-stream",
    "text/plain",
    "video/mp4",
    "",
] as const;

import { LIMITE_FOTO_BYTES } from "@/domain/limites";
const TEN_MB = LIMITE_FOTO_BYTES;

/** Yields permitted and forbidden mimes with comparable frequency. */
const mimeArb: fc.Arbitrary<string> = fc.oneof(
    fc.constantFrom(...MIMES_PERMITIDOS),
    fc.constantFrom(...MIMES_PROIBIDOS),
);

/**
 * Positive integer file sizes spanning both sides of the 10 MiB limit so the
 * iff check exercises accept and reject paths driven by size.
 */
const sizeArb: fc.Arbitrary<number> = fc.integer({ min: 1, max: 3 * TEN_MB });

describe("Property 12: Validação da Foto_de_Perfil", () => {
    it("returns true iff mimeType is permitted AND sizeBytes <= 10 MiB", () => {
        fc.assert(
            fc.property(mimeArb, sizeArb, (mimeType, sizeBytes) => {
                const expected =
                    (MIMES_PERMITIDOS as readonly string[]).includes(mimeType) &&
                    sizeBytes <= TEN_MB;
                expect(validarFotoPerfil({ mimeType, sizeBytes })).toBe(expected);
            }),
            { numRuns: 200 },
        );
    });

    it("rejects every disallowed mime type even at small sizes", () => {
        fc.assert(
            fc.property(
                fc.constantFrom(...MIMES_PROIBIDOS),
                fc.integer({ min: 1, max: TEN_MB }),
                (mimeType, sizeBytes) => {
                    expect(validarFotoPerfil({ mimeType, sizeBytes })).toBe(false);
                },
            ),
            { numRuns: 100 },
        );
    });

    it("accepts permitted mimes at exactly 10 MiB (lower edge of acceptance)", () => {
        for (const mimeType of MIMES_PERMITIDOS) {
            expect(validarFotoPerfil({ mimeType, sizeBytes: TEN_MB })).toBe(true);
        }
    });

    it("rejects permitted mimes at 10 MiB + 1 byte (upper edge of rejection)", () => {
        for (const mimeType of MIMES_PERMITIDOS) {
            expect(validarFotoPerfil({ mimeType, sizeBytes: TEN_MB + 1 })).toBe(false);
        }
    });

    it("accepts permitted mimes well under the 10 MiB limit", () => {
        fc.assert(
            fc.property(
                fc.constantFrom(...MIMES_PERMITIDOS),
                fc.integer({ min: 1, max: TEN_MB - 1 }),
                (mimeType, sizeBytes) => {
                    expect(validarFotoPerfil({ mimeType, sizeBytes })).toBe(true);
                },
            ),
            { numRuns: 100 },
        );
    });
});
