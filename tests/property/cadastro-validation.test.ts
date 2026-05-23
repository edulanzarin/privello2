// Feature: privello-platform, Property 6: Validação de campos do cadastro de Cliente
/**
 * Property 6 — Validação de campos do cadastro de Cliente.
 *
 * **Validates: Requirements 2.1, 2.5, 2.6, 2.7, 2.8, 2.9**
 *
 * Statement (do design.md, transcrito literalmente):
 *
 *   For any `CadastroClienteInput`, `registrar(input)` retorna
 *   `{ ok: false, reason: "VALIDACAO" }` se e somente se ao menos uma das
 *   condições a seguir é falsa:
 *     - `nome.trim().length` está em `[2, 100]`,
 *     - `email.length` está em `[5, 254]` e o email satisfaz o padrão
 *       `parte_local@dominio` com pelo menos um ponto no domínio,
 *     - `identificador` casa com `^[A-Za-z0-9_]{3,30}$`,
 *     - `senha.length` está em `[8, 128]`.
 *
 * O serviço `registrar` ainda não existe (task 6.1). Esta propriedade é
 * testada contra `cadastroClienteSchema` em `src/domain/schemas.ts`,
 * que é o predicado canônico que `registrar` consumirá: o serviço
 * retornará `{ ok: false, reason: "VALIDACAO" }` exatamente quando
 * `cadastroClienteSchema.safeParse(input).success === false`. Validar o
 * schema agora garante que o contrato estará correto antes da task 6.1.
 *
 * O teste exercita ambas as direções do iff:
 *   1. **(=>)** Se o input viola pelo menos uma regra, o schema rejeita.
 *   2. **(<=)** Se nenhuma regra é violada, o schema aceita.
 *
 * As condições de "regra violada" são avaliadas reproduzindo o predicado
 * descrito no design — sem importar nem reusar os validadores de domínio
 * — para garantir que o teste valida o **comportamento observável** do
 * schema, e não apenas que ele delega para `validarNome` etc. Caso o
 * schema deixe de delegar para esses validadores e implemente as regras
 * de outra forma incorreta, o teste falha.
 */

import * as fc from "fast-check";
import { describe, expect, it } from "vitest";

import { cadastroClienteSchema } from "@/domain/schemas";

import {
    cadastroClienteInputArb,
    invalidEmailArb,
    invalidIdentificadorArb,
    invalidNomeArb,
    invalidSenhaArb,
    validEmailArb,
    validIdentificadorArb,
    validNomeArb,
    validSenhaArb,
} from "./generators";

// ---------------------------------------------------------------------------
// Predicados de referência (transcrição literal de Property 6)
// ---------------------------------------------------------------------------

/** `nome.trim().length` está em `[2, 100]`. */
function nomeRespeitaRegra(nome: string): boolean {
    if (typeof nome !== "string") return false;
    const len = nome.trim().length;
    return len >= 2 && len <= 100;
}

/**
 * `email.length` está em `[5, 254]` e o email satisfaz o padrão
 * `parte_local@dominio` com pelo menos um ponto no domínio.
 *
 * Implementado a partir da redação literal do design: parte local não
 * vazia (`[^\s@]+`), exatamente um `@`, domínio com pelo menos um ponto
 * separando rótulo e TLD não vazios.
 */
function emailRespeitaRegra(email: string): boolean {
    if (typeof email !== "string") return false;
    if (email.length < 5 || email.length > 254) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** `identificador` casa com `^[A-Za-z0-9_]{3,30}$`. */
function identificadorRespeitaRegra(identificador: string): boolean {
    if (typeof identificador !== "string") return false;
    return /^[A-Za-z0-9_]{3,30}$/.test(identificador);
}

/** `senha.length` está em `[8, 128]`. */
function senhaRespeitaRegra(senha: string): boolean {
    if (typeof senha !== "string") return false;
    return senha.length >= 8 && senha.length <= 128;
}

type CadastroFields = {
    nome: string;
    email: string;
    identificador: string;
    senha: string;
};

/**
 * Retorna a lista de regras violadas pelo input. Vazia ⇔ todas as regras
 * são respeitadas ⇔ o schema deve aceitar.
 */
function regrasVioladas(input: CadastroFields): string[] {
    const violadas: string[] = [];
    if (!nomeRespeitaRegra(input.nome)) violadas.push("nome");
    if (!emailRespeitaRegra(input.email)) violadas.push("email");
    if (!identificadorRespeitaRegra(input.identificador)) {
        violadas.push("identificador");
    }
    if (!senhaRespeitaRegra(input.senha)) violadas.push("senha");
    return violadas;
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/**
 * Gera um input "misto" no qual cada campo é independentemente válido ou
 * inválido. Cobre as duas direções do iff em uma única distribuição:
 * com probabilidade ~6% (1/2)^4 todos os campos são válidos; nos demais
 * casos pelo menos um é inválido.
 */
const mixedCadastroInputArb: fc.Arbitrary<CadastroFields> = fc.record({
    nome: fc.oneof(validNomeArb, invalidNomeArb),
    email: fc.oneof(validEmailArb, invalidEmailArb),
    identificador: fc.oneof(validIdentificadorArb, invalidIdentificadorArb),
    senha: fc.oneof(validSenhaArb, invalidSenhaArb),
});

/**
 * Para cada campo, gera um input em que **exatamente aquele campo** é
 * inválido e os outros três são válidos. Garante cobertura individual de
 * cada cláusula da disjunção (Requirements 2.5, 2.6, 2.7, 2.8) sem
 * depender da distribuição estatística de `mixedCadastroInputArb`.
 */
const exactlyOneInvalidArb: fc.Arbitrary<CadastroFields> = fc.oneof(
    fc.record({
        nome: invalidNomeArb,
        email: validEmailArb,
        identificador: validIdentificadorArb,
        senha: validSenhaArb,
    }),
    fc.record({
        nome: validNomeArb,
        email: invalidEmailArb,
        identificador: validIdentificadorArb,
        senha: validSenhaArb,
    }),
    fc.record({
        nome: validNomeArb,
        email: validEmailArb,
        identificador: invalidIdentificadorArb,
        senha: validSenhaArb,
    }),
    fc.record({
        nome: validNomeArb,
        email: validEmailArb,
        identificador: validIdentificadorArb,
        senha: invalidSenhaArb,
    }),
);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Property 6: Validação de campos do cadastro de Cliente", () => {
    /**
     * Direção <=: nenhuma regra violada ⇒ schema aceita.
     */
    it("aceita inputs em que todos os campos respeitam as regras", () => {
        fc.assert(
            fc.property(cadastroClienteInputArb, (input) => {
                // Pré-condição: o gerador só produz inputs válidos.
                expect(regrasVioladas(input)).toEqual([]);
                const result = cadastroClienteSchema.safeParse(input);
                if (!result.success) {
                    throw new Error(
                        `Schema rejeitou input válido: ${JSON.stringify(input)}\n` +
                        `Erros: ${JSON.stringify(result.error.issues)}`,
                    );
                }
            }),
            { numRuns: 100 },
        );
    });

    /**
     * Direção =>: pelo menos uma regra violada ⇒ schema rejeita.
     *
     * Cobre cada cláusula da disjunção isoladamente: para cada campo,
     * gera um input em que somente aquele campo é inválido.
     */
    it("rejeita inputs em que exatamente um dos campos viola sua regra", () => {
        fc.assert(
            fc.property(exactlyOneInvalidArb, (input) => {
                const violadas = regrasVioladas(input);
                expect(violadas.length).toBeGreaterThan(0);
                const result = cadastroClienteSchema.safeParse(input);
                if (result.success) {
                    throw new Error(
                        "Schema aceitou input com regra(s) violada(s) " +
                        `(${violadas.join(", ")}): ${JSON.stringify(input)}`,
                    );
                }
            }),
            { numRuns: 100 },
        );
    });

    /**
     * Iff completo: schema aceita ⇔ nenhuma regra é violada.
     *
     * Este é o enunciado da Property 6 na sua forma mais geral. Usa um
     * gerador misto para que tanto inputs totalmente válidos quanto
     * inputs com qualquer combinação de regras violadas apareçam.
     */
    it("aceita um input se e somente se todas as regras são respeitadas", () => {
        fc.assert(
            fc.property(mixedCadastroInputArb, (input) => {
                const violadas = regrasVioladas(input);
                const esperadoAceito = violadas.length === 0;
                const result = cadastroClienteSchema.safeParse(input);
                if (result.success !== esperadoAceito) {
                    throw new Error(
                        `Iff quebrado: regras violadas=[${violadas.join(", ")}], ` +
                        `mas safeParse.success=${result.success} ` +
                        `(esperado=${esperadoAceito}). ` +
                        `Input: ${JSON.stringify(input)}`,
                    );
                }
            }),
            { numRuns: 100 },
        );
    });
});
