/**
 * Slug de cidade pra URLs de SEO (W5).
 *
 * Converte `(cidade, UF)` num par de slugs estáveis pra
 * `/acompanhantes/cidade/[uf]/[cidade]` e de volta num filtro de
 * busca. Como não guardamos um id de cidade, o slug é derivado do
 * próprio nome (sem acentos, minúsculo, hifenizado) — a resolução
 * de volta pro nome real acontece comparando contra as cidades
 * existentes no banco.
 *
 * Módulo de domínio puro (sem React/DB) — usado por página, sitemap
 * e metadata.
 */

/**
 * Normaliza um texto pra slug: remove acentos, baixa caixa, troca
 * não-alfanuméricos por hífen e colapsa hífens.
 */
export function slugify(value: string): string {
    return value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // remove diacríticos
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .replace(/-{2,}/g, "-");
}

/**
 * Slug da UF (sempre 2 letras minúsculas). Retorna `null` se
 * inválido.
 */
export function ufSlug(uf: string): string | null {
    const s = uf.trim().toLowerCase();
    return /^[a-z]{2}$/.test(s) ? s : null;
}

/**
 * Monta o caminho da landing de cidade.
 * Ex.: `("São Paulo", "SP") → "/acompanhantes/cidade/sp/sao-paulo"`.
 */
export function cidadeLandingPath(
    cidadeNome: string,
    estadoSigla: string,
): string {
    return `/acompanhantes/cidade/${estadoSigla.toLowerCase()}/${slugify(
        cidadeNome,
    )}`;
}

/**
 * Resolve um par de slugs `(ufSlug, cidadeSlug)` pro nome real da
 * cidade dentro de uma lista de candidatas `(cidadeNome,
 * estadoSigla)`. Casa por `slugify(cidadeNome) === cidadeSlug` e UF
 * igual (case-insensitive). Retorna o match ou `null`.
 *
 * Isso evita depender de um dicionário de cidades: a verdade é o
 * que existe no banco.
 */
export function resolverCidadePorSlug(
    ufParam: string,
    cidadeParam: string,
    candidatas: ReadonlyArray<{ cidadeNome: string; estadoSigla: string }>,
): { cidadeNome: string; estadoSigla: string } | null {
    const uf = ufParam.trim().toLowerCase();
    const cidade = cidadeParam.trim().toLowerCase();
    for (const c of candidatas) {
        if (
            c.estadoSigla.toLowerCase() === uf &&
            slugify(c.cidadeNome) === cidade
        ) {
            return { cidadeNome: c.cidadeNome, estadoSigla: c.estadoSigla };
        }
    }
    return null;
}
