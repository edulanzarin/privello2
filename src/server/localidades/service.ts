/**
 * Sistema_de_Localidades — `LocalidadesService`.
 *
 * Implementa a política de cache + fallback determinística descrita no design
 * (Property 20) sobre a tabela `IbgeCacheEntry` e o cliente HTTP da API_IBGE.
 *
 * ### Política de fallback (cache × IBGE)
 *
 * Para cada chave de consulta (`"estados"` ou `"cidades:<UF>"`):
 *
 * | Cache       | IBGE       | Resultado                                                   |
 * | ----------- | ---------- | ------------------------------------------------------------ |
 * | `VALIDO`    | (não chama)| `{ ok: true, …, stale: false }`                             |
 * | `AUSENTE`   | `OK`       | `{ ok: true, …, stale: false }` + `upsertCache(...)`        |
 * | `EXPIRADO`  | `OK`       | `{ ok: true, …, stale: false }` + `upsertCache(...)`        |
 * | `AUSENTE`   | `FALHA`    | `{ ok: false }`                                             |
 * | `EXPIRADO`  | `FALHA`    | `{ ok: true, …, stale: true }` (servida do cache stale)     |
 *
 * Cache `VALIDO` significa `expiresAt > now`; `EXPIRADO` significa que o
 * registro existe no Postgres mas `expiresAt <= now`. `getCache` (em
 * `ibgeCache.ts`) já encapsula essa distinção via `isExpired`.
 *
 * ### Injeção de dependências
 *
 * Tanto o cliente IBGE quanto o repositório de cache são injetáveis via o
 * construtor `createLocalidadesService(deps)`, permitindo que testes
 * substituam ambos por stubs (sem precisar de banco/HTTP real). O
 * `defaultLocalidadesService` é a instância pronta para uso em produção,
 * fechada sobre os módulos reais (`fetchEstados`, `fetchCidades`, `getCache`,
 * `upsertCache`, `resolveTtlMsFromEnv`).
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5.
 */

import {
    fetchCidades as defaultFetchCidades,
    fetchEstados as defaultFetchEstados,
    IbgeError,
    type Cidade,
    type Estado,
} from "@/lib/ibge";

import {
    getCache as defaultGetCache,
    resolveTtlMsFromEnv,
    upsertCache as defaultUpsertCache,
    type IbgeCacheLookup,
} from "./ibgeCache";

// ---------------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------------

/** Resultado bem-sucedido de `listarEstados`. */
export type ListarEstadosOk = {
    ok: true;
    /** Lista de unidades federativas. */
    estados: Estado[];
    /**
     * `true` quando os dados foram servidos do cache expirado por falta de
     * resposta do IBGE; `false` em qualquer outro sucesso.
     */
    stale: boolean;
};

/** Resultado bem-sucedido de `listarCidades`. */
export type ListarCidadesOk = {
    ok: true;
    /** Lista de municípios da UF consultada. */
    cidades: Cidade[];
    /**
     * `true` quando os dados foram servidos do cache expirado por falta de
     * resposta do IBGE; `false` em qualquer outro sucesso.
     */
    stale: boolean;
};

/**
 * União de retorno padrão das listagens: ou os dados estão disponíveis (cache
 * válido, IBGE OK ou cache stale como fallback), ou nenhuma fonte respondeu
 * (cache ausente + IBGE falha).
 */
export type ListarResult<T extends ListarEstadosOk | ListarCidadesOk> =
    | T
    | { ok: false };

/** Contrato público do `LocalidadesService`. */
export interface LocalidadesService {
    /** Lista as 27 UFs do Brasil aplicando a política de cache + fallback. */
    listarEstados(): Promise<ListarResult<ListarEstadosOk>>;
    /**
     * Lista os municípios de uma UF aplicando a política de cache + fallback.
     * `estadoSigla` é normalizado para letras maiúsculas antes da consulta.
     */
    listarCidades(estadoSigla: string): Promise<ListarResult<ListarCidadesOk>>;
    /**
     * Retorna `true` se `(estadoSigla, cidadeNome)` pertencem ao produto
     * cartesiano oficial expressado pelas listagens. Falha de fonte (cache
     * ausente + IBGE indisponível) é tratada como `false` — quem chama é
     * responsável por bloquear o avanço do onboarding até obter resposta.
     */
    validar(estadoSigla: string, cidadeNome: string): Promise<boolean>;
}

/**
 * Dependências injetáveis do `LocalidadesService`. Em produção use o default
 * exportado por este módulo; testes podem passar stubs aqui.
 */
export type LocalidadesDeps = {
    /** Cliente HTTP de `estados`. Default: `lib/ibge.fetchEstados`. */
    fetchEstados: () => Promise<Estado[]>;
    /** Cliente HTTP de `cidades`. Default: `lib/ibge.fetchCidades`. */
    fetchCidades: (uf: string) => Promise<Cidade[]>;
    /** Lookup do cache (Postgres + in-memory). Default: `ibgeCache.getCache`. */
    getCache: <T = unknown>(key: string) => Promise<IbgeCacheLookup<T> | null>;
    /** Upsert no cache (Postgres + in-memory). Default: `ibgeCache.upsertCache`. */
    upsertCache: (
        key: string,
        payload: unknown,
        ttlMs: number,
    ) => Promise<void>;
    /**
     * Fonte do TTL aplicado a cada upsert (em ms, dentro do intervalo
     * `[24h, 7d]`). Default: `ibgeCache.resolveTtlMsFromEnv`.
     */
    resolveTtlMs: () => number;
};

// ---------------------------------------------------------------------------
// Constantes internas
// ---------------------------------------------------------------------------

/** Chave de cache para a listagem de estados. */
const KEY_ESTADOS = "estados";

/** Chave de cache para a listagem de cidades por UF. */
function keyCidades(uf: string): string {
    return `cidades:${uf}`;
}

// ---------------------------------------------------------------------------
// Fábrica do service
// ---------------------------------------------------------------------------

/**
 * Cria um `LocalidadesService` com as dependências fornecidas. Use
 * `defaultLocalidadesService` em produção; este construtor existe para
 * permitir injeção de stubs em testes.
 */
export function createLocalidadesService(
    deps: LocalidadesDeps,
): LocalidadesService {
    /**
     * Aplica a política de fallback descrita no topo do arquivo, parametrizada
     * pelo `key` do cache, pelo callback que chama o IBGE e pelo callback que
     * extrai a lista do "OK" para reuso entre estados e cidades.
     */
    async function fetchWithFallback<T>(
        key: string,
        fetchFromIbge: () => Promise<T>,
    ): Promise<{ ok: true; payload: T; stale: boolean } | { ok: false }> {
        const cached = await deps.getCache<T>(key);

        // 1. Cache VÁLIDO: retorna direto, sem chamar IBGE.
        if (cached !== null && !cached.isExpired) {
            return { ok: true, payload: cached.payload, stale: false };
        }

        // 2. Cache AUSENTE ou EXPIRADO: tenta IBGE.
        try {
            const fresh = await fetchFromIbge();
            await deps.upsertCache(key, fresh, deps.resolveTtlMs());
            return { ok: true, payload: fresh, stale: false };
        } catch (err) {
            // Apenas falhas conhecidas do adapter (timeout/erro) acionam
            // fallback; qualquer outro erro inesperado é propagado para que
            // bugs não fiquem mascarados como "IBGE indisponível".
            if (!(err instanceof IbgeError)) {
                throw err;
            }

            // 3. IBGE falhou e existe cache EXPIRADO: serve stale com flag.
            if (cached !== null) {
                return { ok: true, payload: cached.payload, stale: true };
            }

            // 4. IBGE falhou e cache AUSENTE: nenhuma fonte disponível.
            return { ok: false };
        }
    }

    async function listarEstados(): Promise<ListarResult<ListarEstadosOk>> {
        const result = await fetchWithFallback<Estado[]>(
            KEY_ESTADOS,
            deps.fetchEstados,
        );
        if (!result.ok) {
            return { ok: false };
        }
        return {
            ok: true,
            estados: result.payload,
            stale: result.stale,
        };
    }

    async function listarCidades(
        estadoSigla: string,
    ): Promise<ListarResult<ListarCidadesOk>> {
        const ufNormalized = estadoSigla.trim().toUpperCase();
        const result = await fetchWithFallback<Cidade[]>(
            keyCidades(ufNormalized),
            () => deps.fetchCidades(ufNormalized),
        );
        if (!result.ok) {
            return { ok: false };
        }
        return {
            ok: true,
            cidades: result.payload,
            stale: result.stale,
        };
    }

    async function validar(
        estadoSigla: string,
        cidadeNome: string,
    ): Promise<boolean> {
        const ufNormalized = estadoSigla.trim().toUpperCase();
        const cidadeTrimmed = cidadeNome.trim();
        if (ufNormalized === "" || cidadeTrimmed === "") {
            return false;
        }

        const estados = await listarEstados();
        if (!estados.ok) {
            return false;
        }
        if (!estados.estados.some((e) => e.sigla === ufNormalized)) {
            return false;
        }

        const cidades = await listarCidades(ufNormalized);
        if (!cidades.ok) {
            return false;
        }
        return cidades.cidades.some((c) => c.nome === cidadeTrimmed);
    }

    return { listarEstados, listarCidades, validar };
}

/**
 * Instância padrão do `LocalidadesService` para uso em produção, fechada sobre
 * os módulos reais. Em ambientes de teste, prefira `createLocalidadesService`
 * com stubs.
 */
export const defaultLocalidadesService: LocalidadesService =
    createLocalidadesService({
        fetchEstados: () => defaultFetchEstados(),
        fetchCidades: (uf) => defaultFetchCidades(uf),
        getCache: defaultGetCache,
        upsertCache: defaultUpsertCache,
        resolveTtlMs: resolveTtlMsFromEnv,
    });
