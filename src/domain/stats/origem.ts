/**
 * Classificação de origem de uma visualização de perfil (T10).
 *
 * A origem é derivada do header `Referer` da requisição que dispara
 * o tracking de view, comparado com o host do próprio site:
 *
 *   - **BUSCA**: referrer interno apontando pra `/acompanhantes`
 *     (página de busca/listagem).
 *   - **HOME**: referrer interno apontando pra raiz `/`.
 *   - **COMPARTILHADO**: referrer externo (outro domínio — rede
 *     social, WhatsApp, Google, etc).
 *   - **DIRECT**: sem referrer (link colado, app nativo, bookmark)
 *     OU referrer interno de outra página qualquer (ex.: outro
 *     perfil) que não se encaixa em BUSCA/HOME.
 *
 * Função pura e determinística — fácil de testar sem mock de
 * request. O caller extrai `Referer` e o host antes de chamar.
 */

export type ViewOrigin = "BUSCA" | "HOME" | "DIRECT" | "COMPARTILHADO";

export const VIEW_ORIGINS: ReadonlyArray<ViewOrigin> = [
    "BUSCA",
    "HOME",
    "DIRECT",
    "COMPARTILHADO",
];

export function isViewOrigin(value: unknown): value is ViewOrigin {
    return (
        typeof value === "string" &&
        (VIEW_ORIGINS as readonly string[]).includes(value)
    );
}

/**
 * Classifica a origem da visita.
 *
 * @param referer  Valor do header `Referer` (ou `null`/vazio).
 * @param siteHost Host do próprio site (ex.: `privello.com` ou
 *   `localhost:3000`). Comparado contra o host do referrer pra
 *   distinguir interno de externo. Quando ausente, qualquer
 *   referrer vira COMPARTILHADO (defensivo).
 */
export function classificarOrigem(
    referer: string | null | undefined,
    siteHost: string | null | undefined,
): ViewOrigin {
    if (!referer || referer.trim().length === 0) {
        return "DIRECT";
    }

    let refUrl: URL;
    try {
        refUrl = new URL(referer);
    } catch {
        // Referrer malformado — trata como direct (não dá pra
        // afirmar que veio de fora).
        return "DIRECT";
    }

    const refHost = refUrl.host.toLowerCase();
    const host = (siteHost ?? "").toLowerCase();

    // Referrer externo → veio de fora (compartilhamento).
    if (host.length === 0 || refHost !== host) {
        return "COMPARTILHADO";
    }

    // Referrer interno: classifica pelo path.
    const path = refUrl.pathname;
    if (path === "/" || path.length === 0) {
        return "HOME";
    }
    // `/acompanhantes` e `/acompanhantes?...` (busca) — mas NÃO
    // `/acompanhantes/<slug>` (perfil individual, que vira DIRECT
    // por ser navegação perfil→perfil sem intenção de busca).
    if (path === "/acompanhantes" || path === "/acompanhantes/") {
        return "BUSCA";
    }

    // Qualquer outra página interna (outro perfil, painel, etc).
    return "DIRECT";
}

/**
 * Normaliza um timestamp pra os buckets do heatmap:
 * `weekday` (0=domingo..6=sábado, UTC) e `hour` (0..23, UTC).
 */
export function bucketsHeatmap(date: Date): {
    weekday: number;
    hour: number;
} {
    return {
        weekday: date.getUTCDay(),
        hour: date.getUTCHours(),
    };
}
