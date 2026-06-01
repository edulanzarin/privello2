"use client";

import * as React from "react";

import { Avatar } from "./Avatar";

/**
 * Item da {@link StoriesRail}.
 *
 * Genérico — sem nomes de entidades de domínio (Property 29).
 * Quem fornece o array só precisa entregar avatar + identificador
 * + contagem de não-vistos. O ring colorido é derivado de
 * `unseen > 0`.
 */
export interface StoriesRailItem {
    /** Identificador único do item (usado como `key` e na URL). */
    id: string;
    /** Texto exibido abaixo do avatar (até 1 linha, truncado). */
    label: string;
    /** URL do avatar; quando `null` cai no fallback de iniciais. */
    avatarUrl?: string | null;
    /** Quantidade de itens novos pra alimentar o ring colorido. */
    unseen: number;
    /** Total de itens (usado pra decidir se o ring deve aparecer). */
    total: number;
    /** URL pra navegação ao clicar no item. */
    href: string;
}

/**
 * Props da {@link StoriesRail}.
 */
export interface StoriesRailProps {
    /** Itens da tira, na ordem de exibição. */
    items: ReadonlyArray<StoriesRailItem>;
    /**
     * Quando passado, é chamado em vez da navegação por href —
     * usado quando o consumidor quer interceptar pra abrir um
     * modal/viewer. Recebe o `id` do item.
     */
    onItemClick?: (id: string) => void;
    /** Classes extras aplicadas ao container externo. */
    className?: string;
}

/**
 * StoriesRail — tira horizontal de avatares com ring (estilo
 * Instagram/Stories).
 *
 * Mostra cada item como um avatar XL com ring colorido (quando há
 * conteúdo novo) ou cinza (já visualizado), label embaixo
 * truncado. Scroll horizontal nativo com snap. Em mobile e desktop
 * o comportamento é o mesmo — só muda o tamanho do gap.
 *
 * O componente não conhece "stories" como conceito de domínio:
 * recebe `items` genéricos com `unseen/total/href`. Quem montar a
 * lista decide se aquele item representa stories ativos, posts
 * novos ou outra coisa.
 *
 * Comportamento:
 *   - Sem itens: não renderiza nada (retorna `null`).
 *   - Com `onItemClick`: chama o callback ao clicar (para abrir
 *     viewer modal).
 *   - Sem `onItemClick`: renderiza `<a>` que navega pro `href`.
 */
export function StoriesRail({
    items,
    onItemClick,
    className,
}: StoriesRailProps): React.ReactElement | null {
    if (items.length === 0) return null;

    return (
        <div
            className={[
                "overflow-x-auto pb-1",
                "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
                className ?? "",
            ]
                .filter(Boolean)
                .join(" ")}
        >
            <ul className="flex items-start gap-4 snap-x snap-mandatory sm:gap-5">
                {items.map((item) => (
                    <li
                        key={item.id}
                        className="snap-start shrink-0"
                    >
                        <RailButton
                            item={item}
                            onItemClick={onItemClick}
                        />
                    </li>
                ))}
            </ul>
        </div>
    );
}

/**
 * Subcomponente interno — encapsula `<a>` ou `<button>` conforme
 * a presença de `onItemClick`. Mantém a marcação acessível
 * (foco visível, label).
 */
function RailButton({
    item,
    onItemClick,
}: {
    item: StoriesRailItem;
    onItemClick?: (id: string) => void;
}): React.ReactElement {
    const ring: "unseen" | "seen" | "none" =
        item.total === 0
            ? "none"
            : item.unseen > 0
                ? "unseen"
                : "seen";

    const inner = (
        <>
            <span className="relative block transition-transform group-hover:scale-105">
                <Avatar
                    src={item.avatarUrl ?? null}
                    name={item.label}
                    size="xl"
                    storyRing={ring}
                />
                {item.unseen > 0 ? (
                    <span
                        aria-hidden="true"
                        className="absolute -top-0.5 -right-0.5 inline-block h-3 w-3 rounded-full bg-gradient-to-br from-accent to-accent-deep shadow-[0_2px_8px_-2px_rgba(197,82,58,0.55)] ring-2 ring-surface"
                    />
                ) : null}
            </span>
            <span className="block max-w-[6rem] truncate text-center text-xs font-medium text-text-primary">
                {item.label}
            </span>
        </>
    );

    const composed =
        "group flex w-[6rem] flex-col items-center gap-2 rounded-2xl px-1 py-1 transition-all hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40";

    if (onItemClick !== undefined) {
        return (
            <button
                type="button"
                onClick={() => onItemClick(item.id)}
                className={composed}
                aria-label={item.label}
            >
                {inner}
            </button>
        );
    }

    return (
        <a href={item.href} className={composed} aria-label={item.label}>
            {inner}
        </a>
    );
}
