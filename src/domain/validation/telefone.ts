/**
 * Validação do campo `telefone` (Requirement 3.8).
 *
 * Regra: após remover os caracteres de máscara `+`, `(`, `)`, `-` e
 * espaço, o que sobra deve ser uma string contendo **apenas dígitos
 * decimais** com comprimento 10 ou 11 (telefone fixo ou celular
 * brasileiro com DDD).
 *
 * A normalização para persistência produz a representação somente-dígitos
 * (sem máscara), que é a forma canônica usada pelo
 * `Sistema_de_Onboarding`.
 */

/** Caracteres de máscara permitidos no input do usuário. */
const MASK_PATTERN = /[+()\-\s]/g;

/** Caracteres que, após o strip, devem ser puramente dígitos decimais. */
const DIGITS_ONLY_PATTERN = /^\d+$/;

const MIN_DIGITOS = 10;
const MAX_DIGITOS = 11;

/**
 * Remove os caracteres de máscara do telefone, retornando apenas os
 * dígitos. Não valida nada — pode ser usada antes ou depois de
 * {@link validarTelefone}.
 *
 * @param s Telefone digitado, possivelmente com máscara.
 */
export function normalizarTelefone(s: string): string {
    if (typeof s !== "string") return "";
    return s.replace(MASK_PATTERN, "");
}

/**
 * Retorna `true` se e somente se, após remover os caracteres de máscara
 * (`+`, `(`, `)`, `-`, espaço), o restante for composto **somente** por
 * dígitos decimais e tiver comprimento 10 ou 11.
 *
 * @param s Telefone digitado, possivelmente com máscara.
 */
export function validarTelefone(s: string): boolean {
    if (typeof s !== "string") return false;
    const digitos = normalizarTelefone(s);
    if (digitos.length < MIN_DIGITOS || digitos.length > MAX_DIGITOS) return false;
    return DIGITS_ONLY_PATTERN.test(digitos);
}
