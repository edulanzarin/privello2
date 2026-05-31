/**
 * Geocodificação por região via Nominatim (OSM) — T14.
 *
 * Resolve `(cidade, UF[, bairro])` para o **centroide** do bairro
 * (ou da cidade, quando o bairro não é informado / não é
 * encontrado). NÃO é endereço, rua, número ou CEP — o produto não
 * coleta isso e o mapa é uma vitrine por região.
 *
 * # Por que centroide (sem jitter)
 *
 * O mapa agrega perfis **por bairro**: mostra "3 acompanhantes na
 * Água Verde", "2 na Velha", etc. Pra isso, todos os perfis de um
 * mesmo bairro precisam cair exatamente no mesmo ponto (o centroide
 * do bairro) — assim a agregação por proximidade/igualdade funciona
 * e nenhuma rua específica é revelada. Sem bairro, o perfil cai no
 * centro da cidade.
 *
 * Este módulo é o único ponto de contato com o endpoint de
 * geocoding fora de `overpass.ts`. Tipos de `fetch`/`Response`
 * ficam confinados aqui.
 *
 * Falhas (timeout, rede, cidade desconhecida) retornam `null` —
 * geocoding é best-effort: o perfil continua existindo sem ponto no
 * mapa.
 */

/** Endpoint público padrão do Nominatim. */
export const NOMINATIM_GEOCODE_BASE_URL =
    "https://nominatim.openstreetmap.org";

/** Timeout do geocoding, em ms. */
export const GEOCODE_TIMEOUT_MS = 5_000;

/** User-Agent (política de uso do Nominatim exige identificação). */
const GEOCODE_USER_AGENT = "Privello/1.0 (https://privello.com)";

export interface LatLng {
    lat: number;
    lng: number;
}

/** Nível em que o centroide foi resolvido. */
export type GeocodeNivel = "BAIRRO" | "CIDADE";

export interface GeocodeResultado extends LatLng {
    nivel: GeocodeNivel;
}

export interface GeocodeOptions {
    baseUrl?: string;
    signal?: AbortSignal;
}

/**
 * Geocodifica `(cidade, UF[, bairro])` no centroide da região.
 *
 * - Com bairro: tenta o centroide do bairro. Se o Nominatim não
 *   achar o bairro, cai pro centro da cidade.
 * - Sem bairro: centro da cidade.
 *
 * Retorna `{ lat, lng, nivel }` ou `null` em qualquer falha. O
 * `nivel` informa se resolveu o bairro ou caiu na cidade — útil pra
 * UI/telemetria.
 */
export async function geocodificarRegiao(input: {
    cidadeNome: string;
    estadoSigla: string;
    bairroNome?: string | null;
    options?: GeocodeOptions;
}): Promise<GeocodeResultado | null> {
    const baseUrl = input.options?.baseUrl ?? NOMINATIM_GEOCODE_BASE_URL;
    const cidade = input.cidadeNome.trim();
    const uf = input.estadoSigla.trim();
    if (cidade.length === 0 || uf.length === 0) return null;

    const bairro = input.bairroNome?.trim();

    // 1ª tentativa: centroide do bairro (quando houver).
    if (bairro && bairro.length > 0) {
        const comBairro = await nominatimSearch(
            baseUrl,
            { city: cidade, state: uf, neighbourhood: bairro },
            input.options?.signal,
        );
        if (comBairro) {
            return { ...comBairro, nivel: "BAIRRO" };
        }
    }

    // Fallback: centro da cidade.
    const soCidade = await nominatimSearch(
        baseUrl,
        { city: cidade, state: uf },
        input.options?.signal,
    );
    if (soCidade) {
        return { ...soCidade, nivel: "CIDADE" };
    }

    return null;
}

/**
 * Faz uma busca no Nominatim e devolve o lat/lng do primeiro
 * resultado, ou `null`. Best-effort — qualquer erro vira `null`.
 *
 * Quando há bairro, usa busca **free-form** (`q=Bairro, Cidade, UF,
 * Brasil`) porque o parâmetro estruturado `neighbourhood=` é
 * ignorado pelo Nominatim em bairros brasileiros (devolve o
 * município no mesmo ponto). A free-form resolve o `suburb`
 * corretamente. Sem bairro, usa a busca estruturada por cidade.
 */
async function nominatimSearch(
    baseUrl: string,
    params: {
        city: string;
        state: string;
        neighbourhood?: string;
    },
    externalSignal?: AbortSignal,
): Promise<LatLng | null> {
    const qs = new URLSearchParams({
        format: "jsonv2",
        limit: "1",
    });
    if (params.neighbourhood) {
        // Free-form: o Nominatim resolve bairro BR só assim, e NÃO
        // aceita `q` misturado com parâmetros estruturados
        // (`city`/`state`/`country`) — então tudo vai no `q`.
        qs.set(
            "q",
            `${params.neighbourhood}, ${params.city}, ${params.state}, Brasil`,
        );
    } else {
        qs.set("city", params.city);
        qs.set("state", params.state);
        qs.set("country", "Brasil");
    }
    const url = `${baseUrl}/search?${qs.toString()}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), GEOCODE_TIMEOUT_MS);
    const onAbort = () => controller.abort();
    if (externalSignal) {
        if (externalSignal.aborted) {
            clearTimeout(timeout);
            return null;
        }
        externalSignal.addEventListener("abort", onAbort, { once: true });
    }

    try {
        const res = await fetch(url, {
            method: "GET",
            headers: {
                Accept: "application/json",
                "User-Agent": GEOCODE_USER_AGENT,
            },
            signal: controller.signal,
        });
        if (!res.ok) return null;
        const payload = (await res.json()) as unknown;
        if (!Array.isArray(payload) || payload.length === 0) return null;
        const first = payload[0] as { lat?: unknown; lon?: unknown };
        const lat = typeof first.lat === "string" ? Number(first.lat) : NaN;
        const lng = typeof first.lon === "string" ? Number(first.lon) : NaN;
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        return { lat, lng };
    } catch {
        return null;
    } finally {
        clearTimeout(timeout);
        if (externalSignal) {
            externalSignal.removeEventListener("abort", onAbort);
        }
    }
}
