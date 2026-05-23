/**
 * Validação do campo `senha` (Requirement 2.8).
 *
 * Regra única do MVP: comprimento entre 8 e 128 caracteres. Decisões
 * sobre composição (mistura de classes, dicionário etc.) ficam fora do
 * escopo inicial — o requisito não exige e adicionar regras aqui poderia
 * conflitar com gerenciadores de senha.
 */

const MIN_SENHA = 8;
const MAX_SENHA = 128;

/**
 * Retorna `true` se e somente se `s.length` está em [8, 128].
 *
 * @param s Senha em texto claro digitada pelo usuário.
 */
export function validarSenha(s: string): boolean {
    if (typeof s !== "string") return false;
    return s.length >= MIN_SENHA && s.length <= MAX_SENHA;
}
