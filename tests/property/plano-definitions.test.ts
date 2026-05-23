// Feature: privello-platform, Property 22: Definições de plano refletem fielmente os requisitos
/**
 * Property 22 — Definições de plano refletem fielmente os requisitos.
 *
 * `PLANO_DEFINITIONS` é a única fonte de verdade dos limites e benefícios de
 * `Plano_Basico` e `Plano_Premium` (Requirements 5.1, 5.2, 5.3). Esta
 * propriedade verifica, de forma estrutural, que essa constante reflete
 * literalmente o que os requisitos prescrevem:
 *
 *   - O conjunto de chaves de `PLANO_DEFINITIONS` é exatamente
 *     `{ "BASICO", "PREMIUM" }` — nem mais (planos extras), nem menos
 *     (algum tipo removido por engano).
 *   - `BASICO`:  `limiteMidias === 10`,  `permiteStories === false`,
 *                `prioridadeBusca === false`, `permiteAudio === false`.
 *   - `PREMIUM`: `limiteMidias === 50`,  `permiteStories === true`,
 *                `prioridadeBusca === true`, `permiteAudio === true`.
 *   - Cada entrada carrega `tipo` igual à sua chave.
 *
 * Como o domínio é finito (apenas dois planos), combinamos asserts diretos
 * com uma propriedade fast-check sobre `fc.constantFrom("BASICO", "PREMIUM")`.
 * Isso é deliberadamente redundante: os asserts garantem detecção imediata
 * de qualquer regressão pontual, e a propriedade fast-check garante que a
 * verificação foi feita para cada valor possível do enum (cobertura
 * exaustiva via amostragem com `numRuns: 100`).
 *
 * **Validates: Requirements 5.1, 5.2, 5.3**
 */

import { describe, expect, it } from "vitest";
import * as fc from "fast-check";

import {
    PLANO_DEFINITIONS,
    type PlanoTipo,
} from "@/domain/plano/definitions";

describe("Property 22: definições de plano refletem fielmente os requisitos", () => {
    it("PLANO_DEFINITIONS contém exatamente {BASICO, PREMIUM}", () => {
        // Set comparison so a hipotética nova chave (ou chave faltante) é
        // detectada independentemente de ordem de declaração.
        const chaves = Object.keys(PLANO_DEFINITIONS).sort();
        expect(chaves).toEqual(["BASICO", "PREMIUM"]);
    });

    it("BASICO reflete o Requirement 5.2 (10 mídias, sem Stories, sem prioridade, sem áudio)", () => {
        const basico = PLANO_DEFINITIONS.BASICO;
        expect(basico.tipo).toBe("BASICO");
        expect(basico.limiteMidias).toBe(10);
        expect(basico.permiteStories).toBe(false);
        expect(basico.prioridadeBusca).toBe(false);
        expect(basico.permiteAudio).toBe(false);
    });

    it("PREMIUM reflete o Requirement 5.3 (50 mídias, com Stories, com prioridade, com áudio)", () => {
        const premium = PLANO_DEFINITIONS.PREMIUM;
        expect(premium.tipo).toBe("PREMIUM");
        expect(premium.limiteMidias).toBe(50);
        expect(premium.permiteStories).toBe(true);
        expect(premium.prioridadeBusca).toBe(true);
        expect(premium.permiteAudio).toBe(true);
    });

    it("para todo tipo em {BASICO, PREMIUM}, a definição corresponde ao requisito (fast-check, 100 runs)", () => {
        // Domínio finito: amostragem cobre exaustivamente os dois valores
        // possíveis do enum `PlanoTipo`.
        const tipoArb: fc.Arbitrary<PlanoTipo> = fc.constantFrom(
            "BASICO",
            "PREMIUM",
        );

        fc.assert(
            fc.property(tipoArb, (tipo) => {
                const def = PLANO_DEFINITIONS[tipo];

                // O `tipo` armazenado bate com a chave usada para acessá-lo.
                expect(def.tipo).toBe(tipo);

                if (tipo === "BASICO") {
                    expect(def.limiteMidias).toBe(10);
                    expect(def.permiteStories).toBe(false);
                    expect(def.prioridadeBusca).toBe(false);
                    expect(def.permiteAudio).toBe(false);
                } else {
                    expect(def.limiteMidias).toBe(50);
                    expect(def.permiteStories).toBe(true);
                    expect(def.prioridadeBusca).toBe(true);
                    expect(def.permiteAudio).toBe(true);
                }
            }),
            { numRuns: 100 },
        );
    });
});
