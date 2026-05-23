"use client";

import * as React from "react";

import { Button } from "./Button";

/**
 * Props do {@link Paginator}.
 *
 * Wrapper genérico de paginação client-side por expansão progressiva.
 * Mostra os primeiros `pageSize` itens, e expande +`pageSize` a cada
 * clique no botão "Ver mais". Quando todos os itens estão visíveis,
 * o botão some.
 *
 * O componente é agnóstico ao tipo do item — recebe a lista completa
 * como prop genérica `items` e delega a renderização ao `render`,
 * que recebe a sublista visível. Essa inversão evita acoplar a
 * primitiva ao `MediaGrid` (ou a qualquer outra forma de renderização)
 * e permite reuso em listas de comentários, posts, perfis, etc.
 *
 * Quando `items` muda (filtro trocado, dados recarregados), o cursor
 * volta para `pageSize` para evitar exibir mais itens do que a nova
 * lista comporta.
 *
 * Acessibilidade:
 * - O botão "Ver mais" é um `<Button>` semântico.
 * - Anuncia o progresso via `aria-live="polite"` no rótulo
 *   (`Mostrando X de Y`), gerado quando `showCounter !== false`.
 *
 * Nenhuma prop carrega nomes de entidades de domínio (Property 29).
 */
export interface PaginatorProps<T> {
    /** Lista completa. */
    items: ReadonlyArray<T>;
    /**
     * Tamanho de cada "página" exibida. O primeiro render mostra
     * `pageSize` itens; cada clique no botão revela mais `pageSize`.
     */
    pageSize: number;
    /**
     * Render prop que recebe a sublista visível. O caller compõe
     * com sua própria primitiva de lista (`MediaGrid`, `<ul>`, etc.).
     */
    render: (visibleItems: ReadonlyArray<T>) => React.ReactNode;
    /** Texto do botão de expansão. Padrão: `"Ver mais"`. */
    loadMoreLabel?: React.ReactNode;
    /**
     * Quando `true` (default), exibe pequeno contador "Mostrando X
     * de Y" abaixo do botão. Passe `false` em listas onde o total
     * fica óbvio pelo layout.
     */
    showCounter?: boolean;
    /** Classes extras aplicadas ao container. */
    className?: string;
}

/**
 * Paginator — paginação por expansão progressiva.
 *
 * Visual: render do conteúdo + botão centralizado abaixo (full-width
 * em mobile, auto em desktop) + contador opcional. Sem indicadores
 * intermediários (números de página) — fluxo "ver mais" é mais
 * adequado a galerias e feeds que paginação numerada.
 */
export function Paginator<T>({
    items,
    pageSize,
    render,
    loadMoreLabel = "Ver mais",
    showCounter = true,
    className,
}: PaginatorProps<T>): React.ReactElement {
    const safePageSize = Math.max(1, pageSize);
    const [visibleCount, setVisibleCount] = React.useState(safePageSize);

    // Reset quando a lista muda. Comparar pelo length é o suficiente
    // pra detectar troca de filtro / refetch porque o caller passa
    // arrays diferentes — sem dependência de identidade profunda.
    React.useEffect(() => {
        setVisibleCount(safePageSize);
    }, [items, safePageSize]);

    const visibleItems = items.slice(0, visibleCount);
    const hasMore = visibleCount < items.length;

    const composed = ["flex flex-col gap-3", className ?? ""]
        .filter(Boolean)
        .join(" ");

    return (
        <div className={composed}>
            {render(visibleItems)}

            {hasMore ? (
                <div className="flex flex-col items-center gap-1.5">
                    <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() =>
                            setVisibleCount((n) =>
                                Math.min(items.length, n + safePageSize),
                            )
                        }
                    >
                        {loadMoreLabel}
                    </Button>
                    {showCounter ? (
                        <span
                            aria-live="polite"
                            className="text-[0.7rem] text-text-secondary"
                        >
                            Mostrando {visibleItems.length} de {items.length}
                        </span>
                    ) : null}
                </div>
            ) : null}
        </div>
    );
}
