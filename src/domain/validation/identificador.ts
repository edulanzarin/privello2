/**
 * Validação do campo `identificador` (Requirement 2.5).
 *
 * Regras:
 *   - Comprimento entre 3 e 30 caracteres.
 *   - Apenas caracteres alfanuméricos ASCII e underscore: `[A-Za-z0-9_]`.
 *
 * A unicidade do identificador é avaliada em caixa baixa
 * (Requirement 2.4), portanto `normalizarIdentificador` reduz o valor
 * a lower-case antes da persistência ou da comparação de unicidade.
 */

/**
 * Regex que define o formato aceito pelo identificador. Mantida como
 * constante exportada para que outras camadas (UI, schemas) possam
 * compartilhar a mesma definição sem duplicação.
 */
export const IDENTIFICADOR_PATTERN = /^[A-Za-z0-9_]{3,30}$/;

/**
 * Retorna `true` se e somente se `s` casa com {@link IDENTIFICADOR_PATTERN}.
 *
 * Esta função valida apenas o **formato** do identificador. A unicidade
 * (Requirement 2.4) é responsabilidade da camada de aplicação que consulta
 * o repositório de usuários após a normalização.
 *
 * @param s Texto bruto digitado pelo usuário.
 */
export function validarIdentificadorFormato(s: string): boolean {
    if (typeof s !== "string") return false;
    return IDENTIFICADOR_PATTERN.test(s);
}

/**
 * Normaliza o identificador para a forma canônica usada na persistência
 * e na comparação de unicidade: caixa baixa.
 *
 * @param s Identificador digitado pelo usuário.
 */
export function normalizarIdentificador(s: string): string {
    return s.toLowerCase();
}
