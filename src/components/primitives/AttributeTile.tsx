import * as React from "react";

/**
 * Props do {@link AttributeTile}.
 *
 * Tile compacto para um par "label + value" com ícone redondo grande.
 * Pensado para grids de atributos (ex.: peso/altura/pé/etnia em
 * perfis públicos). Substitui a combinação repetida de
 * `<div className="flex flex-col"><span>label</span><span>value</span></div>`
 * que aparecia em vários lugares do produto.
 *
 * Diferença para {@link import("./MetricPill").MetricPill}: tem
 * presença visual maior (ícone em círculo tonal), funciona em grid
 * 2-3 colunas e é a unidade base de "ficha de aparência".
 *
 * Diferença para {@link import("./StatHighlight").StatHighlight}:
 * AttributeTile é uniforme e roda em grid; StatHighlight é hero
 * único e horizontal.
 *
 * Nenhuma prop carrega nomes de entidades de domínio (Property 29).
 */
export interface AttributeTileProps {
    /** Ícone exibido em círculo no topo. */
    icon: React.ReactNode;
    /** Valor — texto principal exibido em destaque (peso da regular). */
    value: React.ReactNode;
    /** Label uppercase abaixo do valor. */
    label: React.ReactNode;
    /** Classes extras aplicadas ao container. */
    className?: string;
}

/**
 * AttributeTile — tile de atributo com ícone, valor e label.
 *
 * Layout vertical: círculo tonal no topo (`w-10 h-10`), valor em
 * texto médio centrado (`text-sm font-semibold`) e label uppercase
 * compacto em baixo. Borda fina + fundo branco para que o tile
 * funcione em qualquer surface.
 *
 * Em valores ausentes, o caller passa `"—"` em `value` — o tile não
 * tem estado "vazio" próprio, mantendo a primitiva simples.
 */
export function AttributeTile({
    icon,
    value,
    label,
    className,
}: AttributeTileProps): React.ReactElement {
    const composed = [
        "flex flex-col items-center gap-2.5 rounded-2xl bg-neutral-50 px-3 py-5 text-center transition-all duration-200 hover:bg-[color:var(--accent-soft)]/60 hover:-translate-y-0.5",
        className ?? "",
    ]
        .filter(Boolean)
        .join(" ");

    return (
        <div className={composed}>
            <div
                aria-hidden="true"
                className="flex h-11 w-11 items-center justify-center rounded-full bg-surface text-[color:var(--accent-deep)] ring-2 ring-[color:var(--accent)]/15"
            >
                {icon}
            </div>
            <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-base font-semibold tracking-tight text-text-primary">
                    {value}
                </span>
                <span className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-text-disabled">
                    {label}
                </span>
            </div>
        </div>
    );
}
