import * as React from "react";

/**
 * Props do {@link StepProgress}.
 *
 * Indicador visual de progresso para fluxos multi-step (ex.:
 * Onboarding_Acompanhante). Mostra o rótulo textual (ex.: "Passo 2 de
 * 6") sobre uma barra segmentada onde os segmentos preenchidos
 * representam o progresso atual.
 *
 * Nenhuma prop carrega nomes de entidades de domínio (Property 29).
 */
export interface StepProgressProps {
    /** Índice (1-based) do passo atual. Deve estar em `[1, total]`. */
    current: number;
    /** Número total de passos do fluxo. */
    total: number;
    /**
     * Rótulo customizado. Padrão: `"Passo {current} de {total}"`.
     * Se `null`, suprime o texto e exibe só a barra.
     */
    label?: React.ReactNode;
    /**
     * Largura da barra em classes Tailwind. Padrão: `"w-32"` —
     * adequado para cards `max-w-sm`. Use `"w-48"` ou `"w-full"` em
     * containers maiores.
     */
    barWidth?: string;
}

/**
 * StepProgress — indicador "Passo X de N" + barra segmentada.
 *
 * Acessibilidade:
 * - `role="progressbar"` com `aria-valuemin`/`aria-valuemax`/`aria-valuenow`
 *   permite que leitores de tela anunciem o progresso.
 * - O texto visível é o mesmo exposto via `aria-label` para garantir
 *   leitura coerente.
 */
export function StepProgress({
    current,
    total,
    label,
    barWidth = "w-32",
}: StepProgressProps): React.ReactElement {
    const safeCurrent = Math.max(1, Math.min(current, total));
    const defaultLabel = `Passo ${safeCurrent} de ${total}`;
    const visibleLabel = label === undefined ? defaultLabel : label;
    const ariaLabel = typeof visibleLabel === "string" ? visibleLabel : defaultLabel;

    return (
        <div
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={total}
            aria-valuenow={safeCurrent}
            aria-label={ariaLabel}
            className="flex flex-col items-center gap-2"
        >
            {visibleLabel !== null ? (
                <span className="text-xs font-medium text-text-secondary">
                    {visibleLabel}
                </span>
            ) : null}
            <div className={`flex items-center gap-1 ${barWidth}`}>
                {Array.from({ length: total }, (_, i) => (
                    <span
                        key={i}
                        aria-hidden="true"
                        className={[
                            "h-1 flex-1 rounded-sm transition-colors duration-200",
                            i < safeCurrent
                                ? "bg-accent"
                                : "bg-neutral-200",
                        ].join(" ")}
                    />
                ))}
            </div>
        </div>
    );
}
