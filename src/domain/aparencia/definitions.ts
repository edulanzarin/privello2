/**
 * Definições canônicas dos atributos de aparência da Acompanhante.
 *
 * Esta é a única fonte de verdade dos valores aceitos para os enums
 * `Etnia`, `CorOlhos`, `EstiloCabelo`, `TamanhoCabelo`, `Fumante` e
 * `Idioma` armazenados no `AcompanhanteProfile`. As listas exportadas
 * aqui são consumidas:
 *
 *   - pelas UIs de cadastro/edição (gerar opções de `<Select>` e
 *     `<ChipGroup>`),
 *   - pelos schemas Zod do onboarding/edição (validação de entrada),
 *   - pela camada de busca quando filtros por aparência forem
 *     implementados.
 *
 * Os tipos são `as const` + `as const satisfies`, garantindo narrowing
 * literal em compile time. Ranges numéricos para campos não-enumeráveis
 * (peso, altura, tamanho do pé) também vivem aqui para que UI e
 * validação compartilhem os mesmos limites.
 */

// ---------------------------------------------------------------------------
// Enums (alinhados ao Prisma schema)
// ---------------------------------------------------------------------------

export type Etnia = "BRANCA" | "NEGRA" | "PARDA" | "AMARELA" | "INDIGENA";
export type CorOlhos =
    | "CASTANHO"
    | "PRETO"
    | "AZUL"
    | "VERDE"
    | "MEL"
    | "CINZA";
export type EstiloCabelo = "LISO" | "ONDULADO" | "CACHEADO" | "CRESPO";
export type TamanhoCabelo = "CURTO" | "MEDIO" | "LONGO";
export type Idioma =
    | "PORTUGUES"
    | "INGLES"
    | "ESPANHOL"
    | "FRANCES"
    | "ITALIANO"
    | "ALEMAO"
    | "OUTRO";

/** Tupla `(valor enum, rótulo pt-BR)` consumida diretamente por `<Select>`. */
export type OpcaoEnum<T extends string> = {
    value: T;
    label: string;
};

// ---------------------------------------------------------------------------
// Listas canônicas com rótulos pt-BR
// ---------------------------------------------------------------------------

export const ETNIAS = [
    { value: "BRANCA", label: "Branca" },
    { value: "NEGRA", label: "Negra" },
    { value: "PARDA", label: "Parda" },
    { value: "AMARELA", label: "Amarela" },
    { value: "INDIGENA", label: "Indígena" },
] as const satisfies readonly OpcaoEnum<Etnia>[];

export const CORES_OLHOS = [
    { value: "CASTANHO", label: "Castanho" },
    { value: "PRETO", label: "Preto" },
    { value: "AZUL", label: "Azul" },
    { value: "VERDE", label: "Verde" },
    { value: "MEL", label: "Mel" },
    { value: "CINZA", label: "Cinza" },
] as const satisfies readonly OpcaoEnum<CorOlhos>[];

export const ESTILOS_CABELO = [
    { value: "LISO", label: "Liso" },
    { value: "ONDULADO", label: "Ondulado" },
    { value: "CACHEADO", label: "Cacheado" },
    { value: "CRESPO", label: "Crespo" },
] as const satisfies readonly OpcaoEnum<EstiloCabelo>[];

export const TAMANHOS_CABELO = [
    { value: "CURTO", label: "Curto" },
    { value: "MEDIO", label: "Médio" },
    { value: "LONGO", label: "Longo" },
] as const satisfies readonly OpcaoEnum<TamanhoCabelo>[];

export const IDIOMAS = [
    { value: "PORTUGUES", label: "Português" },
    { value: "INGLES", label: "Inglês" },
    { value: "ESPANHOL", label: "Espanhol" },
    { value: "FRANCES", label: "Francês" },
    { value: "ITALIANO", label: "Italiano" },
    { value: "ALEMAO", label: "Alemão" },
    { value: "OUTRO", label: "Outro" },
] as const satisfies readonly OpcaoEnum<Idioma>[];

// ---------------------------------------------------------------------------
// Type guards (consumidos pelos schemas Zod)
// ---------------------------------------------------------------------------

export function isEtnia(value: unknown): value is Etnia {
    return ETNIAS.some((o) => o.value === value);
}
export function isCorOlhos(value: unknown): value is CorOlhos {
    return CORES_OLHOS.some((o) => o.value === value);
}
export function isEstiloCabelo(value: unknown): value is EstiloCabelo {
    return ESTILOS_CABELO.some((o) => o.value === value);
}
export function isTamanhoCabelo(value: unknown): value is TamanhoCabelo {
    return TAMANHOS_CABELO.some((o) => o.value === value);
}
export function isIdioma(value: unknown): value is Idioma {
    return IDIOMAS.some((o) => o.value === value);
}

// ---------------------------------------------------------------------------
// Ranges numéricos (peso, altura, tamanho do pé)
// ---------------------------------------------------------------------------

/**
 * Faixa válida de peso em quilogramas. Limites largos para acomodar
 * qualquer Acompanhante; valores fora ainda são raros o bastante para
 * sinalizarem digitação errada.
 */
export const PESO_KG = { min: 30, max: 200 } as const;

/** Faixa válida de altura em centímetros. */
export const ALTURA_CM = { min: 130, max: 220 } as const;

/** Faixa válida de tamanho do pé (numeração brasileira). */
export const TAMANHO_PE = { min: 28, max: 50 } as const;

/** Comprimento máximo do bairro (nome). Pega bairros de OSM com folga. */
export const BAIRRO_NOME_MAX = 120;
