// Feature: privello-platform, Property 19: Validação de localidade aceita exatamente o produto cartesiano oficial
/**
 * Property 19 — Validação de localidade aceita exatamente o produto cartesiano oficial.
 *
 * Para qualquer par `(uf, cidade)`, `LocalidadesService.validar(uf, cidade)`
 * deve ser `true` **se e somente se** `uf` estiver presente em
 * `listarEstados()` e `cidade` casar exatamente (igualdade estrita de string)
 * com algum `nome` em `listarCidades(uf)`.
 *
 * Estratégia do teste:
 *
 *   1. Construímos um produto cartesiano oficial controlado e finito —
 *      um conjunto de UFs e, para cada UF, uma lista de cidades — e o
 *      injetamos no `LocalidadesService` via `createLocalidadesService`
 *      usando stubs para `fetchEstados` / `fetchCidades`. O cache é
 *      stubado como permanentemente ausente para que cada chamada
 *      atravesse o caminho IBGE-OK do serviço.
 *
 *   2. **Pares válidos**: amostramos um `(uf, cidade)` diretamente do
 *      produto cartesiano (cada par escolhido aparece em `listarEstados`
 *      e a cidade está em `listarCidades(uf)`). A propriedade exige que
 *      `validar` retorne `true`.
 *
 *   3. **Pares inválidos**: amostramos pares cobrindo as duas formas de
 *      falha previstas pela propriedade:
 *        (a) `uf` fora de `listarEstados()` (com qualquer cidade);
 *        (b) `uf` em `listarEstados()` mas `cidade` ausente de
 *            `listarCidades(uf)`.
 *      Em ambos, `validar` deve retornar `false`.
 *
 * O teste injeta UFs já normalizadas (trim + uppercase) e cidades sem
 * espaços nas extremidades para que o "iff" seja avaliado contra os
 * valores oficiais sem interferência das normalizações internas do
 * serviço (que não fazem parte do enunciado da propriedade 19).
 *
 * **Validates: Requirements 4.3**
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";

import {
    createLocalidadesService,
    type LocalidadesDeps,
} from "@/server/localidades/service";
import type { Cidade, Estado } from "@/lib/ibge";

const NUM_RUNS = 100;

// ---------------------------------------------------------------------------
// Produto cartesiano oficial fixo usado pelos stubs.
//
// Mantemos o conjunto pequeno e diverso (UFs distintas, cidades com nomes que
// não se repetem entre UFs) para que pares inválidos por "cidade no estado
// errado" sejam fáceis de gerar e a propriedade seja exercitada de forma
// significativa em 100 iterações.
// ---------------------------------------------------------------------------

const ESTADOS_OFICIAIS: ReadonlyArray<Estado> = [
    { sigla: "SP", nome: "São Paulo" },
    { sigla: "RJ", nome: "Rio de Janeiro" },
    { sigla: "MG", nome: "Minas Gerais" },
    { sigla: "BA", nome: "Bahia" },
];

const CIDADES_POR_UF: Readonly<Record<string, ReadonlyArray<Cidade>>> = {
    SP: [
        { id: 3550308, nome: "São Paulo", estadoSigla: "SP" },
        { id: 3509502, nome: "Campinas", estadoSigla: "SP" },
        { id: 3548708, nome: "Santos", estadoSigla: "SP" },
    ],
    RJ: [
        { id: 3304557, nome: "Rio de Janeiro", estadoSigla: "RJ" },
        { id: 3303302, nome: "Niterói", estadoSigla: "RJ" },
    ],
    MG: [
        { id: 3106200, nome: "Belo Horizonte", estadoSigla: "MG" },
        { id: 3118601, nome: "Contagem", estadoSigla: "MG" },
    ],
    BA: [
        { id: 2927408, nome: "Salvador", estadoSigla: "BA" },
        { id: 2910800, nome: "Feira de Santana", estadoSigla: "BA" },
    ],
};

const UFS_VALIDAS: ReadonlyArray<string> = ESTADOS_OFICIAIS.map((e) => e.sigla);
const UFS_VALIDAS_SET: ReadonlySet<string> = new Set(UFS_VALIDAS);

/**
 * Conjunto de todos os nomes de cidades conhecidas no produto cartesiano,
 * usado para garantir que os geradores de cidade inválida produzam nomes
 * fora desse universo.
 */
const TODAS_AS_CIDADES_SET: ReadonlySet<string> = new Set(
    Object.values(CIDADES_POR_UF).flatMap((cs) => cs.map((c) => c.nome)),
);

/**
 * UFs de duas letras que não pertencem ao produto cartesiano. Inclui siglas
 * brasileiras reais omitidas do conjunto oficial deste teste e duas siglas
 * sintéticas (`XX`, `ZZ`) para garantir cobertura mesmo se o conjunto
 * "oficial" do teste for expandido no futuro.
 */
const UFS_FORA_DO_PRODUTO: ReadonlyArray<string> = [
    "AC", "AL", "AM", "AP", "CE", "DF", "ES", "GO", "MA",
    "MS", "MT", "PA", "PB", "PE", "PI", "PR", "RN",
    "RO", "RR", "RS", "SC", "SE", "TO",
    "XX", "ZZ",
].filter((uf) => !UFS_VALIDAS_SET.has(uf));

// ---------------------------------------------------------------------------
// Construção do service com stubs determinísticos.
// ---------------------------------------------------------------------------

/**
 * Cria um `LocalidadesService` que responde a partir do produto cartesiano
 * fixo definido acima. O cache é tratado como sempre ausente, e as chamadas
 * a `upsertCache` são absorvidas por um no-op, para que cada `validar`
 * exercite o caminho `cache miss → IBGE OK`.
 *
 * `fetchCidades` lança `Error` quando a UF requisitada não existe no produto:
 * isso modela a realidade da API_IBGE (UFs desconhecidas falham a chamada) e
 * obriga `validar` a reportar `false` por falha na fonte — ainda alinhado à
 * propriedade, já que UFs fora de `listarEstados()` devem produzir `false`
 * mesmo que a fonte de cidades estivesse disponível.
 */
function buildService() {
    const deps: LocalidadesDeps = {
        async fetchEstados() {
            return [...ESTADOS_OFICIAIS];
        },
        async fetchCidades(uf: string) {
            const lista = CIDADES_POR_UF[uf];
            if (!lista) {
                throw new Error(`UF '${uf}' fora do produto cartesiano oficial`);
            }
            return [...lista];
        },
        async getCache() {
            return null;
        },
        async upsertCache() {
            return;
        },
        resolveTtlMs() {
            return 24 * 60 * 60 * 1000;
        },
    };
    return createLocalidadesService(deps);
}

// ---------------------------------------------------------------------------
// Geradores
// ---------------------------------------------------------------------------

/** Par `(uf, cidade)` retirado diretamente do produto cartesiano oficial. */
const validPairArb: fc.Arbitrary<{ uf: string; cidade: string }> =
    fc.constantFrom(
        ...UFS_VALIDAS.flatMap((uf) =>
            CIDADES_POR_UF[uf].map((c) => ({ uf, cidade: c.nome })),
        ),
    );

/** Cidade arbitrária garantidamente fora de qualquer `listarCidades(uf)`. */
const cidadeForaDoUniversoArb: fc.Arbitrary<string> = fc
    .string({ minLength: 1, maxLength: 30 })
    .map((s) => s.trim())
    .filter((s) => s.length >= 1 && !TODAS_AS_CIDADES_SET.has(s));

/** Par inválido por **UF fora de `listarEstados()`**. A cidade pode ser qualquer string. */
const invalidPairWrongUfArb: fc.Arbitrary<{ uf: string; cidade: string }> =
    fc.record({
        uf: fc.constantFrom(...UFS_FORA_DO_PRODUTO),
        cidade: fc.oneof(
            // Cidade que existe em alguma UF válida — ainda assim deve falhar
            // porque a UF não está em `listarEstados()`.
            fc.constantFrom(...Array.from(TODAS_AS_CIDADES_SET)),
            // Cidade arbitrária qualquer.
            cidadeForaDoUniversoArb,
        ),
    });

/**
 * Par inválido por **cidade fora de `listarCidades(uf)` para uma UF válida**.
 * A cidade é amostrada do universo de strings fora do conjunto de cidades
 * conhecidas em qualquer UF, garantindo a violação da segunda metade do
 * "iff" sem ambiguidade.
 */
const invalidPairWrongCidadeArb: fc.Arbitrary<{ uf: string; cidade: string }> =
    fc.record({
        uf: fc.constantFrom(...UFS_VALIDAS),
        cidade: cidadeForaDoUniversoArb,
    });

/** União das duas formas de invalidar o par, com pesos aproximadamente iguais. */
const invalidPairArb: fc.Arbitrary<{ uf: string; cidade: string }> = fc.oneof(
    invalidPairWrongUfArb,
    invalidPairWrongCidadeArb,
);

// ---------------------------------------------------------------------------
// Propriedade
// ---------------------------------------------------------------------------

describe("Property 19: validar aceita exatamente o produto cartesiano oficial", () => {
    it("aceita pares retirados diretamente do produto cartesiano (validar === true)", async () => {
        const service = buildService();
        await fc.assert(
            fc.asyncProperty(validPairArb, async ({ uf, cidade }) => {
                const result = await service.validar(uf, cidade);
                expect(result).toBe(true);
            }),
            { numRuns: NUM_RUNS },
        );
    });

    it("rejeita pares cuja UF está fora de listarEstados() ou cuja cidade está fora de listarCidades(uf) (validar === false)", async () => {
        const service = buildService();
        await fc.assert(
            fc.asyncProperty(invalidPairArb, async ({ uf, cidade }) => {
                const result = await service.validar(uf, cidade);
                expect(result).toBe(false);
            }),
            { numRuns: NUM_RUNS },
        );
    });
});
