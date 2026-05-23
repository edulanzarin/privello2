// Feature: privello-platform, Property 9: Unicidade de identificador é case-insensitive
/**
 * Property 9 — Unicidade de identificador é case-insensitive.
 *
 * **Validates: Requirements 2.4**
 *
 * Statement (transcrito literalmente do design.md):
 *
 *   For any dois cadastros com identificadores `a` e `b` tais que
 *   `a.toLowerCase() === b.toLowerCase()`, no máximo um deles termina em
 *   sucesso; o segundo recebe `{ ok: false, reason: "IDENTIFICADOR_EM_USO" }`.
 *
 * Estratégia do teste (espelha Property 8 para email):
 *
 *   - Gera um identificador base válido (`^[A-Za-z0-9_]{3,30}$`).
 *   - Constrói duas permutações de caixa independentes do mesmo base
 *     (`permA`, `permB`); por construção `permA.toLowerCase() ===
 *     permB.toLowerCase() === base.toLowerCase()`.
 *   - Sorteia dois emails **distintos** com o `validEmailArb` para garantir
 *     que a única colisão entre as duas inscrições seja o identificador.
 *   - Roda `registrar` duas vezes em sequência. A propriedade exige:
 *       1. Exatamente um dos dois resultados é `{ ok: true, ... }`.
 *       2. O outro é `{ ok: false, reason: "IDENTIFICADOR_EM_USO" }`.
 *
 * Notas de implementação:
 *
 *   - `@/lib/db` é mockado com um store em memória que reproduz só o
 *     subconjunto de Prisma usado por `registrar` + `createSession`:
 *     `db.$transaction`, `tx.user.findMany`, `tx.user.create`,
 *     `tx.session.create`. Operações desconhecidas falham loud por
 *     `TypeError`, garantindo que regressões que toquem outras tabelas
 *     apareçam no teste.
 *   - O hash de senha (argon2id) é executado de verdade — não é
 *     mockado — para que o teste exercite o fluxo completo de
 *     `registrar`. As 30 iterações × 2 cadastros = 60 hashes ainda cabem
 *     no orçamento de tempo do timeout configurado.
 *   - O store é limpo entre iterações (e em `beforeEach`) para que
 *     resíduo de uma rodada não masque um bug em outra.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import * as fc from "fast-check";
import { randomUUID } from "node:crypto";

import { validEmailArb, validNomeArb, validSenhaArb } from "./generators";

// ---------------------------------------------------------------------------
// In-memory mock of `@/lib/db`.
//
// Implementa só o que `src/server/cadastro-cliente/registrar.ts` e
// `src/server/auth/sessions.ts` (via `createSession({ client: tx })`)
// realmente chamam: `$transaction`, `user.findMany`, `user.create` e
// `session.create`. O `tx` recebido pelo callback de `$transaction` é o
// mesmo objeto exposto no topo, o que combina com a forma como
// `registrar` passa `tx` adiante para `createSession`.
// ---------------------------------------------------------------------------

interface UserRow {
    id: string;
    email: string;
    identificador: string;
    nome: string;
    passwordHash: string;
    type: "CLIENTE" | "ACOMPANHANTE";
}

interface SessionRow {
    id: string;
    userId: string;
    expiresAt: Date;
    revokedAt: Date | null;
    lastSeenAt: Date;
}

const mocks = vi.hoisted(() => {
    const userStore = new Map<string, UserRow>();
    const sessionStore = new Map<string, SessionRow>();
    return { userStore, sessionStore };
});

vi.mock("@/lib/db", () => {
    const pick = <T extends Record<string, unknown>>(
        row: T,
        select?: Record<string, boolean>,
    ): Partial<T> => {
        if (!select) return row;
        const out: Record<string, unknown> = {};
        for (const k of Object.keys(select)) {
            if (select[k]) out[k] = row[k as keyof T];
        }
        return out as Partial<T>;
    };

    const txClient = {
        user: {
            findMany: async (args: {
                where: {
                    OR: Array<{ email?: string; identificador?: string }>;
                };
                select?: Record<string, boolean>;
                take?: number;
            }) => {
                const matches: UserRow[] = [];
                for (const row of mocks.userStore.values()) {
                    for (const cond of args.where.OR) {
                        if (
                            cond.email !== undefined &&
                            row.email === cond.email
                        ) {
                            matches.push(row);
                            break;
                        }
                        if (
                            cond.identificador !== undefined &&
                            row.identificador === cond.identificador
                        ) {
                            matches.push(row);
                            break;
                        }
                    }
                }
                const sliced =
                    args.take !== undefined
                        ? matches.slice(0, args.take)
                        : matches;
                return sliced.map((m) => pick(m, args.select));
            },
            create: async (args: {
                data: {
                    email: string;
                    identificador: string;
                    nome: string;
                    passwordHash: string;
                    type: "CLIENTE" | "ACOMPANHANTE";
                    client?: { create: Record<string, never> };
                };
                select?: Record<string, boolean>;
            }) => {
                // Defesa em profundidade: mesmo que `registrar`
                // tenha bug e pule a verificação prévia, evite
                // criar dois usuários com o mesmo identificador
                // ou email — falhar loud em vez de mascarar.
                for (const existing of mocks.userStore.values()) {
                    if (existing.email === args.data.email) {
                        throw new Error(
                            `[mock prisma] user.create: email '${args.data.email}' já existe; registrar deveria ter detectado a colisão antes de chegar aqui.`,
                        );
                    }
                    if (existing.identificador === args.data.identificador) {
                        throw new Error(
                            `[mock prisma] user.create: identificador '${args.data.identificador}' já existe; registrar deveria ter detectado a colisão antes de chegar aqui.`,
                        );
                    }
                }
                const row: UserRow = {
                    id: randomUUID(),
                    email: args.data.email,
                    identificador: args.data.identificador,
                    nome: args.data.nome,
                    passwordHash: args.data.passwordHash,
                    type: args.data.type,
                };
                mocks.userStore.set(row.id, row);
                return pick(row, args.select);
            },
        },
        session: {
            create: async (args: {
                data: {
                    userId: string;
                    createdAt: Date;
                    expiresAt: Date;
                    lastSeenAt: Date;
                };
                select?: Record<string, boolean>;
            }) => {
                const row: SessionRow = {
                    id: randomUUID(),
                    userId: args.data.userId,
                    expiresAt: args.data.expiresAt,
                    revokedAt: null,
                    lastSeenAt: args.data.lastSeenAt,
                };
                mocks.sessionStore.set(row.id, row);
                return pick(row, args.select);
            },
        },
    };

    return {
        db: {
            ...txClient,
            $transaction: async <T>(
                fn: (tx: typeof txClient) => Promise<T>,
            ): Promise<T> => fn(txClient),
        },
    };
});

// Imports must come AFTER `vi.mock` so the mock replaces `@/lib/db`
// before `registrar` (and its transitive `createSession`) capture
// their `db` reference at module-load time.
import { registrar } from "@/server/cadastro-cliente/registrar";

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** Caracteres permitidos no identificador (Requirement 2.5). */
const IDENT_CHARS =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_";
const identCharArb = fc.constantFrom(...IDENT_CHARS.split(""));

/**
 * Identificador base válido: alfanumérico + underscore, comprimento
 * 3..30. Mesmas regras de `validIdentificadorArb` em `generators.ts`,
 * replicadas aqui para deixar a intenção do teste explícita (precisamos
 * do *base* para depois case-permutar).
 */
const baseIdentificadorArb: fc.Arbitrary<string> = fc
    .array(identCharArb, { minLength: 3, maxLength: 30 })
    .map((cs) => cs.join(""));

/**
 * Gera uma permutação de caixa independente para `base`: para cada
 * caractere, decide aleatoriamente se ele aparece em maiúsculo ou
 * minúsculo. Caracteres sem variante de caixa (dígitos e `_`) ficam
 * inalterados, garantindo que o resultado continua casando com
 * `^[A-Za-z0-9_]{3,30}$`.
 *
 * Por construção: `casePermute(base, _).toLowerCase() === base.toLowerCase()`.
 */
function casePermuteArb(base: string): fc.Arbitrary<string> {
    return fc
        .array(fc.boolean(), {
            minLength: base.length,
            maxLength: base.length,
        })
        .map((flags) => {
            let out = "";
            for (let i = 0; i < base.length; i++) {
                const ch = base[i];
                out += flags[i] ? ch.toUpperCase() : ch.toLowerCase();
            }
            return out;
        });
}

/**
 * Cenário completo de uma rodada: identificador base + duas permutações
 * de caixa + dois emails distintos + nomes/senhas válidos para cada
 * cadastro.
 */
const scenarioArb = baseIdentificadorArb.chain((base) =>
    fc.record({
        permA: casePermuteArb(base),
        permB: casePermuteArb(base),
        emails: fc
            .tuple(validEmailArb, validEmailArb)
            // Mantém apenas pares cujo email normalizado (lower-case) é
            // distinto. Sem isso, uma colisão de email poderia mascarar
            // a colisão de identificador. Como `validEmailArb` já produz
            // emails em caixa baixa, basta comparar diretamente.
            .filter(([a, b]) => a !== b),
        nomes: fc.tuple(validNomeArb, validNomeArb),
        senhas: fc.tuple(validSenhaArb, validSenhaArb),
    }),
);

// ---------------------------------------------------------------------------
// Test
// ---------------------------------------------------------------------------

describe("Property 9: Unicidade de identificador é case-insensitive", () => {
    beforeEach(() => {
        mocks.userStore.clear();
        mocks.sessionStore.clear();
    });

    it(
        "for any two registrations with identificadors a, b such that a.toLowerCase()===b.toLowerCase(), at most one succeeds and the second receives IDENTIFICADOR_EM_USO",
        { timeout: 60_000 },
        async () => {
            await fc.assert(
                fc.asyncProperty(scenarioArb, async (scenario) => {
                    // Estado limpo por iteração para isolar a propriedade.
                    mocks.userStore.clear();
                    mocks.sessionStore.clear();

                    const [emailA, emailB] = scenario.emails;
                    const [nomeA, nomeB] = scenario.nomes;
                    const [senhaA, senhaB] = scenario.senhas;

                    const resA = await registrar({
                        nome: nomeA,
                        email: emailA,
                        identificador: scenario.permA,
                        senha: senhaA,
                    });

                    const resB = await registrar({
                        nome: nomeB,
                        email: emailB,
                        identificador: scenario.permB,
                        senha: senhaB,
                    });

                    // Exatamente um sucesso entre os dois.
                    const sucessos = [resA, resB].filter(
                        (r): r is Extract<typeof r, { ok: true }> => r.ok,
                    );
                    expect(
                        sucessos.length,
                        `Esperado exatamente 1 sucesso, observado ${sucessos.length}. ` +
                        `resA=${JSON.stringify(resA)} resB=${JSON.stringify(resB)} ` +
                        `permA=${scenario.permA} permB=${scenario.permB}`,
                    ).toBe(1);

                    // O resultado que falhou deve ser exatamente
                    // { ok: false, reason: "IDENTIFICADOR_EM_USO" }.
                    const falhas = [resA, resB].filter(
                        (r): r is Extract<typeof r, { ok: false }> => !r.ok,
                    );
                    expect(falhas.length).toBe(1);
                    expect(falhas[0].reason).toBe("IDENTIFICADOR_EM_USO");

                    // Como os dois emails são distintos, a colisão NÃO
                    // pode ser de email. Esta asserção blinda contra
                    // regressões em `detectarColisao` que confundissem
                    // a ordem das verificações.
                    expect(falhas[0].reason).not.toBe("EMAIL_EM_USO");
                }),
                { numRuns: 30 },
            );
        },
    );
});
