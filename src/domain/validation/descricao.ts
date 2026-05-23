/**
 * Validação do campo `descricao` (Requirement 3.9).
 *
 * Regra: comprimento entre 1 e 1000 caracteres. Não há `trim` aqui — o
 * requisito fala em comprimento bruto da descrição, e o usuário pode
 * legitimamente começar/terminar com espaços ou quebras de linha.
 */

const MIN_DESCRICAO = 1;
const MAX_DESCRICAO = 1000;

/**
 * Retorna `true` se e somente se `d.length` está em [1, 1000].
 *
 * @param d Texto bruto da descrição informada pela acompanhante.
 */
export function validarDescricao(d: string): boolean {
    if (typeof d !== "string") return false;
    return d.length >= MIN_DESCRICAO && d.length <= MAX_DESCRICAO;
}
