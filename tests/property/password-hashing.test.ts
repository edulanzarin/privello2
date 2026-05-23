/**
 * Feature: privello-platform, Property 1: Hash de senha é round-trip e nunca expõe a senha em claro
 *
 * For any plain password `p`, the hash `h = hashPassword(p)` must satisfy
 * simultaneously:
 *
 *   1. `verifyPassword(p, h) === true`               — round-trip de verificação.
 *   2. `h.startsWith("$argon2id$") === true`         — formato encoded esperado.
 *   3. For any `p' !== p`, `verifyPassword(p', h) === false`
 *      — uma senha distinta nunca é aceita pelo hash de outra.
 *
 * Esta propriedade é a invariante mínima exigida pelo Requirement 1.4: senhas
 * nunca podem ser armazenadas em claro e o algoritmo de hash deve ser
 * reversível apenas pela própria senha original.
 *
 * Notes:
 *   - argon2id é intencionalmente lento (`memoryCost=19456`, `timeCost=2`),
 *     então fixamos `numRuns = 50`. Isso ainda exercita o espaço de senhas
 *     o suficiente para detectar regressões grosseiras (ex.: hash determinístico
 *     que ignora o input) sem fazer a suíte demorar minutos.
 *   - `fc.string({minLength:8,maxLength:128})` cobre exatamente o intervalo
 *     de comprimento aceito pelo `validarSenha` (Requirement 2.8/3.7), o que
 *     mantém os exemplos gerados realistas para o domínio.
 *   - `fc.pre(p !== pOther)` descarta amostras onde as duas senhas geradas
 *     coincidem, já que nesse caso a terceira cláusula seria trivialmente
 *     violada por construção (não é o cenário que queremos testar).
 *
 * **Validates: Requirements 1.4**
 */

import { describe, it } from "vitest";
import * as fc from "fast-check";

import { hashPassword, verifyPassword } from "@/domain/auth/password";

describe("Property 1: hash de senha é round-trip e nunca expõe a senha em claro", () => {
    // argon2id com `memoryCost=19456`/`timeCost=2` chega a algumas centenas de
    // milissegundos por hash. Para 50 iterações × (1 hash + 2 verificações) o
    // teste pode levar dezenas de segundos, por isso elevamos o timeout do
    // Vitest (padrão 5s) para 5 minutos.
    it("hashPassword/verifyPassword round-trip and reject distinct passwords", { timeout: 300_000 }, async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.string({ minLength: 8, maxLength: 128 }),
                fc.string({ minLength: 8, maxLength: 128 }),
                async (p, pOther) => {
                    fc.pre(p !== pOther);

                    const h = await hashPassword(p);

                    // (2) o encoded hash sempre carrega o prefixo argon2id.
                    if (!h.startsWith("$argon2id$")) {
                        throw new Error(
                            `hashPassword devolveu hash sem prefixo "$argon2id$": ${h.slice(0, 16)}...`,
                        );
                    }

                    // (1) a senha original sempre verifica contra seu próprio hash.
                    const sameOk = await verifyPassword(p, h);
                    if (sameOk !== true) {
                        throw new Error(
                            "verifyPassword(p, hashPassword(p)) deveria ser true e foi false",
                        );
                    }

                    // (3) qualquer senha diferente deve falhar a verificação.
                    const otherOk = await verifyPassword(pOther, h);
                    if (otherOk !== false) {
                        throw new Error(
                            "verifyPassword(p', hashPassword(p)) deveria ser false para p' !== p e foi true",
                        );
                    }
                },
            ),
            { numRuns: 50 },
        );
    });
});
