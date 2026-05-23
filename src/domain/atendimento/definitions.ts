/**
 * Definições canônicas do que a Acompanhante atende e realiza.
 *
 * Duas dimensões discrimináveis:
 *
 * 1. {@link Atende} — público que aceita atender (Mulher / Homem /
 *    Casal / Trans). Diferente do {@link import("../genero").Genero}
 *    da própria Acompanhante: aqui é quem ela atende, lá é quem ela
 *    é. Multi-select.
 *
 * 2. {@link Pratica} — o que ela realiza no atendimento. Lista
 *    enxuta: `oral`, `vaginal`, `anal`, `beijo na boca`, `massagem`
 *    e uma marcação genérica `fetiche` que sinaliza disponibilidade
 *    para fetiches/cenários específicos sem listar cada um (o
 *    detalhe fica na conversa privada Cliente↔Acompanhante).
 *    Multi-select.
 *
 * As listas exportadas aqui alimentam:
 *   - o step "Aparência" do Onboarding_Acompanhante (ChipGroups
 *     multi-select),
 *   - schemas Zod do servidor (validação de cada valor),
 *   - filtros de busca pública na Home/feed quando o
 *     `Sistema_de_Busca_Acompanhantes` for construído.
 */

// ---------------------------------------------------------------------------
// Atende (público)
// ---------------------------------------------------------------------------

export type Atende = "MULHER" | "HOMEM" | "CASAL" | "TRANS";

export type OpcaoAtende = {
    value: Atende;
    label: string;
};

export const ATENDE = [
    { value: "MULHER", label: "Mulher" },
    { value: "HOMEM", label: "Homem" },
    { value: "CASAL", label: "Casal" },
    { value: "TRANS", label: "Trans" },
] as const satisfies readonly OpcaoAtende[];

export function isAtende(value: unknown): value is Atende {
    return ATENDE.some((o) => o.value === value);
}

// ---------------------------------------------------------------------------
// Pratica (realiza)
// ---------------------------------------------------------------------------

export type Pratica =
    | "ORAL"
    | "VAGINAL"
    | "ANAL"
    | "BEIJO_NA_BOCA"
    | "MASSAGEM"
    | "FETICHE";

export type OpcaoPratica = {
    value: Pratica;
    label: string;
};

export const PRATICAS = [
    { value: "ORAL", label: "Oral" },
    { value: "VAGINAL", label: "Vaginal" },
    { value: "ANAL", label: "Anal" },
    { value: "BEIJO_NA_BOCA", label: "Beijo na boca" },
    { value: "MASSAGEM", label: "Massagem" },
    { value: "FETICHE", label: "Fetiche" },
] as const satisfies readonly OpcaoPratica[];

export function isPratica(value: unknown): value is Pratica {
    return PRATICAS.some((o) => o.value === value);
}
