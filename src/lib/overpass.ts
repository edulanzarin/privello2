/**
 * Cliente HTTP minimalista para listar bairros de uma cidade brasileira.
 *
 * Combina dois endpoints públicos do OpenStreetMap:
 *
 * 1. **Nominatim** resolve `(cidade, UF)` para o `osm_id` do polígono
 *    administrativo. Eliminando a dependência de tags `is_in:state*`,
 *    que NÃO são populadas universalmente nos boundaries brasileiros
 *    (cidades médias como Blumenau não têm essas tags, então uma query
 *    Overpass que filtra por elas retorna lista vazia).
 *
 * 2. **Overpass** lista os elementos com `place ∈ {suburb,
 *    neighbourhood, quarter}` dentro da área âncora retornada pelo
 *    Nominatim. Esse é o método robusto: funciona para qualquer cidade
 *    cujo boundary esteja mapeado no OSM (todas as cidades brasileiras
 *    têm boundary).
 *
 * Este módulo é o ÚNICO ponto de contato direto com Nominatim/Overpass
 * no código da Privello. Tipos `fetch`/`Response`/`AbortError` ficam
 * confinados aqui; o restante da plataforma só vê `Bairro` e
 * `OverpassError`.
 *
 * # Política de uso
 *
 * Os servidores públicos pedem:
 *
 * - `User-Agent` identificável (`Privello/1.0`).
 * - Sem loop apertado (timeout interno + cache na camada acima já
 *   resolvem isso).
 * - Atribuir "© OpenStreetMap contributors" no produto final.
 *
 * Comportamento:
 *
 * - Timeout total de 8s no Overpass, 5s no Nominatim.
 * - Em estouro, lança `OverpassError("OVERPASS_TIMEOUT", ...)`.
 * - Em outras falhas (rede, status não-2xx, payload inesperado),
 *   `OverpassError("OVERPASS_ERROR", ...)` preservando a `cause`.
 */

/** Endpoint público padrão da API Overpass. */
export const OVERPASS_DEFAULT_BASE_URL =
    "https://overpass-api.de/api/interpreter";

/** Endpoint público padrão do Nominatim (OSM). */
export const NOMINATIM_DEFAULT_BASE_URL =
    "https://nominatim.openstreetmap.org";

/** Timeout do Overpass, em milissegundos. */
export const OVERPASS_TIMEOUT_MS = 8_000;

/** Timeout do Nominatim, em milissegundos. */
export const NOMINATIM_TIMEOUT_MS = 5_000;

/** User-Agent enviado nas requisições. */
export const OVERPASS_USER_AGENT = "Privello/1.0 (https://privello.com)";

/**
 * Bairro retornado pelo `Sistema_de_Localidades`. Os campos são
 * deliberadamente mínimos: apenas o que o autocomplete da UI precisa.
 */
export type Bairro = {
    /** Nome do bairro como aparece no OSM (ex.: `"Moema"`). */
    nome: string;
};

/** Códigos de erro expostos por `OverpassError`. */
export type OverpassErrorCode = "OVERPASS_TIMEOUT" | "OVERPASS_ERROR";

/**
 * Erro traduzido de qualquer falha ao consultar Nominatim ou Overpass.
 */
export class OverpassError extends Error {
    public readonly code: OverpassErrorCode;

    constructor(
        code: OverpassErrorCode,
        message: string,
        options?: { cause?: unknown },
    ) {
        super(message, options);
        this.name = "OverpassError";
        this.code = code;
    }
}

/** Opções comuns aos métodos de busca. */
export type OverpassFetchOptions = {
    /** URL do Overpass. Default: `OVERPASS_DEFAULT_BASE_URL`. */
    baseUrl?: string;
    /** URL do Nominatim. Default: `NOMINATIM_DEFAULT_BASE_URL`. */
    nominatimBaseUrl?: string;
    /** Sinal externo opcional para cancelamento. */
    signal?: AbortSignal;
};

// ---------------------------------------------------------------------------
// Nominatim — resolução cidade → osm_id do boundary
// ---------------------------------------------------------------------------

type NominatimMatch = {
    osmId: number;
    osmType: "node" | "way" | "relation";
};

/**
 * Resolve `(cidade, UF)` para o `osm_id` + `osm_type` do polígono
 * administrativo correspondente no OSM. Tenta a busca com `state` (nome
 * por extenso ou sigla; o Nominatim aceita ambos) e retorna o primeiro
 * match com `osm_type` em `{relation, way}`. Nodes sozinhos (sem
 * polígono) são descartados porque não servem como área para o
 * Overpass.
 *
 * Lança `OverpassError("OVERPASS_ERROR", ...)` quando não encontra
 * nenhum match utilizável (cidade desconhecida pelo Nominatim).
 */
async function resolveCidadeOsmId(
    nominatimBase: string,
    estadoSigla: string,
    cidadeNome: string,
    externalSignal?: AbortSignal,
): Promise<NominatimMatch> {
    const url =
        `${nominatimBase}/search` +
        `?city=${encodeURIComponent(cidadeNome)}` +
        `&state=${encodeURIComponent(estadoSigla)}` +
        `&country=Brasil` +
        `&format=jsonv2` +
        `&limit=5`;

    const payload = await timedFetch<unknown[]>(
        url,
        {
            method: "GET",
            headers: {
                Accept: "application/json",
                "User-Agent": OVERPASS_USER_AGENT,
            },
        },
        NOMINATIM_TIMEOUT_MS,
        externalSignal,
    );

    if (!Array.isArray(payload) || payload.length === 0) {
        throw new OverpassError(
            "OVERPASS_ERROR",
            `Nominatim não encontrou a cidade "${cidadeNome}/${estadoSigla}".`,
        );
    }

    for (const raw of payload) {
        if (raw === null || typeof raw !== "object") continue;
        const obj = raw as {
            osm_id?: unknown;
            osm_type?: unknown;
        };
        if (
            typeof obj.osm_id === "number" &&
            (obj.osm_type === "relation" || obj.osm_type === "way")
        ) {
            return { osmId: obj.osm_id, osmType: obj.osm_type };
        }
    }

    throw new OverpassError(
        "OVERPASS_ERROR",
        `Nominatim retornou apenas nodes para "${cidadeNome}/${estadoSigla}", sem polígono utilizável.`,
    );
}

/**
 * Calcula o `area_id` que o Overpass usa internamente a partir do
 * `osm_id` + `osm_type`. Convenção do Overpass:
 *
 * - `relation` ⇒ `area_id = 3_600_000_000 + osm_id`
 * - `way`      ⇒ `area_id = 2_400_000_000 + osm_id`
 *
 * Ver "Areas" na documentação do Overpass QL.
 */
function osmIdToAreaId(match: NominatimMatch): number {
    const offset = match.osmType === "relation" ? 3_600_000_000 : 2_400_000_000;
    return offset + match.osmId;
}

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

/**
 * Lista os bairros de uma cidade brasileira a partir do OpenStreetMap.
 *
 * Estratégia:
 *
 * 1. Resolve o boundary da cidade no Nominatim (1 chamada).
 * 2. Pede ao Overpass todos os elementos `place ∈ {suburb,
 *    neighbourhood, quarter}` dentro daquela área (1 chamada).
 * 3. Deduplica por nome e ordena alfabeticamente.
 *
 * Retorna lista vazia quando o Overpass não tem bairros mapeados
 * dentro do boundary (acontece em cidades pequenas onde mappers ainda
 * não catalogaram). Para falhas de transporte/timeout, lança
 * `OverpassError`.
 */
export async function fetchBairros(
    estadoSigla: string,
    cidadeNome: string,
    opts: OverpassFetchOptions = {},
): Promise<Bairro[]> {
    const overpassBase = opts.baseUrl ?? OVERPASS_DEFAULT_BASE_URL;
    const nominatimBase =
        opts.nominatimBaseUrl ?? NOMINATIM_DEFAULT_BASE_URL;

    const match = await resolveCidadeOsmId(
        nominatimBase,
        estadoSigla.trim(),
        cidadeNome.trim(),
        opts.signal,
    );

    const areaId = osmIdToAreaId(match);
    const ql = buildOverpassQL(areaId);

    const payload = await timedFetch<unknown>(
        overpassBase,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "User-Agent": OVERPASS_USER_AGENT,
                Accept: "application/json",
            },
            body: `data=${encodeURIComponent(ql)}`,
        },
        OVERPASS_TIMEOUT_MS,
        opts.signal,
    );

    if (
        payload === null ||
        typeof payload !== "object" ||
        !Array.isArray((payload as { elements?: unknown }).elements)
    ) {
        throw new OverpassError(
            "OVERPASS_ERROR",
            "Resposta inesperada da Overpass: campo `elements` ausente ou inválido.",
        );
    }

    const elements = (payload as { elements: unknown[] }).elements;
    const seen = new Set<string>();
    const bairros: Bairro[] = [];

    for (const raw of elements) {
        if (raw === null || typeof raw !== "object") continue;
        const tags = (raw as { tags?: unknown }).tags;
        if (tags === null || typeof tags !== "object") continue;
        const name = (tags as { name?: unknown }).name;
        if (typeof name !== "string") continue;
        const trimmed = name.trim();
        if (trimmed.length === 0) continue;
        const key = trimmed.toLocaleLowerCase("pt-BR");
        if (seen.has(key)) continue;
        seen.add(key);
        bairros.push({ nome: trimmed });
    }

    bairros.sort((a, b) =>
        a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" }),
    );
    return bairros;
}

/**
 * Constrói a Overpass QL que lista bairros dentro da `area_id`
 * resolvida pelo Nominatim. Aceita os três tipos de elemento
 * (`node`, `way`, `relation`) porque mappers usam todos para bairros
 * dependendo da cidade.
 */
function buildOverpassQL(areaId: number): string {
    return `
[out:json][timeout:6];
(
  node["place"~"^(suburb|neighbourhood|quarter)$"](area:${areaId});
  way["place"~"^(suburb|neighbourhood|quarter)$"](area:${areaId});
  relation["place"~"^(suburb|neighbourhood|quarter)$"](area:${areaId});
);
out tags;
`.trim();
}

// ---------------------------------------------------------------------------
// HTTP helper com timeout
// ---------------------------------------------------------------------------

/**
 * GET/POST com timeout duro. Centraliza a tradução de erros de
 * transporte (`AbortError`, status HTTP, JSON inválido) em
 * `OverpassError`. Reusado pelas chamadas a Nominatim e Overpass.
 */
async function timedFetch<T>(
    url: string,
    init: RequestInit,
    timeoutMs: number,
    externalSignal?: AbortSignal,
): Promise<T> {
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => {
        controller.abort(new OverpassTimeoutReason());
    }, timeoutMs);

    const onExternalAbort = () => {
        controller.abort(externalSignal?.reason);
    };
    if (externalSignal) {
        if (externalSignal.aborted) {
            clearTimeout(timeoutHandle);
            throw new OverpassError(
                "OVERPASS_ERROR",
                "Requisição cancelada pelo chamador antes do envio.",
                { cause: externalSignal.reason },
            );
        }
        externalSignal.addEventListener("abort", onExternalAbort, {
            once: true,
        });
    }

    let response: Response;
    try {
        response = await fetch(url, { ...init, signal: controller.signal });
    } catch (err) {
        if (isTimeoutAbort(controller.signal, err)) {
            throw new OverpassError(
                "OVERPASS_TIMEOUT",
                `Endpoint não respondeu em ${timeoutMs}ms: ${url}`,
                { cause: err },
            );
        }
        throw new OverpassError(
            "OVERPASS_ERROR",
            `Falha de rede em ${url}.`,
            { cause: err },
        );
    } finally {
        clearTimeout(timeoutHandle);
        if (externalSignal) {
            externalSignal.removeEventListener("abort", onExternalAbort);
        }
    }

    if (!response.ok) {
        throw new OverpassError(
            "OVERPASS_ERROR",
            `HTTP ${response.status} em ${url}.`,
        );
    }

    try {
        return (await response.json()) as T;
    } catch (err) {
        throw new OverpassError(
            "OVERPASS_ERROR",
            `Falha ao decodificar JSON em ${url}.`,
            { cause: err },
        );
    }
}

class OverpassTimeoutReason {
    public readonly __overpassTimeout = true;
}

function isTimeoutAbort(internalSignal: AbortSignal, err: unknown): boolean {
    if (!internalSignal.aborted) return false;
    const reason = internalSignal.reason;
    if (reason instanceof OverpassTimeoutReason) return true;
    if (
        err !== null &&
        typeof err === "object" &&
        "name" in err &&
        (err as { name?: unknown }).name === "AbortError"
    ) {
        return reason instanceof OverpassTimeoutReason || reason === undefined;
    }
    return false;
}
