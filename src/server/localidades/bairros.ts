/**
 * Sistema_de_Localidades — listagem de bairros por cidade.
 *
 * Reusa a mesma tabela de cache (`IbgeCacheEntry`) e helpers (`getCache`/
 * `upsertCache`) do fluxo de estados/cidades. As chaves de cache de
 * bairros são prefixadas com `bairros:` para coexistirem com as chaves
 * `estados`/`cidades:UF` no mesmo store.
 *
 * # Política de fallback
 *
 * Igual à do `LocalidadesService` para estados/cidades:
 *
 * | Cache       | Overpass    | Resultado                                       |
 * | ----------- | ----------- | ----------------------------------------------- |
 * | VALIDO      | (não chama) | `{ ok: true, …, stale: false }`                 |
 * | AUSENTE     | OK          | `{ ok: true, …, stale: false }` + upsertCache   |
 * | EXPIRADO    | OK          | `{ ok: true, …, stale: false }` + upsertCache   |
 * | AUSENTE     | FALHA       | `{ ok: false }`                                 |
 * | EXPIRADO    | FALHA       | `{ ok: true, …, stale: true }`                  |
 *
 * Lista vazia (cidade sem bairros mapeados no OSM) é considerada
 * **sucesso** e cacheada normalmente — diferente de erro de transporte.
 * A camada de UI usa `bairros.length === 0` para exibir "Nenhum bairro
 * encontrado para esta cidade" e cair em campo livre opcional.
 */

import {
    fetchBairros as defaultFetchBairros,
    OverpassError,
    type Bairro,
} from "@/lib/overpass";

import {
    getCache as defaultGetCache,
    resolveTtlMsFromEnv,
    upsertCache as defaultUpsertCache,
    type IbgeCacheLookup,
} from "./ibgeCache";

// ---------------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------------

export type ListarBairrosOk = {
    ok: true;
    bairros: Bairro[];
    /** `true` quando servido de cache stale por falha do Overpass. */
    stale: boolean;
};

export type ListarBairrosResult = ListarBairrosOk | { ok: false };

export interface BairrosService {
    listarBairros(
        estadoSigla: string,
        cidadeNome: string,
        opts?: { refresh?: boolean },
    ): Promise<ListarBairrosResult>;
}

export type BairrosDeps = {
    fetchBairros: (uf: string, cidade: string) => Promise<Bairro[]>;
    getCache: <T = unknown>(key: string) => Promise<IbgeCacheLookup<T> | null>;
    upsertCache: (key: string, payload: unknown, ttlMs: number) => Promise<void>;
    resolveTtlMs: () => number;
};

// ---------------------------------------------------------------------------
// Constantes internas
// ---------------------------------------------------------------------------

/**
 * Constrói a chave de cache. Inclui UF + cidade normalizadas em caixa
 * baixa para que duas grafias diferentes da mesma cidade colidam no
 * mesmo registro de cache.
 */
function keyBairros(uf: string, cidade: string): string {
    const ufNorm = uf.trim().toLowerCase();
    const cidadeNorm = cidade.trim().toLocaleLowerCase("pt-BR");
    return `bairros:${ufNorm}:${cidadeNorm}`;
}

// ---------------------------------------------------------------------------
// Fábrica do service
// ---------------------------------------------------------------------------

export function createBairrosService(deps: BairrosDeps): BairrosService {
    async function listarBairros(
        estadoSigla: string,
        cidadeNome: string,
        opts?: { refresh?: boolean },
    ): Promise<ListarBairrosResult> {
        const uf = estadoSigla.trim().toUpperCase();
        const cidade = cidadeNome.trim();
        if (uf.length === 0 || cidade.length === 0) {
            return { ok: false };
        }

        const key = keyBairros(uf, cidade);
        const refresh = opts?.refresh === true;
        const cached = refresh ? null : await deps.getCache<Bairro[]>(key);

        // Cache válido + não-vazio: serve direto sem chamar Overpass.
        // Se o cache traz lista vazia, ignoramos e tentamos a API de
        // novo: lista vazia geralmente indica resposta degradada de uma
        // tentativa anterior, e não vale "trancar" o usuário em uma UF
        // que de fato tem bairros mapeados no OSM.
        if (
            cached !== null &&
            !cached.isExpired &&
            cached.payload.length > 0
        ) {
            return { ok: true, bairros: cached.payload, stale: false };
        }

        try {
            const fresh = await deps.fetchBairros(uf, cidade);
            // Só cacheamos resultados não-vazios: lista vazia pode ser
            // transiente (Overpass com timeout interno) ou bug de query
            // que ainda vamos investigar; melhor pagar a chamada de novo
            // numa próxima tentativa do que selar o usuário com vazio
            // por TTL inteiro.
            if (fresh.length > 0) {
                await deps.upsertCache(key, fresh, deps.resolveTtlMs());
            }
            return { ok: true, bairros: fresh, stale: false };
        } catch (err) {
            if (!(err instanceof OverpassError)) {
                throw err;
            }
            // Em caso de falha de transporte, ainda servimos o cache
            // expirado/vazio se houver — UI cai para o estado
            // "indisponível", mas pelo menos não trava o avanço.
            if (cached !== null && cached.payload.length > 0) {
                return { ok: true, bairros: cached.payload, stale: true };
            }
            return { ok: false };
        }
    }

    return { listarBairros };
}

/**
 * Instância padrão pronta para uso em produção. Reusa o cache do IBGE
 * (mesma tabela, chaves prefixadas).
 */
export const defaultBairrosService: BairrosService = createBairrosService({
    fetchBairros: (uf, cidade) => defaultFetchBairros(uf, cidade),
    getCache: defaultGetCache,
    upsertCache: defaultUpsertCache,
    resolveTtlMs: resolveTtlMsFromEnv,
});
