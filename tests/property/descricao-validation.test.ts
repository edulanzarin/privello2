// Feature: privello-platform, Property 11: Validação da descrição
/**
 * Property 11 — Validação da descrição.
 *
 * For any string `d`, `validarDescricao(d)` is `true` if and only if
 * `d.length` is in `[1, 1000]`.
 *
 * The rule is intentionally based on the raw `.length` of the input string
 * (no `trim`): a usuária pode legitimamente começar/terminar com espaços ou
 * quebras de linha, e o requisito fala em comprimento bruto da descrição.
 *
 * The test pairs an `fc.assert` over arbitrary strings (≥ 100 iterations) with
 * explicit boundary cases at lengths 0, 1, 1000 and 1001 so a regression in
 * either direction (off-by-one on the lower or upper bound) is caught
 * immediately, not just probabilistically.
 *
 * **Validates: Requirements 3.9**
 */

import { describe, expect, it } from "vitest";
import * as fc from "fast-check";

import { validarDescricao } from "@/domain/validation/descricao";

const MIN_LEN = 1;
const MAX_LEN = 1000;

describe("Property 11: validação da descrição", () => {
    it("aceita exatamente strings com length em [1, 1000] (fast-check, 200 runs)", () => {
        // Generate strings spanning both inside and outside the valid range so
        // each run probes the full decision boundary, not just the happy path.
        const stringArb = fc.string({ minLength: 0, maxLength: 1100 });

        fc.assert(
            fc.property(stringArb, (d) => {
                const expected = d.length >= MIN_LEN && d.length <= MAX_LEN;
                expect(validarDescricao(d)).toBe(expected);
            }),
            { numRuns: 200 },
        );
    });

    it("rejeita a string vazia (length 0, abaixo do mínimo)", () => {
        expect(validarDescricao("")).toBe(false);
    });

    it("aceita o limite inferior exato (length 1)", () => {
        expect(validarDescricao("a")).toBe(true);
    });

    it("aceita o limite superior exato (length 1000)", () => {
        const exatamenteMil = "x".repeat(MAX_LEN);
        expect(exatamenteMil.length).toBe(MAX_LEN);
        expect(validarDescricao(exatamenteMil)).toBe(true);
    });

    it("rejeita logo acima do limite superior (length 1001)", () => {
        const umAcima = "x".repeat(MAX_LEN + 1);
        expect(umAcima.length).toBe(MAX_LEN + 1);
        expect(validarDescricao(umAcima)).toBe(false);
    });
});
