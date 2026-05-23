import * as React from "react";

/**
 * Item de uma {@link StatStrip}.
 */
export interface StatStripItem {
    /** Número/valor de destaque ("+22mi", "+1k"). */
    value: React.ReactNode;
    /** Rótulo descritivo abaixo do valor ("usuários", "vídeos"). */
    label: React.ReactNode;
    /** Ícone opcional acima do valor. */
    icon?: React.ReactNode;
}

/**
 * Props da {@link StatStrip}.
 *
 * Linha de "métricas de orgulho" inspirada nas landings modernas
 * ("+1mi de visitantes mensais", "+50mil profissionais"). Em
 * mobile fica em pares (2 colunas), em desktop pode ir até 4 numa
 * linha só. Sem cards — tipografia faz o trabalho.
 *
 * Nenhuma prop carrega nomes de entidades de domínio (Property 29).
 */
export interface StatStripProps {
    items: ReadonlyArray<StatStripItem>;
    /**
     * Tamanho do número de destaque. Padrão: `"md"`.
     */
    size?: "sm" | "md" | "lg";
    /** Classes extras aplicadas ao container. */
    className?: string;
}

const VALUE_CLASSES: Record<NonNullable<StatStripProps["size"]>, string> = {
    sm: "text-xl",
    md: "text-2xl sm:text-3xl",
    lg: "text-3xl sm:text-4xl",
};

/**
 * StatStrip — fileira tipográfica de métricas.
 *
 * Visual: cada item em `flex flex-col` com valor em peso semibold,
 * tracking apertado e cor primary-700; rótulo abaixo em `text-xs`
 * cinza secundário. Separador vertical sutil entre itens em desktop.
 */
export function StatStrip({
    items,
    size = "md",
    className,
}: StatStripProps): React.ReactElement {
    return (
        <div
            className={[
                "grid grid-cols-2 gap-x-4 gap-y-4 sm:flex sm:flex-wrap sm:items-start sm:gap-6",
                className ?? "",
            ]
                .filter(Boolean)
                .join(" ")}
        >
            {items.map((item, idx) => (
                <div
                    key={idx}
                    className={[
                        "flex flex-col gap-0.5",
                        idx > 0 ? "sm:border-l sm:border-border sm:pl-6" : "",
                    ].join(" ")}
                >
                    {item.icon != null ? (
                        <span
                            aria-hidden="true"
                            className="mb-1 inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary-50 text-primary-700"
                        >
                            {item.icon}
                        </span>
                    ) : null}
                    <span
                        className={[
                            "font-semibold tracking-tight text-primary-700",
                            VALUE_CLASSES[size],
                        ].join(" ")}
                    >
                        {item.value}
                    </span>
                    <span className="text-xs text-text-secondary">
                        {item.label}
                    </span>
                </div>
            ))}
        </div>
    );
}
