/**
 * Geocodificação aproximada via Nominatim (OSM) — T14.
 *
 * Resolve `(cidade, UF[, bairro])` para um par lat/lng **aproximado**.
 * Usado pra posicionar o perfil no mapa da busca. O resultado é
 * intencionalmente impreciso:
 *
 *   - Geocodificamos no nível de bairro/cidade — nunca endereço,
 *     número ou CEP (o produto não coleta isso).
 *   - Aplicamos um `jitter` (ruído aleatório de ~poucas centenas de
 *     metros) por cima do centroide pra que dois perfis do mesmo
 *     bairro não caiam no mesmo ponto e pra que ninguém infira
 *     localização real a partir do pin.
 *
 * Este módulo é o único ponto de contato com o endpoint de
 * geocoding fora de `overpass.ts`. Tipos de `fetch`/`Response`
 * ficam confinados aqui — o resto da plataforma só vê
 * `{ lat, lng } | null`.
 *
 * Falhas (timeout, rede, cidade desconhecida) retornam `null` —
 * geocoding é best-effort: o perfil continua existindo sem pin no
 * mapa.
 */

/** Endpoint público padrão do Nominatim. */
export const NOMINATIM_GEOCODE_BASE_URL =
    "https://nominatim.openstreetmap.org";

/** Timeout do geocoding, em ms. */
export const GEOCODE_TIMEOUT_MS = 5_000;

/** User-Agent (política de uso do Nominatim exige identificação). */
const GEOCODE_USER_AGENT = "Privello/1.0 (https://privello.com)";

/**
 * Amplitude máxima do jitter em graus de latitude/longitude.
 * ~0.0045° ≈ 500m. Aplicado como deslocamento aleatório uniforme
 * em [-amp, +amp] nas duas coordenadas. Suficiente pra anonimizar
 * sem tirar o pin do bairro.
 */
export const GEOCODE_JITTER_DEG = 0.0045;

export interface LatLng {
    lat: number;
    lng: number;
}

export interface GeocodeOptions {
    baseUrl?: string;
    signal?: AbortSignal;
    /**
     * Função de ruído determinística pra testes (retorna [0,1)).
     * Default: `Math.random`.
     */
    rng?: () => number;
}

/**
 * Aplica jitter uniforme em [-amp, +amp] em torno do ponto base.
 * Exportada pra teste direto.
 */
export function aplicarJitter(
    base: LatLng,
    amp: number,
    rng: () => number,
): LatLng {
    const dlat = (rng() * 2 - 1) * amp;
    const dlng = (rng() * 2 - 1) * amp;
    return {
        lat: clampLat(base.lat + dlat),
        lng: clampLng(base.lng + dlng),
    };
}

function clampLat(v: number): number {
    return Math.max(-90, Math.min(90, v));
}

function clampLng(v: number): number {
    // Normaliza pra [-180, 180].
    let x = v;
    while (x > 180) x -= 360;
    while (x < -180) x += 360;
    return x;
}

/**
 * Geocodifica `(cidade, UF[, bairro])` num par lat/lng aproximado
 * com jitter aplicado. Retorna `null` em qualquer falha.
 *
 * Tenta primeiro com o bairro (mais preciso); se não achar, cai pra
 * só cidade. O jitter é sempre aplicado por cima do centroide
 * retornado.
 */
export async function geocodificarAproximado(input: {
    cidadeNome: string;
    estadoSigla: string;
    bairroNome?: string | null;
    options?: GeocodeOptions;
}): Promise<LatLng | null> {
    const baseUrl = input.options?.baseUrl ?? NOMINATIM_GEOCODE_BASE_URL;
    const rng = input.options?.rng ?? Math.random;
    const cidade = input.cidadeNome.trim();
    const uf = input.estadoSigla.trim();
    if (cidade.length === 0 || uf.length === 0) return null;

    const bairro = input.bairroNome?.trim();

    // 1ª tentativa: com bairro (quando houver).
    if (bairro && bairro.length > 0) {
        const comBairro = await nominatimSearch(
            baseUrl,
            {
                city: cidade,
                state: uf,
                neighbourhood: bairro,
            },
            input.options?.signal,
        );
        if (comBairro) {
            return aplicarJitter(comBairro, GEOCODE_JITTER_DEG, rng);
        }
    }

    // 2ª tentativa: só cidade.
    const soCidade = await nominatimSearch(
        baseUrl,
        { city: cidade, state: uf },
        input.options?.signal,
    );
    if (soCidade) {
        return aplicarJitter(soCidade, GEOCODE_JITTER_DEG, rng);
    }

    return null;
}

/**
 * Faz uma busca estruturada no Nominatim e devolve o lat/lng do
 * primeiro resultado, ou `null`. Best-effort — qualquer erro vira
 * `null`.
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
        city: params.city,
        state: params.state,
        country: "Brasil",
        format: "jsonv2",
        limit: "1",
    });
    if (params.neighbourhood) {
        qs.set("neighbourhood", params.neighbourhood);
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
