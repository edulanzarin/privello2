// Feature: privello-platform, Property 27: Foto de Perfil não conta no limite de mídias do plano
/**
 * Property 27 — Foto de Perfil não conta no limite de mídias do plano.
 *
 * **Validates: Requirements 5.7**
 *
 * Statement (transcrito literalmente do design.md):
 *
 *   For any acompanhante com plano `P` e qualquer conjunto de mídias
 *   armazenadas, a contagem de mídias relevante para o limite do plano é
 *   `count(medias where ownerId = acompanhanteId AND isProfilePhoto = false)`,
 *   e adicionar/remover a `Foto_de_Perfil` não altera essa contagem.
 *
 * Test design:
 *
 *   - O código de produção ainda não expõe um `countMediasForPlan` próprio
 *     (a tarefa 8.7 antecede a implementação do serviço de planos que usa
 *     a contagem efetivamente). A propriedade, porém, vive ao nível do
 *     schema: a definição canônica da contagem é
 *     `count(medias WHERE owner_id = ? AND is_profile_photo = false)`.
 *     Definimos portanto o helper `countMediasForPlan` aqui mesmo,
 *     traduzindo essa SQL para a API do Prisma. Quando o serviço final
 *     for criado ele DEVE delegar para a mesma cláusula `where`; este
 *     teste garante que o invariante seja respeitado.
 *
 *   - O acesso a `db.media.count` é mediado por um stub em memória que
 *     reproduz o subconjunto de Prisma usado: `create`, `delete`,
 *     `count` com `where: { ownerId, isProfilePhoto }`. Não há banco real
 *     porque `tests/helpers/db.ts` ainda é um stub; mocar Prisma é o
 *     padrão estabelecido pelos demais testes de propriedade do projeto
 *     (ex.: `draft-expiration.test.ts`,
 *     `onboarding-state-preservation.test.ts`).
 *
 *   - Para cada execução o teste:
 *       1) Seeda N mídias regulares (`isProfilePhoto = false`) + 1 foto de
 *          perfil (`isProfilePhoto = true`) para um Acompanhante com plano
 *          P em {BASICO, PREMIUM};
 *       2) Asserta `countMediasForPlan(acompanhanteId) === N`;
 *       3) Remove a foto de perfil e assert que a contagem permanece N;
 *       4) Adiciona uma nova foto de perfil e assert que a contagem
 *          permanece N.
 *     A invariante "adicionar/remover a Foto_de_Perfil não altera essa
 *     contagem" fica assim verificada literalmente em ambos os sentidos.
 *
 *   - `N` varia em `[0, 15]` cobrindo o domínio relevante para o plano
 *     `BASICO` (limite 10) e ultrapassando-o, e amostrando o início do
 *     domínio do `PREMIUM`. O plano `P` é amostrado entre os dois
 *     valores possíveis (`PLANO_DEFINITIONS`) para confirmar que a
 *     contagem é independente do plano vigente.
 *
 *   - 50 iterações conforme especificação da tarefa 8.7.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as fc from "fast-check";
import { randomUUID } from "node:crypto";

// ---------------------------------------------------------------------------
// In-memory mock of `@/lib/db`.
//
// `vi.hoisted` makes the store accessible from both the mock factory and
// the test body. Apenas a superfície de Prisma efetivamente exercitada
// (`media.create`, `media.delete`, `media.count`) é implementada — qualquer
// chamada a outras entidades estoura ruidosamente, denunciando regressões.
// ---------------------------------------------------------------------------

type MediaRow = {
    id: string;
    ownerId: string;
    storageKey: string;
    mimeType: string;
    sizeBytes: number;
    status: "COMMITTED" | "PENDING_REPAIR" | "DELETED";
    isProfilePhoto: boolean;
    createdAt: Date;
};

const mocks = vi.hoisted(() => {
    const mediaStore = new Map<string, MediaRow>();
    return { mediaStore };
});

vi.mock("@/lib/db", () => {
    function matchesWhere(
        row: MediaRow,
        where: { ownerId?: string; isProfilePhoto?: boolean; id?: string },
    ): boolean {
        if (where.id !== undefined && row.id !== where.id) return false;
        if (where.ownerId !== undefined && row.ownerId !== where.ownerId) {
            return false;
        }
        if (
            where.isProfilePhoto !== undefined &&
            row.isProfilePhoto !== where.isProfilePhoto
        ) {
            return false;
        }
        return true;
    }

    return {
        db: {
            media: {
                create: async (args: {
                    data: Omit<MediaRow, "id" | "createdAt"> & {
                        id?: string;
                        createdAt?: Date;
                    };
                }) => {
                    const id = args.data.id ?? randomUUID();
                    const row: MediaRow = {
                        id,
                        ownerId: args.data.ownerId,
                        storageKey: args.data.storageKey,
                        mimeType: args.data.mimeType,
                        sizeBytes: args.data.sizeBytes,
                        status: args.data.status,
                        isProfilePhoto: args.data.isProfilePhoto,
                        createdAt: args.data.createdAt ?? new Date(),
                    };
                    mocks.mediaStore.set(id, row);
                    return row;
                },
                delete: async (args: { where: { id: string } }) => {
                    const row = mocks.mediaStore.get(args.where.id);
                    if (!row) {
                        throw new Error(
                            `[mock prisma] media.delete: id '${args.where.id}' not found`,
                        );
                    }
                    mocks.mediaStore.delete(args.where.id);
                    return row;
                },
                count: async (args: {
                    where: {
                        ownerId?: string;
                        isProfilePhoto?: boolean;
                        id?: string;
                    };
                }) => {
                    let n = 0;
                    for (const row of mocks.mediaStore.values()) {
                        if (matchesWhere(row, args.where)) n++;
                    }
                    return n;
                },
            },
        },
    };
});

// Imports must come AFTER `vi.mock` so the mock is in place when the
// modules below capture their `db` reference at import time.
import { db } from "@/lib/db";
import {
    PLANO_DEFINITIONS,
    type PlanoTipo,
} from "@/domain/plano/definitions";

// ---------------------------------------------------------------------------
// Helper sob teste — definido neste arquivo porque a produção ainda não o
// expõe (ver header). A invariante é estrutural: a contagem é exatamente
// `count(media WHERE owner_id = ? AND is_profile_photo = false)`.
// ---------------------------------------------------------------------------

async function countMediasForPlan(acompanhanteId: string): Promise<number> {
    return db.media.count({
        where: {
            ownerId: acompanhanteId,
            isProfilePhoto: false,
        },
    });
}

// Helpers de seed/mutação — internos ao teste, não pertencem ao domínio.

function seedRegularMedia(ownerId: string): string {
    const id = randomUUID();
    mocks.mediaStore.set(id, {
        id,
        ownerId,
        storageKey: `committed/${ownerId}/regular-${id}.jpg`,
        mimeType: "image/jpeg",
        sizeBytes: 1024,
        status: "COMMITTED",
        isProfilePhoto: false,
        createdAt: new Date(),
    });
    return id;
}

function seedProfilePhoto(ownerId: string): string {
    const id = randomUUID();
    mocks.mediaStore.set(id, {
        id,
        ownerId,
        storageKey: `committed/${ownerId}/profile.jpg`,
        mimeType: "image/jpeg",
        sizeBytes: 2048,
        status: "COMMITTED",
        isProfilePhoto: true,
        createdAt: new Date(),
    });
    return id;
}

// ---------------------------------------------------------------------------
// Test
// ---------------------------------------------------------------------------

describe("Property 27: Foto de Perfil não conta no limite de mídias do plano", () => {
    beforeEach(() => {
        mocks.mediaStore.clear();
    });

    afterEach(() => {
        mocks.mediaStore.clear();
    });

    it(
        "for any plano P and any N in [0,15], countMediasForPlan returns N regardless of profile photo presence",
        { timeout: 30_000 },
        async () => {
            await fc.assert(
                fc.asyncProperty(
                    fc.record({
                        // N regular medias para o Acompanhante.
                        n: fc.integer({ min: 0, max: 15 }),
                        // Plano vigente é amostrado para confirmar que a
                        // contagem é independente do plano.
                        plano: fc.constantFrom<PlanoTipo>("BASICO", "PREMIUM"),
                        // Número de "rondas" de adição/remoção de foto de
                        // perfil exercita o invariante várias vezes em
                        // sequência sobre o mesmo dataset.
                        rondas: fc.integer({ min: 1, max: 4 }),
                    }),
                    async ({ n, plano, rondas }) => {
                        // Garantia explícita: o plano amostrado é sempre um
                        // dos definidos pelo domínio. A propriedade é
                        // independente do plano, mas referenciamos a
                        // definição para deixar a relação Requirements 5.7
                        // ↔ teste explícita.
                        const planoDef = PLANO_DEFINITIONS[plano];
                        if (planoDef.tipo !== plano) {
                            throw new Error(
                                `Inconsistência em PLANO_DEFINITIONS para ${plano}`,
                            );
                        }

                        // Reset por iteração: cada amostra começa limpa.
                        mocks.mediaStore.clear();

                        const acompanhanteId = randomUUID();

                        // 1) Seed: N mídias regulares + 1 foto de perfil.
                        for (let i = 0; i < n; i++) {
                            seedRegularMedia(acompanhanteId);
                        }
                        let fotoPerfilId: string | null =
                            seedProfilePhoto(acompanhanteId);

                        // 2) Contagem inicial deve ser N (foto de perfil
                        //    presente, mas excluída pelo `where`).
                        const inicial =
                            await countMediasForPlan(acompanhanteId);
                        expect(inicial).toBe(n);

                        // 3) Remoção/adição alternada da foto de perfil
                        //    nunca deve mover a contagem.
                        for (let r = 0; r < rondas; r++) {
                            // Remove a foto de perfil corrente.
                            if (fotoPerfilId !== null) {
                                await db.media.delete({
                                    where: { id: fotoPerfilId },
                                });
                                fotoPerfilId = null;
                            }
                            const aposRemover =
                                await countMediasForPlan(acompanhanteId);
                            expect(aposRemover).toBe(n);

                            // Adiciona uma nova foto de perfil.
                            fotoPerfilId = seedProfilePhoto(acompanhanteId);
                            const aposAdicionar =
                                await countMediasForPlan(acompanhanteId);
                            expect(aposAdicionar).toBe(n);
                        }

                        // 4) Sanidade extra: a contagem com
                        //    `isProfilePhoto: true` é exatamente 1 enquanto
                        //    a foto está presente, confirmando que o `where`
                        //    discrimina corretamente os dois conjuntos.
                        const fotosPerfil = await db.media.count({
                            where: {
                                ownerId: acompanhanteId,
                                isProfilePhoto: true,
                            },
                        });
                        expect(fotosPerfil).toBe(fotoPerfilId === null ? 0 : 1);
                    },
                ),
                { numRuns: 50 },
            );
        },
    );
});
