import * as React from "react";

/**
 * Item visual de um dia da semana exibido pelo {@link WeekCalendar}.
 *
 * Não impomos `value: "SEG" | "TER" | ...` aqui — `value` é uma string
 * livre para que a primitiva seja agnóstica ao domínio (Property 29).
 * O caller mapeia seu enum (`DiaSemana` etc.) para `WeekDay` antes
 * de passar.
 */
export interface WeekDay {
    /** Identificador estável do dia (ex.: "SEG", "TER", "MON"). */
    value: string;
    /** Rótulo curto exibido em destaque ("Seg", "Ter"...). */
    shortLabel: string;
    /** Rótulo longo lido por screen readers ("Segunda-feira"). */
    longLabel?: string;
}

/**
 * Props do {@link WeekCalendar}.
 *
 * Mini calendário em linha com 7 colunas (uma por dia da semana).
 * Cada dia ganha tratamento visual diferente conforme estiver em
 * `activeValues` (preenchido com tom primary) ou não (cinza claro).
 *
 * Uso típico: exibir os dias em que uma Acompanhante atende. O caller
 * passa todos os 7 dias em `days` (ordem visual desejada — geralmente
 * SEG..DOM em pt-BR) e a lista de selecionados em `activeValues`.
 *
 * Nenhuma prop carrega nomes de entidades de domínio (Property 29).
 */
export interface WeekCalendarProps {
    /** Os 7 dias na ordem em que devem aparecer. */
    days: ReadonlyArray<WeekDay>;
    /** Identificadores dos dias ativos. */
    activeValues: ReadonlyArray<string>;
    /** Classes extras aplicadas ao container. */
    className?: string;
}

/**
 * WeekCalendar — mini calendário visual de 7 dias.
 *
 * Visual chamativo: cada dia é um quadrado arredondado com letra(s)
 * em destaque. Dias ativos ficam em `bg-primary-500` com texto branco
 * e leve sombra; dias inativos em `bg-neutral-100` com texto
 * desabilitado. Sem checkbox/botão — é puramente decorativo (read-only).
 *
 * Mobile-friendly: grid 7 colunas que cresce até preencher a largura
 * disponível, com `aspect-square` mantendo cada célula proporcional.
 */
export function WeekCalendar({
    days,
    activeValues,
    className,
}: WeekCalendarProps): React.ReactElement {
    const activeSet = React.useMemo(
        () => new Set(activeValues),
        [activeValues],
    );
    const composed = ["grid grid-cols-7 gap-1.5", className ?? ""]
        .filter(Boolean)
        .join(" ");

    return (
        <div role="list" className={composed}>
            {days.map((day) => {
                const isActive = activeSet.has(day.value);
                const cellClasses = [
                    "flex aspect-square items-center justify-center rounded-md text-[0.7rem] font-semibold uppercase tracking-wider transition-colors",
                    isActive
                        ? "bg-gradient-to-br from-primary-400 to-primary-600 text-white shadow-sm"
                        : "bg-neutral-100 text-text-disabled",
                ].join(" ");
                return (
                    <div
                        key={day.value}
                        role="listitem"
                        aria-label={
                            (day.longLabel ?? day.shortLabel) +
                            (isActive ? " (ativo)" : " (inativo)")
                        }
                        className={cellClasses}
                    >
                        {day.shortLabel}
                    </div>
                );
            })}
        </div>
    );
}
