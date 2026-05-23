/**
 * Integration test (task 13.4): `Sistema_de_Localidades` com IBGE indisponível.
 *
 * Esse teste exercita `LocalidadesService.listarEstados()` e
 * `LocalidadesService.listarCidades("SP")` no cenário onde a cache local
 * está vazia e a API_IBGE está indisponível (lança `IbgeError`).
 *
 * Ele cobre, com inputs concretos (1–2 exemplos), as três garantias exigidas
 * pelo design para esse cenário:
 *
 *   1. Cache ausente + IBGE em falha ⇒ `{ ok: false }`.
 *   2. Três retentativas consecutivas no mesmo estado de falha continuam
 *      retornando `{ ok: false }` (o serviço não cacheia falhas, não se
 *      "auto-corrompe" e não muda o resultado entre chamadas).
 *   3. Quando o IBGE volta a responder, a próxima chamada é bem-sucedida e
 *      preenche a cache via `upsertCache(...)`.
 *
 * O teste é montado sobre `createLocalidadesService(deps)` com dependências
 * injetadas — sem banco real e sem HTTP real. O cliente do IBGE é um stub
 * controlável que troca entre falha (`IbgeError`) e sucesso por meio de uma
 * flag compartilhada, o que reproduz fielmente as transições "indisponível
 * → recuperado" sem precisar de `vi.mock` nem `msw`.
 *
 * Validates: Requirements 4.1, 4.4.
 */

import { describe, expect, it } from "vitest";

import { IbgeError, type Cidade, type Estado } from "@/lib/ibge";
import type { IbgeCacheLookup } from "@/server/localidades/ibgeCache";
import {
    createLocalidadesService,
    type LocalidadesDeps,
} from "@/server/localidades/service";

// ---------------------------------------------------------------------------
// Fixed payloads served when IBGE recovers.
// ---------------------------------------------------------------------------

const FRESH_ESTADOS: Estado[] = [
    { sigla: "RJ", nome: "Rio de Janeiro" },
    { sigla: "SP", nome: "São Paulo" },
];

const FRESH_CIDADES_SP: Cidade[] = [
    { id: 3550308, nome: "São Paulo", estadoSigla: "SP" },
    { id: 3509502, nome: "Campinas", estadoSigla: "SP" },
];

/** TTL devolvido por `resolveTtlMs`; valor dentro do intervalo permitido. */
const STUB_TTL_MS = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Stub factory
// ---------------------------------------------------------------------------

type StubControl = {
    /** Quando `true`, ambos os endpoints do IBGE lançam `IbgeError`. */
    ibgeFailing: boolean;
    counters: {
        getCacheCalls: number;
        upsertCalls: number;
        fetchEstadosCalls: number;
        fetchCidadesCalls: number;
    };
    /** "Cache" persistente — começa vazio. */
    store: Map<string, IbgeCacheLookup<unknown>>;
};

/**
 * Cria um conjunto fresh de `LocalidadesDeps` mais um handle de controle.
 *
 * - `getCache` espelha um cache em memória (vazio inicialmente). Quando o
 *   service chama `upsertCache`, gravamos uma entrada `isExpired: false`,
 *   simulando uma cache válida pós-sucesso do IBGE — o que também valida
 *   que o serviço só passa a evitar o IBGE depois que ele responde uma vez.
 * - Falhas do IBGE são modeladas com `IbgeError`, exatamente como em
 *   `lib/ibge.ts`. Outros erros não disparam fallback (por design), e o
 *   teste não precisa cobri-los aqui.
 */
function makeStubs(): {
    control: StubControl;
    deps: LocalidadesDeps;
} {
    const control: StubControl = {
        ibgeFailing: true,
        counters: {
            getCacheCalls: 0,
            upsertCalls: 0,
            fetchEstadosCalls: 0,
            fetchCidadesCalls: 0,
        },
        store: new Map(),
    };

    const deps: LocalidadesDeps = {
        getCache: async <T = unknown>(
            key: string,
        ): Promise<IbgeCacheLookup<T> | null> => {
            control.counters.getCacheCalls += 1;
            const entry = control.store.get(key);
            return (entry ?? null) as IbgeCacheLookup<T> | null;
        },
        upsertCache: async (
            key: string,
            payload: unknown,
            ttlMs: number,
        ): Promise<void> => {
            control.counters.upsertCalls += 1;
            const fetchedAt = new Date();
            const expiresAt = new Date(fetchedAt.getTime() + ttlMs);
            control.store.set(key, {
                payload,
                fetchedAt,
                expiresAt,
                isExpired: false,
            });
        },
        fetchEstados: async (): Promise<Estado[]> => {
            control.counters.fetchEstadosCalls += 1;
            if (control.ibgeFailing) {
                throw new IbgeError("IBGE_TIMEOUT", "stub: IBGE indisponível");
            }
            return FRESH_ESTADOS;
        },
        fetchCidades: async (uf: string): Promise<Cidade[]> => {
            control.counters.fetchCidadesCalls += 1;
            if (uf !== uf.toUpperCase()) {
                throw new Error(
                    `stub fetchCidades: expected normalised UF, got "${uf}"`,
                );
            }
            if (control.ibgeFailing) {
                throw new IbgeError("IBGE_ERROR", "stub: IBGE indisponível");
            }
            return FRESH_CIDADES_SP;
        },
        resolveTtlMs: (): number => STUB_TTL_MS,
    };

    return { control, deps };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Integration: LocalidadesService com IBGE indisponível", () => {
    it("listarEstados retorna { ok: false } em 3 retentativas e recupera quando IBGE volta", async () => {
        const { control, deps } = makeStubs();
        const service = createLocalidadesService(deps);

        // Três retentativas com cache vazia + IBGE falhando.
        for (let i = 0; i < 3; i += 1) {
            const result = await service.listarEstados();
            expect(result).toEqual({ ok: false });
        }

        // Cada retentativa consultou cache + IBGE e nunca gravou nada.
        expect(control.counters.fetchEstadosCalls).toBe(3);
        expect(control.counters.upsertCalls).toBe(0);
        expect(control.store.size).toBe(0);

        // IBGE volta a responder.
        control.ibgeFailing = false;

        const recovered = await service.listarEstados();
        expect(recovered).toEqual({
            ok: true,
            estados: FRESH_ESTADOS,
            stale: false,
        });

        // O sucesso disparou exatamente um upsert na chave "estados".
        expect(control.counters.fetchEstadosCalls).toBe(4);
        expect(control.counters.upsertCalls).toBe(1);
        expect(control.store.has("estados")).toBe(true);
    });

    it("listarCidades(uf) segue o mesmo contrato: falha consistente e depois recuperação", async () => {
        const { control, deps } = makeStubs();
        const service = createLocalidadesService(deps);

        for (let i = 0; i < 3; i += 1) {
            const result = await service.listarCidades("SP");
            expect(result).toEqual({ ok: false });
        }

        expect(control.counters.fetchCidadesCalls).toBe(3);
        expect(control.counters.upsertCalls).toBe(0);
        expect(control.store.size).toBe(0);

        control.ibgeFailing = false;

        const recovered = await service.listarCidades("SP");
        expect(recovered).toEqual({
            ok: true,
            cidades: FRESH_CIDADES_SP,
            stale: false,
        });

        expect(control.counters.fetchCidadesCalls).toBe(4);
        expect(control.counters.upsertCalls).toBe(1);
        expect(control.store.has("cidades:SP")).toBe(true);
    });
});
