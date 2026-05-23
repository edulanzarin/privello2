import { hash, verify } from "@node-rs/argon2";

/**
 * Identificador do algoritmo Argon2id no enum nativo de `@node-rs/argon2`.
 *
 * O enum `Algorithm` é um `const enum`, e `isolatedModules` impede sua
 * leitura direta pelo TypeScript, então o valor é replicado aqui
 * (`Argon2id = 2`). É estável pelo contrato da biblioteca.
 */
const ARGON2ID_ALGORITHM = 2;

/**
 * Parâmetros do argon2id usados pelo Sistema_de_Autenticacao.
 *
 * Mantidos como constantes para garantir reprodutibilidade dos hashes
 * e facilitar revisão criptográfica.
 *
 * - memoryCost: 19456 KiB (~19 MiB)
 * - timeCost: 2 iterações
 * - parallelism: 1 thread
 *
 * Referência: Requirement 1.4 — hashes de senha resistentes a força bruta.
 */
const ARGON2_PARAMS = {
    algorithm: ARGON2ID_ALGORITHM,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
} as const;

/**
 * Prefixo padrão do encoded hash do argon2id.
 *
 * Todo hash retornado por `hashPassword` começa com este prefixo, e
 * `verifyPassword` rejeita preventivamente qualquer hash com formato
 * incompatível.
 */
const ARGON2ID_PREFIX = "$argon2id$";

/**
 * Gera um hash argon2id da senha em texto claro.
 *
 * O resultado é uma string no formato PHC (encoded hash) que embute o
 * algoritmo, parâmetros e salt aleatório, e sempre começa com
 * `$argon2id$`.
 *
 * @param plain Senha em texto claro a ser protegida.
 * @returns Hash argon2id no formato encoded PHC.
 */
export async function hashPassword(plain: string): Promise<string> {
    return hash(plain, ARGON2_PARAMS);
}

/**
 * Verifica se uma senha em texto claro corresponde a um hash argon2id.
 *
 * Rejeita hashes que não estejam no formato `$argon2id$...` retornando
 * `false` em vez de lançar, para que chamadores não precisem distinguir
 * entre "hash em formato inesperado" e "senha incorreta" — ambos os
 * casos são tratados como autenticação inválida.
 *
 * @param plain Senha em texto claro fornecida pelo usuário.
 * @param hashStr Hash previamente gerado por `hashPassword`.
 * @returns `true` se a senha corresponder ao hash; caso contrário `false`.
 */
export async function verifyPassword(
    plain: string,
    hashStr: string,
): Promise<boolean> {
    if (!hashStr.startsWith(ARGON2ID_PREFIX)) {
        return false;
    }
    try {
        return await verify(hashStr, plain);
    } catch {
        return false;
    }
}
