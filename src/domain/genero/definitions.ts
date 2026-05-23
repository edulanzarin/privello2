/**
 * Definições canônicas de gênero da Acompanhante.
 *
 * Único critério obrigatório de identidade que aparece como filtro
 * primário na busca pública (`MULHER` / `HOMEM` / `TRANS`). Mantido
 * em módulo próprio porque é semanticamente diferente dos atributos
 * de aparência (que vivem em `@/domain/aparencia`) — tem peso de
 * categoria de busca, não de característica detalhada.
 *
 * As listas exportadas aqui são consumidas:
 *   - pelo step de Aparência do Onboarding (gerar opções),
 *   - pelo schema Zod do cadastro (validação),
 *   - pelo formulário de busca da home,
 *   - pelo `Sistema_de_Busca_Acompanhantes` (quando construído) para
 *     filtrar `WHERE genero = ?`.
 */

export type Genero = "MULHER" | "HOMEM" | "TRANS";

export type OpcaoGenero = {
    value: Genero;
    /** Rótulo singular usado em selects e badges. */
    label: string;
    /** Forma plural usada na busca ("Mulheres", "Homens", "Trans"). */
    pluralLabel: string;
};

export const GENEROS = [
    {
        value: "MULHER",
        label: "Mulher",
        pluralLabel: "Mulheres",
    },
    {
        value: "HOMEM",
        label: "Homem",
        pluralLabel: "Homens",
    },
    {
        value: "TRANS",
        label: "Trans",
        pluralLabel: "Trans",
    },
] as const satisfies readonly OpcaoGenero[];

export function isGenero(value: unknown): value is Genero {
    return GENEROS.some((o) => o.value === value);
}

/** Helper: rótulo singular de um valor canônico. */
export function rotularGenero(value: Genero): string {
    return GENEROS.find((o) => o.value === value)?.label ?? value;
}

/** Helper: rótulo plural (usado na busca). */
export function rotularGeneroPlural(value: Genero): string {
    return GENEROS.find((o) => o.value === value)?.pluralLabel ?? value;
}
