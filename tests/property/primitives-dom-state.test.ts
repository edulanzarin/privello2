// Feature: privello-platform, Property 28: Componentes primitivos refletem props de estado em atributos DOM
/**
 * Property 28 — Componentes primitivos refletem props de estado em atributos DOM.
 *
 * **Validates: Requirements 6.4**
 *
 * Statement (do design.md, transcrito):
 *
 *   For any combinação de props `disabled`, `loading` e `error` aplicáveis aos
 *   primitivos `Button`, `Input`, `Select` e `Card`, o DOM renderizado pela
 *   Biblioteca_de_Componentes deve refletir esse estado de modo observável e
 *   acessível:
 *     - `disabled === true` ⇒ atributo nativo `disabled` no controle (Button,
 *       Input, Select). Para `Card`, que não é um controle de formulário,
 *       `aria-disabled === "true"` no elemento raiz.
 *     - Em `Button`, `loading === true` ⇒ `aria-busy === "true"` E o botão é
 *       reportado como desabilitado (impede submissão dupla).
 *     - Em `Input` e `Select`, `error` truthy ⇒ `aria-invalid === "true"` no
 *       controle E, quando `errorMessage` for truthy, a mensagem é exposta
 *       como alerta acessível ligado ao controle via `aria-describedby`.
 *
 * O teste exercita ambos os lados do iff em cada caso: a presença do
 * atributo quando a prop é `true` e a sua ausência quando a prop é `false`.
 * Não modifica os primitivos e usa apenas `@testing-library/react` para
 * inspecionar o DOM, garantindo que validamos comportamento observável e
 * não detalhes internos de implementação.
 *
 * O componente é construído com `React.createElement` para manter o arquivo
 * com extensão `.ts` (sem JSX), conforme convenção do diretório de testes
 * de propriedade.
 */

import * as React from "react";
import * as fc from "fast-check";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";

import { Button, type ButtonSize, type ButtonVariant } from "@/components/primitives/Button";
import { Card } from "@/components/primitives/Card";
import { Input } from "@/components/primitives/Input";
import { Select, type SelectOption } from "@/components/primitives/Select";

// ---------------------------------------------------------------------------
// Test scaffolding
// ---------------------------------------------------------------------------

afterEach(() => {
    cleanup();
});

const buttonVariantArb: fc.Arbitrary<ButtonVariant> = fc.constantFrom(
    "primary",
    "secondary",
    "ghost",
    "danger",
);

const buttonSizeArb: fc.Arbitrary<ButtonSize> = fc.constantFrom("sm", "md", "lg");

const SELECT_OPTIONS: ReadonlyArray<SelectOption> = [
    { value: "a", label: "Option A" },
    { value: "b", label: "Option B" },
] as const;

// Generates a non-empty error message; empty messages would (correctly) cause
// the primitives to suppress the alert, which is a separate behavior.
const nonEmptyErrorMessageArb: fc.Arbitrary<string> = fc
    .string({ minLength: 1, maxLength: 80 })
    .filter((s) => s.trim().length > 0);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Property 28: Componentes primitivos refletem props de estado em atributos DOM", () => {
    describe("Button", () => {
        it("disabled ∨ loading ⇒ atributo disabled; loading ⇒ aria-busy=\"true\"", () => {
            fc.assert(
                fc.property(
                    fc.boolean(),
                    fc.boolean(),
                    buttonVariantArb,
                    buttonSizeArb,
                    (disabled, loading, variant, size) => {
                        const { getByRole } = render(
                            React.createElement(
                                Button,
                                { disabled, loading, variant, size },
                                "Press",
                            ),
                        );
                        const button = getByRole("button");

                        // disabled === true ⇒ disabled atributo presente.
                        // loading === true ⇒ disabled (impede clique duplo).
                        if (disabled || loading) {
                            expect(button).toBeDisabled();
                        } else {
                            expect(button).not.toBeDisabled();
                        }

                        // loading === true ⇒ aria-busy="true"; caso contrário
                        // o atributo não deve estar presente como "true".
                        if (loading) {
                            expect(button).toHaveAttribute("aria-busy", "true");
                        } else {
                            expect(button).not.toHaveAttribute("aria-busy", "true");
                        }

                        cleanup();
                    },
                ),
                { numRuns: 100 },
            );
        });
    });

    describe("Input", () => {
        it("disabled ⇒ atributo disabled; error ⇒ aria-invalid=\"true\" e mensagem acessível", () => {
            fc.assert(
                fc.property(
                    fc.boolean(),
                    fc.boolean(),
                    nonEmptyErrorMessageArb,
                    (disabled, error, errorMessage) => {
                        const { getByRole, queryByRole } = render(
                            React.createElement(Input, {
                                disabled,
                                error,
                                errorMessage,
                                label: "Field",
                            }),
                        );
                        const input = getByRole("textbox");

                        // disabled === true ⇔ atributo disabled aplicado.
                        if (disabled) {
                            expect(input).toBeDisabled();
                        } else {
                            expect(input).not.toBeDisabled();
                        }

                        if (error) {
                            // error truthy ⇒ aria-invalid="true".
                            expect(input).toHaveAttribute("aria-invalid", "true");

                            // Mensagem de erro acessível: existe um elemento
                            // com role="alert" contendo a mensagem, e o
                            // input está ligado a ele via aria-describedby.
                            const alert = queryByRole("alert");
                            if (alert === null) {
                                throw new Error(
                                    "Esperava um elemento role=alert com a mensagem de erro acessível.",
                                );
                            }
                            expect(alert.textContent).toBe(errorMessage);

                            const describedBy = input.getAttribute("aria-describedby");
                            if (describedBy === null) {
                                throw new Error(
                                    "Esperava aria-describedby no input ligando-o à mensagem de erro.",
                                );
                            }
                            expect(describedBy.split(/\s+/)).toContain(alert.id);
                        } else {
                            // error falsy ⇒ atributo aria-invalid="true" ausente
                            // e nenhum elemento de alerta de erro deve estar exposto.
                            expect(input).not.toHaveAttribute("aria-invalid", "true");
                            expect(queryByRole("alert")).toBeNull();
                        }

                        cleanup();
                    },
                ),
                { numRuns: 100 },
            );
        });
    });

    describe("Select", () => {
        it("disabled ⇒ atributo disabled; error ⇒ aria-invalid=\"true\" e mensagem acessível", () => {
            fc.assert(
                fc.property(
                    fc.boolean(),
                    fc.boolean(),
                    nonEmptyErrorMessageArb,
                    (disabled, error, errorMessage) => {
                        const { getByRole, queryByRole } = render(
                            React.createElement(Select, {
                                disabled,
                                error,
                                errorMessage,
                                label: "Choose",
                                placeholder: "Select…",
                                options: SELECT_OPTIONS,
                                defaultValue: "",
                            }),
                        );
                        // <select> sem `multiple`/`size>1` tem papel implícito "combobox".
                        const select = getByRole("combobox");

                        if (disabled) {
                            expect(select).toBeDisabled();
                        } else {
                            expect(select).not.toBeDisabled();
                        }

                        if (error) {
                            expect(select).toHaveAttribute("aria-invalid", "true");

                            const alert = queryByRole("alert");
                            if (alert === null) {
                                throw new Error(
                                    "Esperava um elemento role=alert com a mensagem de erro acessível.",
                                );
                            }
                            expect(alert.textContent).toBe(errorMessage);

                            const describedBy = select.getAttribute("aria-describedby");
                            if (describedBy === null) {
                                throw new Error(
                                    "Esperava aria-describedby no select ligando-o à mensagem de erro.",
                                );
                            }
                            expect(describedBy.split(/\s+/)).toContain(alert.id);
                        } else {
                            expect(select).not.toHaveAttribute("aria-invalid", "true");
                            expect(queryByRole("alert")).toBeNull();
                        }

                        cleanup();
                    },
                ),
                { numRuns: 100 },
            );
        });
    });

    describe("Card", () => {
        it("disabled ⇒ aria-disabled=\"true\" no elemento raiz", () => {
            fc.assert(
                fc.property(fc.boolean(), (disabled) => {
                    const { container } = render(
                        React.createElement(
                            Card,
                            { disabled },
                            React.createElement("span", null, "content"),
                        ),
                    );
                    const root = container.firstElementChild;
                    if (root === null) {
                        throw new Error("Card não renderizou um elemento raiz.");
                    }

                    if (disabled) {
                        expect(root).toHaveAttribute("aria-disabled", "true");
                    } else {
                        expect(root).not.toHaveAttribute("aria-disabled", "true");
                    }

                    cleanup();
                }),
                { numRuns: 100 },
            );
        });
    });
});
