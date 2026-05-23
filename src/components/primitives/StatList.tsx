import * as React from "react";

/**
 * Item da {@link StatList}.
 */
export interface StatListItem {
    label: React.ReactNode;
    value: React.ReactNode;
}

/**
 * Props da {@link StatList}.
 *
 * Lista vertical de pares "rótulo · valor" com hairlines entre
 * itens. Usada em quadros laterais de hero/landing pra exibir um
 * resumo numérico (perfis ativos, cidades, taxa de verificação,
 * etc).
 *
 * Nenhuma prop carrega nomes de entidades de domínio (Property 29).
 */
export interface StatListProps {
    items: ReadonlyArray<StatListItem>;
    /**
     * Texto opcional renderizado abaixo da lista em cinza fino,
     * tipicamente um disclaimer ou nota.
     */
    footer?: React.ReactNode;
    /** Classes extras aplicadas ao container. */
    className?: string;
}

/**
 * StatList — lista densa de pares chave/valor.
 *
 * Cada item é um `<li>` flex com label à esquerda em
 * `text-text-secondary` e value à direita em peso semibold +
 * `tabular-nums`. Hairline `border-b border-border` separa os
 * itens, exceto o último.
 */
export function StatList({
    items,
    footer,
    className,
}: StatListProps): React.ReactElement {
    return (
        <div className={["flex flex-col gap-3", className ?? ""].filter(Boolean).join(" ")}>
            <ul className="flex flex-col">
                {items.map((item, idx) => (
                    <li
                        key={idx}
                        className={[
                            "flex items-center justify-between gap-4 py-3",
                            idx < items.length - 1
                                ? "border-b border-border"
                                : "",
                        ].join(" ")}
                    >
                        <span className="text-sm text-text-secondary">
                            {item.label}
                        </span>
                        <span className="text-base font-semibold tracking-tight tabular-nums text-text-primary">
                            {item.value}
                        </span>
                    </li>
                ))}
            </ul>
            {footer != null ? (
                <p className="text-xs leading-relaxed text-text-secondary">
                    {footer}
                </p>
            ) : null}
        </div>
    );
}
