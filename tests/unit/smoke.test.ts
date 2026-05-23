import { describe, expect, it } from "vitest";
import * as fc from "fast-check";

import {
    cadastroClienteInputArb,
    onboardingDataArb,
    planoTipoArb,
    validEmailArb,
    validNomeArb,
    validIdentificadorArb,
    validSenhaArb,
    validTelefoneArb,
} from "../property/generators";
import { createR2Stub } from "../helpers/r2-stub";

/**
 * Smoke test: confirms the testing toolchain is wired correctly.
 *
 * - Vitest can run TypeScript with the `@/*` path alias resolution.
 * - `fast-check` is importable and produces values via `fc.sample`.
 * - The shared generators expose the names mandated by task 1.6.
 * - The R2 stub satisfies the design's `putStaged`/`commit` contract end-to-end.
 *
 * It does NOT validate any business rule — those are covered by the property
 * tests under `tests/property/`.
 */
describe("smoke: testing tooling wiring", () => {
    it("fast-check is importable and generates samples", () => {
        const samples = fc.sample(fc.integer({ min: 0, max: 10 }), 5);
        expect(samples).toHaveLength(5);
        for (const n of samples) {
            expect(n).toBeGreaterThanOrEqual(0);
            expect(n).toBeLessThanOrEqual(10);
        }
    });

    it("shared generators are wired and produce values", () => {
        // Pull a few samples from each generator to make sure they don't throw.
        expect(fc.sample(validNomeArb, 3)).toHaveLength(3);
        expect(fc.sample(validEmailArb, 3)).toHaveLength(3);
        expect(fc.sample(validIdentificadorArb, 3)).toHaveLength(3);
        expect(fc.sample(validSenhaArb, 3)).toHaveLength(3);
        expect(fc.sample(validTelefoneArb, 3)).toHaveLength(3);
        expect(fc.sample(planoTipoArb, 5).every((p) =>
            p === "BASICO" || p === "PREMIUM",
        )).toBe(true);

        const cliente = fc.sample(cadastroClienteInputArb, 1)[0];
        expect(cliente).toHaveProperty("nome");
        expect(cliente).toHaveProperty("email");
        expect(cliente).toHaveProperty("identificador");
        expect(cliente).toHaveProperty("senha");

        const onboarding = fc.sample(onboardingDataArb, 1)[0];
        expect(onboarding).toHaveProperty("telefone");
        expect(onboarding).toHaveProperty("estadoSigla");
        expect(onboarding).toHaveProperty("cidadeNome");
        expect(onboarding.fotoPerfil.sizeBytes).toBeGreaterThan(0);
    });

    it("R2 stub honors the putStaged/commit/deleteObject/presignedUrl contract", async () => {
        const r2 = createR2Stub();
        const stagedKey = "staged/abc-123";
        const finalKey = "committed/u1/profile.jpg";

        await r2.putStaged(stagedKey, new Uint8Array([1, 2, 3]), "image/jpeg");
        expect(r2.has(stagedKey)).toBe(true);

        await r2.commit(stagedKey, finalKey);
        expect(r2.has(stagedKey)).toBe(false);
        expect(r2.has(finalKey)).toBe(true);

        const url = await r2.presignedUrl(finalKey);
        expect(url).toMatch(/^https:\/\//);

        await r2.deleteObject(finalKey);
        expect(r2.has(finalKey)).toBe(false);
    });
});
