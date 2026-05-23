// Feature: privello-platform, Property 23: Seleção de plano é round-trip persistente
/**
 * Property 23 — Seleção de plano é round-trip persistente.
 *
 * **Validates: Requirements 5.4, 5.6**
 *
 * Statement (transcrito do design.md):
 *
 *   For any existing `acompanhanteId` and `tipo ∈ {BASICO, PREMIUM}`,
 *   after `selecionar(acompanhanteId, tipo) = { ok: true }`,
 *   `obterVigente(acompanhanteId)` returns the corresponding
 *   `PlanoDefinition`. Before any successful selection,
 *   `obterVigente` returns `null`.
 *
 * Cobertura desta propriedade:
 *
 *   - Para cada iteração, semeamos uma Acompanhante (linha em `users`
 *     com `type=ACOMPANHANTE` e linha pareada em `acompanhante_profiles`
 *     com `planoVigente=null`) — isso garante o pré-condicionante
 *     "existing acompanhanteId".
 *
 *   - Antes de qualquer chamada a `selecionar`, asseguramos a
 *     pós-condição negativa do enunciado: `obterVigente(id)` retorna
 *     exatamente `null` (sem plano gravado ⇒ Requirement 5.6 expõe
 *     "nenhum plano vigente").
 *
 *   - Em seguida, executamos `selecionar(id, tipo)` com `tipo` sorteado
 *     por `planoTipoArb` (Requirement 5.4: registrar o plano escolhido)
 *     e exigimos `{ ok: true }`.
 *
 *   - Por fim, conferimos o round-trip: `obterVigente(id)` deve retornar
 *     **a mesma referência** congelada exportada por `PLANO_DEFINITIONS`
 *     para o `tipo` escolhido (Requirement 5.6: expor o plano vigente
 *     com seus benefícios para outros componentes).
 *
 * Notas de implementação:
 *
 *   - O módulo `@/lib/db` é mockado com um repositório em memória que
 *     reproduz apenas o subconjunto de Prisma usado pelo Sistema_de_Planos
 *     (`acompanhanteProfile.findUnique` / `acompanhanteProfile.update`)
 *     mais um `user` mínimo para deixar explícito que estamos seedando
 *     User + AcompanhanteProfile a cada iteração. Operações fora desse
 *     conjunto quebram o teste de propósito.
 *
 *   - Cada iteração começa com `userStore`/`profileStore` zerados, então
 *     a Acompanhante semeada é a única candidata e qualquer reescrita
 *     espúria de `planoVigente` por outro caminho seria observável.
 *
 *   - 30 iterações conforme a tarefa, suficiente para amostrar os dois
 *     valores de `planoTipoArb` repetidamente sem inflar a suíte.
 */

import * as fc from "fast-check";
import { afterEach, beforeEach, describe, it, vi } from "vitest";
import { randomUUID } from "node:crypto";

import { planoTipoArb } from "./generators";

// ---------------------------------------------------------------------------
// In-memory Prisma stub for `@/lib/db`.
//
// The Sistema_de_Planos talks to two accessors at most: it reads
// `acompanhanteProfile.findUnique({ where: { userId } })` and writes
// `acompanhanteProfile.update({ where: { userId } })`. Tasks 8.3 / 8.4
// also require seeding a `User(type=ACOMPANHANTE)` row alongside each
// profile, so the mock exposes a `user` accessor with a `create` method
// even though the SUT never calls it directly — keeping the mock honest
// about what we're seeding.
// ---------------------------------------------------------------------------

interface UserRow {
    id: string;
    type: "CLIENTE" | "ACOMPANHANTE";
}

interface AcompanhanteProfileRow {
    userId: string;
    planoVigente: "BASICO" | "PREMIUM" | null;
    planoSelecionadoEm: Date | null;
}

const stores = vi.hoisted(() => ({
    users: new Map<string, UserRow>(),
    profiles: new Map<string, AcompanhanteProfileRow>(),
}));

vi.mock("@/lib/db", () => {
    const pickProfile = (
        row: AcompanhanteProfileRow,
        select?: Partial<Record<keyof AcompanhanteProfileRow, boolean>>,
    ): Partial<AcompanhanteProfileRow> => {
        if (!select) return { ...row };
        const out: Partial<AcompanhanteProfileRow> = {};
        for (const k of Object.keys(select) as (keyof AcompanhanteProfileRow)[]) {
            if (select[k]) {
                (out as Record<string, unknown>)[k] = row[k];
            }
        }
        return out;
    };

    return {
        db: {
            user: {
                async create({ data }: { data: UserRow }) {
                    stores.users.set(data.id, { ...data });
                    return { ...data };
                },
            },
            acompanhanteProfile: {
                async findUnique({
                    where,
                    select,
                }: {
                    where: { userId: string };
                    select?: Partial<Record<keyof AcompanhanteProfileRow, boolean>>;
                }) {
                    const row = stores.profiles.get(where.userId);
                    if (!row) return null;
                    return pickProfile(row, select);
                },
                async update({
                    where,
                    data,
                    select,
                }: {
                    where: { userId: string };
                    data: Partial<AcompanhanteProfileRow>;
                    select?: Partial<Record<keyof AcompanhanteProfileRow, boolean>>;
                }) {
                    const row = stores.profiles.get(where.userId);
                    if (!row) {
                        throw new Error(
                            `[mock prisma] update: profile '${where.userId}' not found`,
                        );
                    }
                    const next: AcompanhanteProfileRow = {
                        ...row,
                        ...data,
                    };
                    stores.profiles.set(next.userId, next);
                    return pickProfile(next, select);
                },
            },
        },
    };
});

// SUT must be imported AFTER `vi.mock` so the mock is in place.
import { obterVigente, selecionar } from "@/server/planos";
import { PLANO_DEFINITIONS } from "@/domain/plano/definitions";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Seeds an Acompanhante (User + AcompanhanteProfile) and returns its id.
 *
 * The profile starts with `planoVigente=null`/`planoSelecionadoEm=null`
 * so the "before any successful selection" half of Property 23 holds
 * by construction.
 */
async function seedAcompanhante(): Promise<string> {
    const userId = randomUUID();
    stores.users.set(userId, { id: userId, type: "ACOMPANHANTE" });
    stores.profiles.set(userId, {
        userId,
        planoVigente: null,
        planoSelecionadoEm: null,
    });
    return userId;
}

// ---------------------------------------------------------------------------
// Property
// ---------------------------------------------------------------------------

describe("Property 23: seleção de plano é round-trip persistente", () => {
    beforeEach(() => {
        stores.users.clear();
        stores.profiles.clear();
    });

    afterEach(() => {
        stores.users.clear();
        stores.profiles.clear();
    });

    it(
        "for any existing acompanhanteId and tipo ∈ {BASICO, PREMIUM}, obterVigente returns null before selecionar and the matching definition after",
        async () => {
            await fc.assert(
                fc.asyncProperty(planoTipoArb, async (tipo) => {
                    // Each iteration starts from a clean store so leftovers
                    // from previous runs cannot mask a regression.
                    stores.users.clear();
                    stores.profiles.clear();

                    const acompanhanteId = await seedAcompanhante();

                    // (a) Before any successful selection, obterVigente
                    //     must report "no plano vigente" via null.
                    const pre = await obterVigente(acompanhanteId);
                    if (pre !== null) {
                        throw new Error(
                            `pre-state: obterVigente esperava null, recebeu ${JSON.stringify(pre)}`,
                        );
                    }

                    // (b) selecionar must accept and report ok:true.
                    const result = await selecionar(acompanhanteId, tipo);
                    if (!result.ok) {
                        throw new Error(
                            `selecionar(${acompanhanteId}, ${tipo}) deveria retornar { ok: true }, retornou ${JSON.stringify(result)}`,
                        );
                    }

                    // (c) Round-trip: obterVigente must return exactly the
                    //     PlanoDefinition for the chosen tipo. We compare
                    //     by reference identity because PLANO_DEFINITIONS
                    //     is the documented single source of truth and is
                    //     frozen, so any clone would be a regression.
                    const post = await obterVigente(acompanhanteId);
                    const expected = PLANO_DEFINITIONS[tipo];
                    if (post !== expected) {
                        throw new Error(
                            `post-state: obterVigente esperava PLANO_DEFINITIONS.${tipo}, recebeu ${JSON.stringify(post)}`,
                        );
                    }
                }),
                { numRuns: 30 },
            );
        },
    );
});
