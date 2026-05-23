// Feature: privello-platform, Property 10: Validação do telefone brasileiro
/**
 * Property 10 — Validação do telefone brasileiro.
 *
 * Para qualquer string `s`, definindo `digitos` como o resultado de remover
 * de `s` todas as ocorrências dos caracteres de máscara `+`, espaço, `(`,
 * `)` e `-`, a função `validarTelefone(s)` deve ser `true` se e somente se
 * `digitos` é composto **somente** por dígitos decimais e o seu comprimento
 * é 10 ou 11.
 *
 * O teste cruza três frentes para cobrir o "if and only if":
 *
 *   1. Geradores válidos de `tests/property/generators.ts` (`validTelefoneArb`)
 *      — que produzem 10 ou 11 dígitos com decoração de máscara aleatória —
 *      devem sempre validar como `true`.
 *   2. Geradores inválidos (`invalidTelefoneArb`) devem sempre validar como
 *      `false`.
 *   3. Para qualquer string arbitrária, a equivalência com a especificação
 *      derivada (`stripMask` + `^\d+$` + comprimento ∈ {10, 11}) deve valer.
 *      Essa terceira frente é o teste de propriedade no sentido estrito do
 *      Property 10 e cobre o universo completo de entradas (incluindo
 *      Unicode, caracteres não-ASCII e strings vazias).
 *
 * **Validates: Requirements 3.8**
 */

import { describe, it } from "vitest";
import * as fc from "fast-check";

import { validarTelefone } from "@/domain/validation/telefone";
import {
    invalidTelefoneArb,
    validTelefoneArb,
} from "./generators";

const NUM_RUNS = 200;

/**
 * Especificação de referência para o validador, derivada literalmente do
 * texto da Property 10. Implementada de forma independente da função sob
 * teste para servir de oráculo do "if and only if".
 *
 * - Strip dos caracteres de máscara: `+`, espaço, `(`, `)`, `-`.
 * - Resultado deve ser composto somente por dígitos decimais (`0`–`9`).
 * - Comprimento do resultado deve ser exatamente 10 ou 11.
 */
function specValidarTelefone(s: string): boolean {
    if (typeof s !== "string") return false;
    // Remoção literal dos cinco caracteres de máscara, sem regex, para que
    // o oráculo seja o mais explícito possível.
    let digitos = "";
    for (const ch of s) {
        if (ch === "+" || ch === " " || ch === "(" || ch === ")" || ch === "-") {
            continue;
        }
        digitos += ch;
    }
    if (digitos.length !== 10 && digitos.length !== 11) return false;
    for (const ch of digitos) {
        const code = ch.charCodeAt(0);
        // 0x30 = '0', 0x39 = '9'
        if (code < 0x30 || code > 0x39) return false;
    }
    return true;
}

describe("Property 10: validação do telefone brasileiro", () => {
    it("aceita telefones válidos com 10 ou 11 dígitos e qualquer máscara permitida", () => {
        fc.assert(
            fc.property(validTelefoneArb, (telefone) => {
                return validarTelefone(telefone) === true;
            }),
            { numRuns: NUM_RUNS },
        );
    });

    it("rejeita telefones inválidos (comprimento fora de [10,11] ou caracteres proibidos)", () => {
        fc.assert(
            fc.property(invalidTelefoneArb, (telefone) => {
                return validarTelefone(telefone) === false;
            }),
            { numRuns: NUM_RUNS },
        );
    });

    it("é equivalente à especificação para qualquer string (universo completo)", () => {
        fc.assert(
            fc.property(fc.string({ minLength: 0, maxLength: 40 }), (s) => {
                return validarTelefone(s) === specValidarTelefone(s);
            }),
            { numRuns: NUM_RUNS },
        );
    });

    it("é equivalente à especificação para strings construídas a partir do alfabeto de máscara + dígitos + ruído", () => {
        // Distribuição enviesada para o domínio relevante: dígitos, caracteres
        // de máscara e algumas letras/símbolos que devem invalidar o número.
        const charArb = fc.constantFrom(
            ..."0123456789+()- abcXYZ.@_/".split(""),
        );
        const stringArb = fc
            .array(charArb, { minLength: 0, maxLength: 25 })
            .map((cs) => cs.join(""));
        fc.assert(
            fc.property(stringArb, (s) => {
                return validarTelefone(s) === specValidarTelefone(s);
            }),
            { numRuns: NUM_RUNS },
        );
    });
});
