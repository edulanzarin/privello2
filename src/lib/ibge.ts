/**
 * Cliente HTTP minimalista da API pública do IBGE para listar estados
 * (unidades federativas) e municípios brasileiros.
 *
 * Este módulo é o ÚNICO ponto de contato direto com a API_IBGE no código da
 * Privello. Os tipos `fetch`/`Response`/`AbortError` ficam confinados aqui:
 * o restante da plataforma só vê os tipos `Estado`, `Cidade` e os erros
 * traduzidos `IbgeError("IBGE_TIMEOUT" | "IBGE_ERROR", ...)`.
 *
 * Comportamento:
 * - Timeout total de 5 segundos por chamada (via `AbortController`).
 * - Em estouro do timeout (ou cancelamento equivalente), lança
 *   `IbgeError("IBGE_TIMEOUT", ...)`.
 * - Em qualquer outra falha (rede, status não-2xx, payload inesperado, JSON
 *   inválido), lança `IbgeError("IBGE_ERROR", ...)` preservando a `cause`.
 * - O `baseUrl` é injetado pelo chamador (preferido para testabilidade); o
 *   padrão recomendado é `process.env.IBGE_BASE_URL ?? IBGE_DEFAULT_BASE_URL`.
 *
 * Requirements: 4.1, 4.2, 4.4.
 */

/** Endpoint público padrão da API_IBGE. Usado quando nenhum `baseUrl` é informado. */
export const IBGE_DEFAULT_BASE_URL = "https://servicodados.ibge.gov.br/api";

/** Timeout por chamada à API_IBGE, em milissegundos (Requirement 4.1, 4.2). */
export const IBGE_TIMEOUT_MS = 5_000;

/** Unidade federativa retornada pelo `Sistema_de_Localidades`. */
export type Estado = {
    /** Sigla de duas letras maiúsculas (ex.: `"SP"`). */
    sigla: string;
    /** Nome oficial do estado (ex.: `"São Paulo"`). */
    nome: string;
};

/** Município retornado pelo `Sistema_de_Localidades`. */
export type Cidade = {
    /** Identificador numérico do IBGE para o município. */
    id: number;
    /** Nome oficial do município. */
    nome: string;
    /** Sigla da UF à qual o município pertence. */
    estadoSigla: string;
};

/** Códigos de erro expostos por `IbgeError`. */
export type IbgeErrorCode = "IBGE_TIMEOUT" | "IBGE_ERROR";

/**
 * Erro traduzido de qualquer falha ao consultar a API_IBGE.
 *
 * `code === "IBGE_TIMEOUT"` indica que a resposta não chegou dentro de
 * `IBGE_TIMEOUT_MS`. Qualquer outra falha (rede, status não-2xx, payload
 * inesperado) é reportada como `code === "IBGE_ERROR"`.
 */
export class IbgeError extends Error {
    public readonly code: IbgeErrorCode;

    constructor(code: IbgeErrorCode, message: string, options?: { cause?: unknown }) {
        super(message, options);
        this.name = "IbgeError";
        this.code = code;
    }
}

/** Opções comuns aos métodos de busca. */
export type IbgeFetchOptions = {
    /**
     * URL base da API_IBGE. Se omitido, usa `IBGE_DEFAULT_BASE_URL`.
     * Em produção o chamador deve passar `process.env.IBGE_BASE_URL ?? IBGE_DEFAULT_BASE_URL`.
     */
    baseUrl?: string;
    /**
     * Sinal externo opcional. Se abortado pelo chamador, a chamada é cancelada
     * e o método lança `IbgeError("IBGE_ERROR", ...)` (cancelamento externo
     * não é tratado como timeout interno).
     */
    signal?: AbortSignal;
};

/**
 * Busca a lista de unidades federativas do Brasil.
 *
 * Resolve com a lista ordenada por `sigla` (ordem alfabética case-insensitive).
 * Lança `IbgeError("IBGE_TIMEOUT", ...)` em caso de timeout ou
 * `IbgeError("IBGE_ERROR", ...)` em qualquer outra falha.
 */
export async function fetchEstados(
    opts: IbgeFetchOptions = {},
): Promise<Estado[]> {
    const baseUrl = resolveBaseUrl(opts.baseUrl);
    const url = `${baseUrl}/v1/localidades/estados`;
    const payload = await ibgeRequest(url, opts.signal);

    if (!Array.isArray(payload)) {
        throw new IbgeError(
            "IBGE_ERROR",
            "Resposta inesperada da API IBGE: payload de estados não é uma lista",
        );
    }

    const estados: Estado[] = [];
    for (const raw of payload) {
        if (
            raw === null ||
            typeof raw !== "object" ||
            typeof (raw as { sigla?: unknown }).sigla !== "string" ||
            typeof (raw as { nome?: unknown }).nome !== "string"
        ) {
            throw new IbgeError(
                "IBGE_ERROR",
                "Resposta inesperada da API IBGE: estado sem `sigla`/`nome`",
            );
        }
        const { sigla, nome } = raw as { sigla: string; nome: string };
        estados.push({ sigla, nome });
    }

    estados.sort((a, b) =>
        a.sigla.localeCompare(b.sigla, "pt-BR", { sensitivity: "base" }),
    );
    return estados;
}

/**
 * Busca a lista de municípios de uma UF.
 *
 * O parâmetro `uf` é a sigla de duas letras (ex.: `"SP"`); é repassado para a
 * URL e também usado como `estadoSigla` em cada item retornado.
 *
 * Lança `IbgeError("IBGE_TIMEOUT", ...)` em caso de timeout ou
 * `IbgeError("IBGE_ERROR", ...)` em qualquer outra falha.
 */
export async function fetchCidades(
    uf: string,
    opts: IbgeFetchOptions = {},
): Promise<Cidade[]> {
    const baseUrl = resolveBaseUrl(opts.baseUrl);
    const ufPath = encodeURIComponent(uf);
    const url = `${baseUrl}/v1/localidades/estados/${ufPath}/municipios`;
    const payload = await ibgeRequest(url, opts.signal);

    if (!Array.isArray(payload)) {
        throw new IbgeError(
            "IBGE_ERROR",
            "Resposta inesperada da API IBGE: payload de municípios não é uma lista",
        );
    }

    const cidades: Cidade[] = [];
    for (const raw of payload) {
        if (
            raw === null ||
            typeof raw !== "object" ||
            typeof (raw as { id?: unknown }).id !== "number" ||
            !Number.isFinite((raw as { id: number }).id) ||
            typeof (raw as { nome?: unknown }).nome !== "string"
        ) {
            throw new IbgeError(
                "IBGE_ERROR",
                "Resposta inesperada da API IBGE: município sem `id`/`nome`",
            );
        }
        const { id, nome } = raw as { id: number; nome: string };
        cidades.push({ id, nome, estadoSigla: uf });
    }

    return cidades;
}

/**
 * Executa um GET na API_IBGE com timeout duro de 5s e parsing de JSON.
 *
 * Centraliza a tradução dos erros de transporte (`AbortError`, status HTTP,
 * JSON inválido) para `IbgeError`.
 */
async function ibgeRequest(url: string, externalSignal?: AbortSignal): Promise<unknown> {
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => {
        // Marcar o motivo permite distinguir timeout interno de cancelamento externo.
        controller.abort(new TimeoutAbortReason());
    }, IBGE_TIMEOUT_MS);

    const onExternalAbort = () => {
        // Propaga o cancelamento externo preservando o motivo original do chamador.
        controller.abort(externalSignal?.reason);
    };
    if (externalSignal) {
        if (externalSignal.aborted) {
            clearTimeout(timeoutHandle);
            throw new IbgeError(
                "IBGE_ERROR",
                "Requisição IBGE cancelada pelo chamador antes do envio",
                { cause: externalSignal.reason },
            );
        }
        externalSignal.addEventListener("abort", onExternalAbort, { once: true });
    }

    let response: Response;
    try {
        response = await fetch(url, {
            method: "GET",
            headers: { Accept: "application/json" },
            signal: controller.signal,
        });
    } catch (err) {
        if (isTimeoutAbort(controller.signal, err)) {
            throw new IbgeError(
                "IBGE_TIMEOUT",
                `IBGE não respondeu em ${IBGE_TIMEOUT_MS}ms para ${url}`,
                { cause: err },
            );
        }
        throw new IbgeError(
            "IBGE_ERROR",
            `Falha de rede ao consultar IBGE em ${url}`,
            { cause: err },
        );
    } finally {
        clearTimeout(timeoutHandle);
        if (externalSignal) {
            externalSignal.removeEventListener("abort", onExternalAbort);
        }
    }

    if (!response.ok) {
        throw new IbgeError(
            "IBGE_ERROR",
            `IBGE respondeu com status ${response.status} para ${url}`,
        );
    }

    try {
        return await response.json();
    } catch (err) {
        throw new IbgeError(
            "IBGE_ERROR",
            `Falha ao decodificar JSON da IBGE em ${url}`,
            { cause: err },
        );
    }
}

/** Marca o motivo de um abort como timeout interno deste módulo. */
class TimeoutAbortReason {
    public readonly __ibgeTimeout = true;
}

/**
 * Indica se o erro recebido por `fetch` corresponde ao timeout interno
 * disparado pelo nosso `AbortController`. Aceita tanto a marca explícita
 * (`TimeoutAbortReason`) quanto o `DOMException` padrão `AbortError` quando o
 * `signal` interno foi abortado por nós.
 */
function isTimeoutAbort(internalSignal: AbortSignal, err: unknown): boolean {
    if (!internalSignal.aborted) return false;
    const reason = internalSignal.reason;
    if (reason instanceof TimeoutAbortReason) return true;
    // Em ambientes onde `reason` não é preservado, caímos no nome do erro.
    if (
        err !== null &&
        typeof err === "object" &&
        "name" in err &&
        (err as { name?: unknown }).name === "AbortError"
    ) {
        // Só consideramos timeout se NÃO houve abort externo: o chamador deve
        // identificar seu próprio cancelamento como erro genérico, não como timeout.
        return reason instanceof TimeoutAbortReason || reason === undefined;
    }
    return false;
}

/** Normaliza o `baseUrl`, removendo barra final, e aplica o default. */
function resolveBaseUrl(baseUrl: string | undefined): string {
    const value = baseUrl ?? IBGE_DEFAULT_BASE_URL;
    return value.endsWith("/") ? value.slice(0, -1) : value;
}
