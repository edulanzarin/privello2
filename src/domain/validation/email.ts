/**
 * Validação do campo `email` (Requirement 2.7).
 *
 * Regras:
 *   - Comprimento total entre 5 e 254 caracteres (RFC 5321 prática comum).
 *   - Formato `parte_local@dominio.tld`: deve casar com a regex
 *     `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` (parte local não vazia, exatamente um
 *     `@`, e domínio com pelo menos um ponto).
 *
 * A normalização para persistência consiste em transformar o email em caixa
 * baixa, conforme exigido pelos Requirements 2.3 e 2.4 (unicidade
 * case-insensitive).
 */

const MIN_EMAIL = 5;
const MAX_EMAIL = 254;

/**
 * Regex propositalmente conservadora: parte local sem espaços nem `@`,
 * domínio sem espaços nem `@` e com ao menos um ponto separando rótulo
 * e TLD. Casos exóticos (IP literal, comentários RFC) ficam fora do MVP.
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Retorna `true` se e somente se o email tem comprimento entre 5 e 254
 * caracteres e satisfaz {@link EMAIL_PATTERN}.
 *
 * @param s Texto bruto digitado pelo usuário.
 */
export function validarEmail(s: string): boolean {
    if (typeof s !== "string") return false;
    if (s.length < MIN_EMAIL || s.length > MAX_EMAIL) return false;
    return EMAIL_PATTERN.test(s);
}

/**
 * Normaliza o email para persistência aplicando caixa baixa. O email já
 * deve estar minimamente sanitizado pelo formulário (sem espaços extras);
 * esta função apenas garante a forma canônica usada para comparação de
 * unicidade.
 *
 * @param s Email digitado pelo usuário.
 */
export function normalizarEmail(s: string): string {
    return s.toLowerCase();
}
