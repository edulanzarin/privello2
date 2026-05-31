/**
 * Normalização defensiva de `BuscaFiltros` (V3).
 *
 * As buscas salvas guardam um JSON arbitrário. Antes de persistir,
 * casar ou devolver pra UI, passamos por aqui pra: descartar campos
 * desconhecidos, coagir tipos, limitar tamanhos de array e remover
 * lixo. Garante que o que entra no banco e sai dele é sempre um
 * `BuscaFiltros` saudável — sem confiar no payload do cliente.
 */

import type { BuscaFiltros } from "@/server/acompanhante-profile/buscar";

function str(v: unknown): string | undefined {
    if (typeof v !== "string") return undefined;
    const t = v.trim();
    return t.length > 0 ? t : undefined;
}

function strArray(v: unknown): ReadonlyArray<string> | undefined {
    if (!Array.isArray(v)) return undefined;
    const out = v
        .filter((x): x is string => typeof x === "string")
        .map((x) => x.trim())
        .filter((x) => x.length > 0)
        .slice(0, 20);
    return out.length > 0 ? out : undefined;
}

function num(v: unknown): number | undefined {
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0) return undefined;
    return Math.floor(v);
}

function bool(v: unknown): boolean | undefined {
    return v === true ? true : undefined;
}

/**
 * Sanitiza um objeto possivelmente inválido num `BuscaFiltros`
 * limpo. Campos ausentes/inválidos viram `undefined` (omitidos).
 */
export function normalizarFiltros(raw: unknown): BuscaFiltros {
    const r = (raw ?? {}) as Record<string, unknown>;

    const filtros: BuscaFiltros = {
        q: str(r.q),
        estadoSigla: (() => {
            const s = str(r.estadoSigla);
            return s && s.length === 2 ? s.toUpperCase() : undefined;
        })(),
        cidadeNome: str(r.cidadeNome),
        bairroNome: str(r.bairroNome),
        genero: str(r.genero),
        etnia: str(r.etnia),
        corOlhos: str(r.corOlhos),
        estiloCabelo: str(r.estiloCabelo),
        tamanhoCabelo: str(r.tamanhoCabelo),
        idiomas: strArray(r.idiomas),
        formasPagamento: strArray(r.formasPagamento),
        diasAtende: strArray(r.diasAtende),
        atendePublicos: strArray(r.atendePublicos),
        praticas: strArray(r.praticas),
        precoMin: num(r.precoMin),
        precoMax: num(r.precoMax),
        comAudio: bool(r.comAudio),
        comBoost: bool(r.comBoost),
        verificada: bool(r.verificada),
    };

    // Remove chaves undefined pra um objeto enxuto (e JSON menor).
    for (const key of Object.keys(filtros) as Array<keyof BuscaFiltros>) {
        if (filtros[key] === undefined) {
            delete filtros[key];
        }
    }

    return filtros;
}
