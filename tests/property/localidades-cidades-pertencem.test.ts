// Feature: privello-platform, Property 18: Cidades retornadas pertencem ao estado consultado
/**
 * Property 18 — Cidades retornadas pertencem ao estado consultado.
 *
 * **Validates: Requirements 4.2**
 *
 * Statement (transcrito do design.md):
 *
 *   For any valid UF, all cities returned by `listarCidades(uf)` have
 *   `estadoSigla === uf`.
 *
 * Esta é a invariante mínima exigida pelo Requirement 4.2: ao apresentar a
 * lista de cidades de um estado selecionado, o `Sistema_de_Localidades` não
 * pode "vazar" cidades que pertençam a outra UF — caso contrário o passo
 * seguinte do onboarding poderia aceitar um par `(estado, cidade)`
 * inconsistente, violando o Requirement 4.3.
 *
 * Test design:
 *
 *   - O serviço sob teste é {@link createLocalidadesService}, exercitado com
 *     stubs para `fetchEstados`/`fetchCidades`/`getCache`/`upsertCache`/
 *     `resolveTtlMs`. Não há banco nem HTTP envolvidos: queremos verificar
 *     a propriedade *do contrato* do service, não da infraestrutura.
 *
 *   - Construímos um mapa `cidadesByUf` com algumas cidades por UF, com
 *     nomes distintos entre UFs (cada nome carrega o sufixo da UF para
 *     evitar colisões de "nome" entre estados, embora a propriedade não
 *     dependa disso — apenas reforça que um bug que misturasse listas
 *     seria detectado também via nomes).
 *
 *   - O stub de `fetchCidades` devolve, para cada `uf`, exatamente a lista
 *     correspondente em `cidadesByUf` — onde **cada `Cidade.estadoSigla`
 *     é igualada à UF consultada**, mimetizando o que `lib/ibge.fetchCidades`
 *     já faz em produção. Se `service.listarCidades(uf)` produzisse cidades
 *     com `estadoSigla` diferente, isso revelaria uma transformação
 *     incorreta dentro do próprio service (por exemplo, normalizar a UF e
 *     esquecer de propagar; usar a chave de cache errada; misturar listas
 *     entre UFs).
 *
 *   - O cache começa vazio (`getCache` sempre retorna `null`) e o
 *     `upsertCache` é um stub vazio. Não exercitamos cache stale aqui — a
 *     propriedade deve valer no caminho mais comum (cache miss + IBGE OK).
 *     Caminhos de fallback são cobertos pela Property 20.
 *
 *   - `numRuns: 100`, conforme a sub-task. O domínio finito (27 UFs) é
 *     amplamente coberto.
 */

import { describe, expect, it } from "vitest";
import * as fc from "fast-check";

import {
    createLocalidadesService,
    type LocalidadesDeps,
} from "@/server/localidades/service";
import type { Cidade, Estado } from "@/lib/ibge";

import { ufArb } from "./generators";

/**
 * Lista canônica das 27 UFs (espelha `generators.ts`). Não importamos a
 * constante interna do generator porque ela não é exportada; manter aqui
 * deixa o teste auto-contido e independente.
 */
const UFS = [
    "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA",
    "MG", "MS", "MT", "PA", "PB", "PE", "PI", "PR", "RJ", "RN",
    "RO", "RR", "RS", "SC", "SE", "SP", "TO",
] as const;

type Uf = (typeof UFS)[number];

/**
 * Constrói uma tabela `uf -> Cidade[]` com algumas cidades por UF, com nomes
 * distintos entre UFs. Cada `Cidade.estadoSigla` é fixada na própria UF, como
 * faz o cliente real `fetchCidades`. Os `id`s são deterministicamente
 * separados por UF para evitar colisões cruzadas.
 */
function buildCidadesByUf(): Record<Uf, Cidade[]> {
    const result = {} as Record<Uf, Cidade[]>;
    UFS.forEach((uf, ufIndex) => {
        const baseId = (ufIndex + 1) * 1000;
        result[uf] = [
            { id: baseId + 1, nome: `Capital ${uf}`, estadoSigla: uf },
            { id: baseId + 2, nome: `Interior 1 ${uf}`, estadoSigla: uf },
            { id: baseId + 3, nome: `Interior 2 ${uf}`, estadoSigla: uf },
        ];
    });
    return result;
}

/**
 * Lista de estados estática usada apenas para satisfazer a tipagem do stub —
 * o teste não chama `listarEstados` diretamente, mas mantemos uma lista
 * coerente para o caso de algum caminho interno do service consultá-la.
 */
const ESTADOS_STUB: Estado[] = UFS.map((uf) => ({ sigla: uf, nome: uf }));

/**
 * Cria as dependências stub para o `LocalidadesService`, fechadas sobre uma
 * tabela `cidadesByUf` previamente construída. UFs desconhecidas pelo stub
 * fazem `fetchCidades` lançar — esse caminho não é exercitado pela
 * propriedade, mas é mais seguro do que devolver lista vazia silenciosamente.
 */
function makeDeps(cidadesByUf: Record<Uf, Cidade[]>): LocalidadesDeps {
    return {
        fetchEstados: async () => ESTADOS_STUB,
        fetchCidades: async (uf: string) => {
            const list = cidadesByUf[uf as Uf];
            if (list === undefined) {
                throw new Error(
                    `Stub fetchCidades chamado com UF não preparada: ${uf}`,
                );
            }
            return list;
        },
        getCache: async () => null,
        upsertCache: async () => {
            /* no-op: o teste não verifica side-effects de cache */
        },
        resolveTtlMs: () => 24 * 60 * 60 * 1000,
    };
}

describe("Property 18: cidades retornadas pertencem ao estado consultado", () => {
    it("para toda UF válida, listarCidades(uf) retorna cidades com estadoSigla === uf (fast-check, 100 runs)", async () => {
        const cidadesByUf = buildCidadesByUf();
        const service = createLocalidadesService(makeDeps(cidadesByUf));

        await fc.assert(
            fc.asyncProperty(ufArb, async (uf) => {
                const result = await service.listarCidades(uf);

                // Pré-condição da propriedade: a UF gerada está no domínio
                // suportado e o stub respondeu OK; em qualquer outro caso o
                // service teria sinalizado falha total e a invariante "todas
                // as cidades pertencem à UF" seria vacuamente satisfeita
                // sem termos de fato testado nada — então exigimos `ok: true`.
                expect(result.ok).toBe(true);
                if (!result.ok) return;

                // Sanity: o stub devolveu uma lista não vazia, então a
                // verificação tem alguma força.
                expect(result.cidades.length).toBeGreaterThan(0);

                // INVARIANTE central da Property 18: cada cidade carrega a UF
                // consultada (após a normalização que o service aplica:
                // `uf.trim().toUpperCase()`). O `ufArb` gera siglas já em
                // caixa alta, então a igualdade direta basta aqui.
                for (const cidade of result.cidades) {
                    expect(cidade.estadoSigla).toBe(uf);
                }
            }),
            { numRuns: 100 },
        );
    });
});
