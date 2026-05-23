/**
 * Sistema_de_Localidades — barrel export.
 *
 * Reexporta as APIs públicas do `LocalidadesService` e do repositório de cache
 * para que consumidores externos importem de `@/server/localidades` sem
 * precisar conhecer a estrutura interna do módulo.
 */
export {
    createLocalidadesService,
    defaultLocalidadesService,
    type LocalidadesDeps,
    type LocalidadesService,
    type ListarCidadesOk,
    type ListarEstadosOk,
    type ListarResult,
} from "./service";

export {
    createBairrosService,
    defaultBairrosService,
    type BairrosDeps,
    type BairrosService,
    type ListarBairrosOk,
    type ListarBairrosResult,
} from "./bairros";

export {
    getCache,
    resolveTtlMsFromEnv,
    resetInMemoryCache,
    upsertCache,
    IBGE_CACHE_TTL_DEFAULT_HOURS,
    IBGE_CACHE_TTL_MAX_MS,
    IBGE_CACHE_TTL_MIN_MS,
    type IbgeCacheLookup,
} from "./ibgeCache";
