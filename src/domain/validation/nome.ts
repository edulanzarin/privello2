/**
 * Validação do campo `nome` (Requirement 2.6).
 *
 * Regra: após remover espaços nas extremidades (`trim`), o comprimento do
 * nome deve estar no intervalo [2, 100]. A normalização aqui é simplesmente
 * o resultado do `trim`; nenhuma transformação de caixa é aplicada.
 */

const MIN_NOME = 2;
const MAX_NOME = 100;

/**
 * Retorna `true` se e somente se `s.trim().length` está em [2, 100].
 *
 * @param s Texto bruto digitado pelo usuário.
 */
export function validarNome(s: string): boolean {
    if (typeof s !== "string") return false;
    const trimmed = s.trim();
    return trimmed.length >= MIN_NOME && trimmed.length <= MAX_NOME;
}

/**
 * Normaliza o nome para persistência: aplica `trim` mas preserva a caixa
 * exata informada pelo usuário (Requirement 2.2 implica armazenar o nome
 * exibível, sem alterações além de espaços nas extremidades).
 *
 * @param s Texto bruto digitado pelo usuário.
 */
export function normalizarNome(s: string): string {
    return s.trim();
}
