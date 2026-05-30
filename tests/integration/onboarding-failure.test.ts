/**
 * Integration test 13.3 — Falha simulada no banco durante o
 * Onboarding_Acompanhante.
 *
 * **Validates: Requirements 3.6, 5.9**
 *
 * Cobre o caminho de erro do `Sistema_de_Onboarding` quando a transação
 * atômica do `finalizar` falha por um erro de persistência arbitrário
 * (aqui simulado fazendo `db.user.create` lançar uma vez).
 *
 * Asserts da Property 15 (atomicidade / "tudo ou nada") aplicada à
 * vertente de **falha**:
 *
 *   1. `finalizar` retorna `{ ok: false, reason: "PERSISTENCIA" }`
 *      (Requirements 3.6 e 5.9 — qualquer falha de persistência mantém
 *      a Acompanhante sem conta criada e permite retentativa).
 *   2. Nenhuma linha de `User`, `AcompanhanteProfile`, `Media` ou
 *      `Session` permanece no banco.
 *   3. O `OnboardingDraft` continua existindo (a fonte de verdade para
 *      o retry está preservada).
 *   4. O objeto `staged/<uuid>` em Cloudflare R2 foi removido pelo
 *      cleanup best-effort do `finalizar` (catch ⇒ `r2.deleteObject`).
 *
 * Em seguida, com a falha desativada, exercitamos a retentativa:
 * re-upload da Foto_de_Perfil (o que a UI faria, dado que o staged
 * anterior foi descartado) e nova chamada a `finalizar`. Asserts:
 *   5. Resultado `{ ok: true, userId, sessionId }`.
 *   6. `OnboardingDraft` removido pela transação.
 *   7. R2 contém **apenas** a chave `committed/<userId>/profile.<ext>`,
 *      sem nenhum sobrante em `staged/`.
 *
 * O cliente Prisma (`@/lib/db`) é substituído por uma store em memória
 * — a mesma estratégia do teste 13.2 — com um flag adicional
 * (`userCreateShouldFailOnce`) que faz a próxima chamada a
 * `db.user.create` lançar e em seguida se desarmar (one-shot). O
 * cliente R2 é o stub compartilhado em `tests/helpers/r2-stub`.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createR2Stub } from "../helpers/r2-stub";

// ---------------------------------------------------------------------------
// In-memory Prisma stores (hoisted so vi.mock can reach them)
// ---------------------------------------------------------------------------

type MediaStatus = "STAGED" | "COMMITTED" | "PENDING_REPAIR";

const stores = vi.hoisted(() => {
    interface DraftRow {
        id: string;
        payload: Record<string, unknown>;
        stagedKey: string | null;
        createdAt: Date;
        updatedAt: Date;
        expiresAt: Date;
    }
    interface UserRow {
        id: string;
        email: string;
        identificador: string;
        nome: string;
        passwordHash: string;
        type: "CLIENTE" | "ACOMPANHANTE";
        createdAt: Date;
        updatedAt: Date;
    }
    interface AcompanhanteProfileRow {
        userId: string;
        telefone: string;
        estadoSigla: string;
        cidadeNome: string;
        descricao: string;
        fotoPerfilId: string | null;
        planoVigente: "BASICO" | "PREMIUM" | null;
        planoSelecionadoEm: Date | null;
    }
    interface MediaRow {
        id: string;
        ownerId: string;
        storageKey: string;
        mimeType: string;
        sizeBytes: number;
        status: "STAGED" | "COMMITTED" | "PENDING_REPAIR";
        isProfilePhoto: boolean;
    }
    interface SessionRow {
        id: string;
        userId: string;
        createdAt: Date;
        expiresAt: Date;
        revokedAt: Date | null;
        lastSeenAt: Date;
        userType: "CLIENTE" | "ACOMPANHANTE";
    }

    const drafts = new Map<string, DraftRow>();
    const users = new Map<string, UserRow>();
    const profiles = new Map<string, AcompanhanteProfileRow>();
    const medias = new Map<string, MediaRow>();
    const sessions = new Map<string, SessionRow>();

    let counter = 0;
    /**
     * One-shot fail flag para `db.user.create`. Quando `true`, a próxima
     * chamada ao mock lança um erro que simula uma falha de banco e em
     * seguida se desarma sozinha. Tests setam isso antes do `finalizar`
     * que querem ver fracassar com `PERSISTENCIA`.
     */
    const flags = { userCreateShouldFailOnce: false };

    return {
        drafts,
        users,
        profiles,
        medias,
        sessions,
        flags,
        nextId(prefix: string) {
            counter += 1;
            return `${prefix}-${counter}`;
        },
        reset() {
            drafts.clear();
            users.clear();
            profiles.clear();
            medias.clear();
            sessions.clear();
            counter = 0;
            flags.userCreateShouldFailOnce = false;
        },
    };
});

// ---------------------------------------------------------------------------
// `@/lib/db` mock — segue o padrão de 13.2, com a única diferença de
// que `user.create` consulta `stores.flags.userCreateShouldFailOnce`
// antes de tocar a store.
// ---------------------------------------------------------------------------

vi.mock("@/lib/db", () => {
    type Select<T> = Partial<Record<keyof T, boolean>>;

    function project<T extends Record<string, unknown>>(
        row: T,
        select?: Select<T>,
    ): Partial<T> {
        if (!select) {
            return { ...row };
        }
        const out: Partial<T> = {};
        for (const key of Object.keys(select) as (keyof T)[]) {
            if (select[key]) {
                (out as Record<string, unknown>)[key as string] = row[key];
            }
        }
        return out;
    }

    // -------- onboardingDraft --------

    const onboardingDraft = {
        async create({
            data,
            select,
        }: {
            data: { payload: Record<string, unknown>; expiresAt: Date };
            select?: Record<string, boolean>;
        }) {
            const now = new Date();
            const row = {
                id: stores.nextId("draft"),
                payload: data.payload ?? {},
                stagedKey: null as string | null,
                createdAt: now,
                updatedAt: now,
                expiresAt: data.expiresAt,
            };
            stores.drafts.set(row.id, row);
            return project(row, select as Select<typeof row>);
        },
        async findUnique({
            where,
            select,
        }: {
            where: { id: string };
            select?: Record<string, boolean>;
        }) {
            const row = stores.drafts.get(where.id);
            if (!row) return null;
            return project(row, select as Select<typeof row>);
        },
        async update({
            where,
            data,
            select,
        }: {
            where: { id: string };
            data: Partial<{
                payload: Record<string, unknown>;
                stagedKey: string | null;
                expiresAt: Date;
            }>;
            select?: Record<string, boolean>;
        }) {
            const row = stores.drafts.get(where.id);
            if (!row) {
                throw new Error(`mock prisma: draft '${where.id}' not found`);
            }
            const next = {
                ...row,
                ...data,
                updatedAt: new Date(),
            };
            stores.drafts.set(where.id, next);
            return project(next, select as Select<typeof next>);
        },
        async delete({ where }: { where: { id: string } }) {
            const row = stores.drafts.get(where.id);
            if (!row) {
                throw new Error(`mock prisma: draft '${where.id}' not found`);
            }
            stores.drafts.delete(where.id);
            return project(row);
        },
    };

    // -------- user --------

    const user = {
        async findMany(args: {
            where: {
                OR?: Array<{ email?: string; identificador?: string }>;
            };
            select?: Record<string, boolean>;
            take?: number;
        }) {
            const ors = args.where.OR ?? [];
            const out: Array<Partial<(typeof stores.users) extends Map<unknown, infer V> ? V : never>> = [];
            for (const row of stores.users.values()) {
                const hit = ors.some((cond) => {
                    if ("email" in cond && cond.email !== undefined) {
                        return row.email === cond.email;
                    }
                    if (
                        "identificador" in cond &&
                        cond.identificador !== undefined
                    ) {
                        return row.identificador === cond.identificador;
                    }
                    return false;
                });
                if (hit) {
                    out.push(
                        project(
                            row,
                            args.select as Select<typeof row>,
                        ),
                    );
                    if (args.take !== undefined && out.length >= args.take) break;
                }
            }
            return out;
        },
        async create(args: {
            data: {
                email: string;
                identificador: string;
                nome: string;
                passwordHash: string;
                type: "CLIENTE" | "ACOMPANHANTE";
                acompanhante?: {
                    create: {
                        telefone: string;
                        estadoSigla: string;
                        cidadeNome: string;
                        descricao: string;
                    };
                };
            };
            select?: Record<string, boolean>;
        }) {
            // One-shot fail: simula uma falha pré-commit no banco. O
            // flag é desarmado antes do throw para que a próxima
            // tentativa (retentativa) prossiga sem reconfigurar nada.
            if (stores.flags.userCreateShouldFailOnce) {
                stores.flags.userCreateShouldFailOnce = false;
                throw new Error(
                    "mock prisma: simulated DB failure on user.create",
                );
            }

            const now = new Date();
            const row = {
                id: stores.nextId("user"),
                email: args.data.email,
                identificador: args.data.identificador,
                nome: args.data.nome,
                passwordHash: args.data.passwordHash,
                type: args.data.type,
                createdAt: now,
                updatedAt: now,
            };
            stores.users.set(row.id, row);

            if (args.data.acompanhante?.create) {
                const profile = {
                    userId: row.id,
                    telefone: args.data.acompanhante.create.telefone,
                    estadoSigla: args.data.acompanhante.create.estadoSigla,
                    cidadeNome: args.data.acompanhante.create.cidadeNome,
                    descricao: args.data.acompanhante.create.descricao,
                    fotoPerfilId: null as string | null,
                    planoVigente: null as "BASICO" | "PREMIUM" | null,
                    planoSelecionadoEm: null as Date | null,
                };
                stores.profiles.set(profile.userId, profile);
            }

            return project(row, args.select as Select<typeof row>);
        },
    };

    // -------- acompanhanteProfile --------

    const acompanhanteProfile = {
        async findUnique({
            where,
            select,
        }: {
            where: { userId: string };
            select?: Record<string, boolean>;
        }) {
            const row = stores.profiles.get(where.userId);
            if (!row) return null;
            return project(row, select as Select<typeof row>);
        },
        async update({
            where,
            data,
            select,
        }: {
            where: { userId: string };
            data: Partial<{
                fotoPerfilId: string | null;
                planoVigente: "BASICO" | "PREMIUM" | null;
                planoSelecionadoEm: Date | null;
            }>;
            select?: Record<string, boolean>;
        }) {
            const row = stores.profiles.get(where.userId);
            if (!row) {
                throw new Error(
                    `mock prisma: profile for user '${where.userId}' not found`,
                );
            }
            const next = { ...row, ...data };
            stores.profiles.set(where.userId, next);
            return project(next, select as Select<typeof next>);
        },
    };

    // -------- media --------

    const media = {
        async create(args: {
            data: {
                ownerId: string;
                storageKey: string;
                mimeType: string;
                sizeBytes: number;
                status: MediaStatus;
                isProfilePhoto: boolean;
            };
            select?: Record<string, boolean>;
        }) {
            const row = {
                id: stores.nextId("media"),
                ...args.data,
            };
            stores.medias.set(row.id, row);
            return project(row, args.select as Select<typeof row>);
        },
        async update({
            where,
            data,
            select,
        }: {
            where: { id: string };
            data: Partial<{ status: MediaStatus }>;
            select?: Record<string, boolean>;
        }) {
            const row = stores.medias.get(where.id);
            if (!row) {
                throw new Error(`mock prisma: media '${where.id}' not found`);
            }
            const next = { ...row, ...data };
            stores.medias.set(where.id, next);
            return project(next, select as Select<typeof next>);
        },
    };

    // -------- session --------

    const session = {
        async create(args: {
            data: {
                userId: string;
                createdAt: Date;
                expiresAt: Date;
                lastSeenAt: Date;
            };
            select?: Record<string, boolean>;
        }) {
            const owner = stores.users.get(args.data.userId);
            if (!owner) {
                throw new Error(
                    `mock prisma: session.create owner '${args.data.userId}' not found`,
                );
            }
            const row = {
                id: stores.nextId("sess"),
                userId: args.data.userId,
                createdAt: args.data.createdAt,
                expiresAt: args.data.expiresAt,
                revokedAt: null as Date | null,
                lastSeenAt: args.data.lastSeenAt,
                userType: owner.type,
            };
            stores.sessions.set(row.id, row);
            return {
                id: row.id,
                userId: row.userId,
                expiresAt: row.expiresAt,
                revokedAt: row.revokedAt,
            };
        },
    };

    const tx = {
        onboardingDraft,
        user,
        acompanhanteProfile,
        media,
        session,
    };

    return {
        db: {
            ...tx,
            async $transaction<T>(
                fn: (txClient: typeof tx) => Promise<T>,
            ): Promise<T> {
                // Sem isolamento real: o mock só preserva o contrato de
                // que tudo dentro do callback enxerga o mesmo client.
                // Erros de `fn` propagam como rejeições — exatamente
                // o que `finalizar` espera para cair em PERSISTENCIA.
                return fn(tx);
            },
        },
    };
});

// ---------------------------------------------------------------------------
// `@/lib/env` mock — fornece SESSION_SECRET sem ler `process.env`.
// ---------------------------------------------------------------------------

vi.mock("@/lib/env", () => ({
    getEnv: () => ({
        SESSION_SECRET: "test-secret-onboarding-failure-1234567890",
    }),
    validateEnv: () => ({
        SESSION_SECRET: "test-secret-onboarding-failure-1234567890",
    }),
    ENV_KEYS: [],
    ENV_SCHEMA: { safeParse: () => ({ success: true, data: {} }) },
    EnvValidationError: class extends Error { },
}));

// ---------------------------------------------------------------------------
// Localidades — força `validar` para `true` (foco do teste é o caminho
// de PERSISTENCIA, não a validação de localidade).
// ---------------------------------------------------------------------------

const localidadesValidarMock = vi.fn(async () => true);

vi.mock("@/server/localidades", () => ({
    defaultLocalidadesService: {
        validar: (uf: string, cidade: string) =>
            localidadesValidarMock(uf, cidade),
        listarEstados: () => Promise.resolve({ ok: false }),
        listarCidades: () => Promise.resolve({ ok: false }),
    },
}));

// ---------------------------------------------------------------------------
// Imports dos sistemas sob teste (após os `vi.mock`).
// ---------------------------------------------------------------------------

import {
    atualizarEtapa,
    iniciar,
    uploadFoto,
    __setR2ClientForTests as __setDraftsR2,
} from "@/server/onboarding/drafts";
import {
    finalizar,
    __setR2ClientForTests as __setFinalizarR2,
} from "@/server/onboarding/finalizar";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

type OnboardingFixture = {
    nome: string;
    email: string;
    identificador: string;
    senha: string;
    telefone: string;
    estadoSigla: string;
    cidadeNome: string;
    descricao: string;
    fotoMime: "image/jpeg" | "image/png" | "image/webp";
    fotoBytes: Uint8Array;
};

function buildFixture(
    overrides: Partial<OnboardingFixture> = {},
): OnboardingFixture {
    return {
        nome: "Maria Silva",
        email: "maria@privello.test",
        identificador: "maria_silva",
        senha: "senhaForte123",
        telefone: "(11) 91234-5678",
        estadoSigla: "SP",
        cidadeNome: "São Paulo",
        descricao: "Sou uma pessoa carinhosa e atenciosa.",
        fotoMime: "image/jpeg",
        fotoBytes: new Uint8Array([0xff, 0xd8, 0xff, 0xe0]),
        ...overrides,
    };
}

/**
 * Caminha até o ponto exato anterior ao `finalizar`: cria o draft,
 * preenche todas as etapas e faz o upload da Foto_de_Perfil. Devolve o
 * `onboardingId` para o caller invocar `finalizar` com (ou sem) o flag
 * de falha armado.
 */
async function walkUntilFinalize(
    fixture: OnboardingFixture,
): Promise<string> {
    const { onboardingId } = await iniciar();

    await atualizarEtapa(onboardingId, {
        nome: fixture.nome,
        email: fixture.email,
        identificador: fixture.identificador,
        senha: fixture.senha,
    });
    await atualizarEtapa(onboardingId, { telefone: fixture.telefone });
    await atualizarEtapa(onboardingId, {
        estadoSigla: fixture.estadoSigla,
        cidadeNome: fixture.cidadeNome,
    });
    await atualizarEtapa(onboardingId, { descricao: fixture.descricao });
    // Aparência (obrigatório no schema atual).
    await atualizarEtapa(onboardingId, {
        pesoKg: 60,
        alturaCm: 170,
        tamanhoPe: 37,
        etnia: "BRANCA",
        corOlhos: "CASTANHO",
        estiloCabelo: "LISO",
        tamanhoCabelo: "MEDIO",
        idiomas: ["PORTUGUES"],
    });
    // Atendimento (obrigatório no schema atual).
    await atualizarEtapa(onboardingId, {
        genero: "MULHER",
        atendePublicos: ["HOMEM"],
        realizaPraticas: [],
    });
    // Atendimento comercial (obrigatório no schema atual).
    await atualizarEtapa(onboardingId, {
        valorHoraCents: 30000,
        formasPagamento: ["DINHEIRO"],
        diasAtende: ["SEG", "TER", "QUA", "QUI", "SEX"],
    });
    await atualizarEtapa(onboardingId, {
        fotoPerfil: {
            mimeType: fixture.fotoMime,
            sizeBytes: fixture.fotoBytes.byteLength,
        },
    });
    await uploadFoto(onboardingId, {
        mimeType: fixture.fotoMime,
        bytes: fixture.fotoBytes,
    });

    return onboardingId;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Integration 13.3: falha simulada no banco durante o onboarding", () => {
    let r2: ReturnType<typeof createR2Stub>;

    beforeEach(() => {
        stores.reset();
        localidadesValidarMock.mockClear();
        localidadesValidarMock.mockImplementation(async () => true);
        r2 = createR2Stub();
        // O mesmo stub é injetado em ambos os módulos para que `drafts`
        // e `finalizar` enxerguem o mesmo storage.
        __setDraftsR2(r2);
        __setFinalizarR2(r2);
    });

    afterEach(() => {
        __setDraftsR2(null);
        __setFinalizarR2(null);
    });

    it("rolls back atomically on DB failure and supports retry after re-uploading the photo", async () => {
        const fixture = buildFixture();
        const onboardingId = await walkUntilFinalize(fixture);

        // Pré-condições antes do `finalizar` falhar:
        //   - draft existe;
        //   - exatamente um objeto staged em R2.
        expect(stores.drafts.has(onboardingId)).toBe(true);
        const stagedBefore = r2.snapshot();
        expect(stagedBefore).toHaveLength(1);
        expect(stagedBefore[0].key.startsWith("staged/")).toBe(true);

        // ----- Primeira tentativa: falha forçada em `db.user.create`.
        stores.flags.userCreateShouldFailOnce = true;

        const failed = await finalizar(onboardingId);

        // 1) finalizar reportou PERSISTENCIA (Requirements 3.6 e 5.9).
        expect(failed).toEqual({ ok: false, reason: "PERSISTENCIA" });

        // 2) Nada foi gravado: nem User, nem AcompanhanteProfile, nem
        //    Media, nem Session.
        expect(stores.users.size).toBe(0);
        expect(stores.profiles.size).toBe(0);
        expect(stores.medias.size).toBe(0);
        expect(stores.sessions.size).toBe(0);

        // 3) O draft permanece consultável (Requirement 3.6: "permitir
        //    nova tentativa sem deixar conta parcial").
        expect(stores.drafts.has(onboardingId)).toBe(true);

        // 4) O objeto staged em R2 foi removido pelo cleanup
        //    best-effort (catch ⇒ `r2.deleteObject(stagedKey)`).
        expect(r2.snapshot()).toEqual([]);

        // O flag one-shot já se desarmou sozinho dentro do mock; a
        // próxima `user.create` segue normal.
        expect(stores.flags.userCreateShouldFailOnce).toBe(false);

        // ----- Retentativa: a UI re-submete a foto (o staged anterior
        //       foi descartado, então é necessário novo upload), e em
        //       seguida tenta finalizar novamente. Isso é exatamente o
        //       comportamento descrito pelo Requirement 3.6.
        await uploadFoto(onboardingId, {
            mimeType: fixture.fotoMime,
            bytes: fixture.fotoBytes,
        });

        // Antes do finalizar de sucesso, deve haver exatamente um
        // staged novo e nenhum committed.
        const stagedAgain = r2.snapshot();
        expect(stagedAgain).toHaveLength(1);
        expect(stagedAgain[0].key.startsWith("staged/")).toBe(true);

        const success = await finalizar(onboardingId);

        // 5) finalizar agora retorna ok com userId/sessionId.
        if (!success.ok) {
            throw new Error(
                `expected finalizar to succeed on retry, got ${JSON.stringify(success)}`,
            );
        }
        expect(success.userId).toMatch(/^user-/);
        expect(success.sessionId).toMatch(/^sess-/);

        // 6) Conta criada com normalizações esperadas e draft removido
        //    pela transação.
        const userRow = stores.users.get(success.userId);
        expect(userRow).toBeDefined();
        expect(userRow!.type).toBe("ACOMPANHANTE");
        expect(userRow!.email).toBe(fixture.email.toLowerCase());
        expect(stores.profiles.get(success.userId)).toBeDefined();
        expect(stores.medias.size).toBe(1);
        expect(stores.drafts.has(onboardingId)).toBe(false);

        // 7) Em R2, sobra somente a chave committed; nenhum staged.
        const finalKeys = r2.snapshot().map((o) => o.key);
        expect(finalKeys).toEqual([
            `committed/${success.userId}/profile.jpg`,
        ]);
    });

    it("keeps the draft and store empty when DB fails before the retry, even with a different fixture (PNG)", async () => {
        // Caso adicional: confirma que o cleanup é independente do MIME
        // escolhido e que o staged volta a ser zero após o rollback.
        const fixture = buildFixture({
            email: "ana@privello.test",
            identificador: "ana_costa",
            fotoMime: "image/png",
            fotoBytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
        });
        const onboardingId = await walkUntilFinalize(fixture);

        stores.flags.userCreateShouldFailOnce = true;
        const failed = await finalizar(onboardingId);

        expect(failed).toEqual({ ok: false, reason: "PERSISTENCIA" });
        expect(stores.users.size).toBe(0);
        expect(stores.profiles.size).toBe(0);
        expect(stores.medias.size).toBe(0);
        expect(stores.sessions.size).toBe(0);
        expect(stores.drafts.has(onboardingId)).toBe(true);
        expect(r2.snapshot()).toEqual([]);
    });
});
