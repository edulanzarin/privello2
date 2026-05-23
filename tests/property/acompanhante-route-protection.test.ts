// Feature: privello-platform, Property 26: Acesso a áreas de Acompanhante depende do plano vigente
/**
 * Property 26 — Acesso a áreas de Acompanhante depende do plano vigente.
 *
 * **Validates: Requirements 5.5, 5.10**
 *
 * Statement (transcrito do design.md):
 *
 *   For any requisição autenticada com `userType === "ACOMPANHANTE"`
 *   para uma rota em `(acompanhante)/*`:
 *     - Se `planoVigente === null` e o path **não** é
 *       `/acompanhante/selecao-plano`, o layout redireciona para
 *       `/acompanhante/selecao-plano` (Requirement 5.5).
 *     - Se `planoVigente !== null` e o path **é**
 *       `/acompanhante/selecao-plano`, o layout redireciona para
 *       `/acompanhante` (Requirement 5.10).
 *     - Caso contrário, o layout passa adiante (renderiza `children`)
 *       sem emitir redirecionamento.
 *
 * # Por que testamos o LAYOUT e não o middleware
 *
 * O `src/middleware.ts` da Privello roda no Edge Runtime do Next.js,
 * que não suporta o `@prisma/client`. Por isso o middleware faz apenas
 * a verificação leve da assinatura HMAC do cookie e delega o lookup
 * completo da sessão **e** do `planoVigente` para o layout do route
 * group `(acompanhante)`. Portanto, é o layout — `AcompanhanteLayout`
 * em `src/app/(acompanhante)/layout.tsx` — que materializa a tabela
 * acima. Esse é o ponto correto onde a Property 26 é observável.
 *
 * # Estratégia
 *
 * - Mockamos `next/headers` para controlar `x-session-id`/`x-pathname`.
 * - Mockamos `next/navigation` para que `redirect(dest)` lance um erro
 *   carregando o destino, replicando o contrato do Next ("redirect
 *   nunca retorna; o frame que o chama é interrompido").
 * - Mockamos `@/server/auth/sessions` para devolver sempre uma sessão
 *   ACOMPANHANTE válida, isolando a propriedade do ciclo de vida da
 *   sessão (já coberto pela Property 4).
 * - Mockamos `@/server/planos.obterVigente` para devolver exatamente
 *   o `planoVigente` sorteado pelo `fast-check`.
 *
 * Para cada iteração geramos `(planoVigente, pathname)` com
 * `pathname ∈ {/acompanhante, /acompanhante/perfil, /acompanhante/selecao-plano}`
 * e `planoVigente ∈ {null, PLANO_DEFINITIONS.BASICO, PLANO_DEFINITIONS.PREMIUM}`,
 * invocamos o layout, e conferimos o destino do redirect (ou a sua
 * ausência) contra a tabela acima.
 */

import * as fc from "fast-check";
import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PLANO_DEFINITIONS } from "@/domain/plano/definitions";
import type { PlanoDefinition } from "@/domain/plano/definitions";

// ---------------------------------------------------------------------------
// Hoisted mock state — shared between mock factories and the test itself.
// ---------------------------------------------------------------------------

const mockState = vi.hoisted(() => ({
    sessionId: null as string | null,
    pathname: "" as string,
    planoVigente: null as { tipo: "BASICO" | "PREMIUM" } | null,
    redirectCalls: [] as string[],
}));

// ---------------------------------------------------------------------------
// next/headers — feeds `x-session-id` / `x-pathname` to the layout.
//
// The layout reads `await headers()` and `await cookies()` (Next 15 async
// dynamic API). We always populate `x-session-id`, so `cookies()` is never
// consumed for parsing — but we still provide a stub for it to avoid
// unintentional `undefined is not a function` failures should the layout
// touch the cookie store for any reason.
// ---------------------------------------------------------------------------

vi.mock("next/headers", () => ({
    headers: async () => ({
        get(name: string) {
            if (name === "x-session-id") return mockState.sessionId;
            if (name === "x-pathname") return mockState.pathname;
            return null;
        },
    }),
    cookies: async () => ({
        get() {
            return undefined;
        },
    }),
}));

// ---------------------------------------------------------------------------
// next/navigation — `redirect` MUST throw to interrupt the caller, mirroring
// the real Next behavior. We use a typed error so the test can distinguish
// "the layout asked for a redirect" from any other unexpected throw.
// ---------------------------------------------------------------------------

class NextRedirectError extends Error {
    public readonly destination: string;
    constructor(destination: string) {
        super(`NEXT_REDIRECT:${destination}`);
        this.destination = destination;
        this.name = "NextRedirectError";
    }
}

vi.mock("next/navigation", () => ({
    redirect: (dest: string): never => {
        mockState.redirectCalls.push(dest);
        throw new NextRedirectError(dest);
    },
}));

// ---------------------------------------------------------------------------
// @/server/auth/sessions — always returns a valid ACOMPANHANTE session. The
// `verifySessionCookie` mock returns `null` because we always populate
// `x-session-id` in the headers, so the cookie path is never exercised here.
// ---------------------------------------------------------------------------

vi.mock("@/server/auth/sessions", () => ({
    resolveSession: async (sessionId: string) => {
        if (sessionId !== "valid-acompanhante") return null;
        return {
            id: sessionId,
            userId: "user-acompanhante-1",
            userType: "ACOMPANHANTE" as const,
            expiresAt: new Date(Date.now() + 1000 * 60 * 60),
            revokedAt: null,
        };
    },
    verifySessionCookie: (_value: string | null | undefined) => null,
}));

// ---------------------------------------------------------------------------
// @/server/planos — feeds `obterVigente` from the hoisted state so the test
// can flip between { BASICO, PREMIUM, null } per iteration without having to
// rewire the mock.
// ---------------------------------------------------------------------------

vi.mock("@/server/planos", () => ({
    obterVigente: async (_userId: string) =>
        mockState.planoVigente as PlanoDefinition | null,
}));

// SUT must be imported AFTER all `vi.mock` factories so the layout captures
// the mocks at evaluation time.
// eslint-disable-next-line import/first
import AcompanhanteLayout from "@/app/acompanhante/layout";

// ---------------------------------------------------------------------------
// Constants pinned by the design.
// ---------------------------------------------------------------------------

const SELECAO_PLANO_PATH = "/acompanhante/selecao-plano";
const ACOMPANHANTE_HOME = "/acompanhante";

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/**
 * `planoVigente` from the layout's perspective is `PlanoDefinition | null`.
 * We sample the two real frozen definitions plus `null` so we hit both
 * sides of the "plano selecionado vs não selecionado" branch.
 */
const planoVigenteArb: fc.Arbitrary<PlanoDefinition | null> = fc.constantFrom(
    null,
    PLANO_DEFINITIONS.BASICO,
    PLANO_DEFINITIONS.PREMIUM,
);

/**
 * Path space for the property: a representative non-`selecao-plano` route
 * (`/acompanhante`), an arbitrary nested non-`selecao-plano` route
 * (`/acompanhante/perfil`), and the `selecao-plano` route itself.
 *
 * This is the minimal set required to exercise both branches of the table:
 * "path === SELECAO_PLANO" vs "path !== SELECAO_PLANO".
 */
const pathnameArb: fc.Arbitrary<string> = fc.constantFrom(
    "/acompanhante",
    "/acompanhante/perfil",
    SELECAO_PLANO_PATH,
);

// ---------------------------------------------------------------------------
// Test
// ---------------------------------------------------------------------------

describe("Property 26: acesso a áreas de Acompanhante depende do plano vigente", () => {
    beforeEach(() => {
        mockState.sessionId = "valid-acompanhante";
        mockState.pathname = "";
        mockState.planoVigente = null;
        mockState.redirectCalls = [];
    });

    it(
        "for any (planoVigente, pathname), the layout redirects to /selecao-plano when plano is null off-route, to /acompanhante when plano is set on /selecao-plano, and passes through otherwise",
        async () => {
            await fc.assert(
                fc.asyncProperty(
                    planoVigenteArb,
                    pathnameArb,
                    async (plano, path) => {
                        // Reset state for this iteration so leftovers from
                        // previous runs cannot mask a regression.
                        mockState.sessionId = "valid-acompanhante";
                        mockState.pathname = path;
                        mockState.planoVigente = plano;
                        mockState.redirectCalls = [];

                        let caughtRedirect: NextRedirectError | null = null;
                        try {
                            await AcompanhanteLayout({
                                children: React.createElement(
                                    "div",
                                    null,
                                    "child",
                                ),
                            });
                        } catch (err) {
                            if (err instanceof NextRedirectError) {
                                caughtRedirect = err;
                            } else {
                                // Anything else is an unexpected failure
                                // (e.g. a missing mock); rethrow so
                                // fast-check reports it loudly.
                                throw err;
                            }
                        }

                        const isOnSelecaoPlano = path === SELECAO_PLANO_PATH;

                        if (plano === null && !isOnSelecaoPlano) {
                            // Branch 1 (Requirement 5.5): sem plano fora
                            // de /selecao-plano ⇒ redireciona para
                            // /selecao-plano.
                            expect(caughtRedirect).not.toBeNull();
                            expect(caughtRedirect?.destination).toBe(
                                SELECAO_PLANO_PATH,
                            );
                            expect(mockState.redirectCalls).toEqual([
                                SELECAO_PLANO_PATH,
                            ]);
                        } else if (plano !== null && isOnSelecaoPlano) {
                            // Branch 2 (Requirement 5.10): com plano em
                            // /selecao-plano ⇒ redireciona para
                            // /acompanhante (área principal).
                            expect(caughtRedirect).not.toBeNull();
                            expect(caughtRedirect?.destination).toBe(
                                ACOMPANHANTE_HOME,
                            );
                            expect(mockState.redirectCalls).toEqual([
                                ACOMPANHANTE_HOME,
                            ]);
                        } else {
                            // Pass-through: nem plano===null fora de
                            // /selecao-plano, nem plano!==null em
                            // /selecao-plano. O layout deve renderizar
                            // children sem emitir redirect.
                            expect(caughtRedirect).toBeNull();
                            expect(mockState.redirectCalls).toEqual([]);
                        }
                    },
                ),
                { numRuns: 100 },
            );
        },
    );
});
