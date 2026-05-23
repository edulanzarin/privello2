import * as React from "react";

import { MediaThumbnail } from "./MediaThumbnail";
import type { MediaItem } from "./MediaTypes";

/**
 * Props do {@link MediaGrid}.
 *
 * Grade responsiva de {@link MediaThumbnail}s. Por padrão a densidade
 * é confortável em qualquer largura de tela:
 *
 * - Mobile (`< sm`): 3 colunas.
 * - Tablet (`sm – md`): 4 colunas.
 * - Desktop (`md+`): 5 colunas.
 *
 * Quando a lista está vazia, renderiza `null` — o consumidor é
 * responsável por exibir um {@link import("./EmptyState").EmptyState}
 * próprio (a mensagem varia conforme o filtro ativo).
 *
 * Nenhuma prop carrega nomes de entidades de domínio (Property 29).
 */
export interface MediaGridProps {
    /** Itens a renderizar. */
    items: ReadonlyArray<MediaItem>;
    /**
     * Callback chamado quando o usuário clica num thumbnail.
     * Recebe o `id` do item — tipicamente abre um carrossel modal
     * ancorado naquele item.
     */
    onOpen?: (id: string) => void;
    /** Aspecto dos tiles. Padrão: `"square"`. */
    aspect?: "square" | "portrait" | "video";
    /**
     * Densidade da grade. Padrão: `"dense"` (3/4/5 colunas conforme
     * breakpoint, estilo Instagram). Use `"comfortable"` quando o
     * conteúdo precisa de tiles maiores e mais legíveis (ex.: perfil
     * público) — fixa em 3 colunas em qualquer largura, com gap
     * maior.
     */
    density?: "dense" | "comfortable";
    /** Classes extras aplicadas ao container. */
    className?: string;
}

const DENSITY_CLASSES: Record<NonNullable<MediaGridProps["density"]>, string> =
{
    dense: "grid-cols-3 gap-1 sm:grid-cols-4 sm:gap-2 md:grid-cols-5",
    comfortable: "grid-cols-3 gap-2 sm:gap-3",
};

/**
 * MediaGrid — grade responsiva de mídias.
 *
 * Visual: `grid` com gap dependente da densidade. Modo `dense` é
 * estilo Instagram (3/4/5 cols); modo `comfortable` mantém 3 cols em
 * todos os breakpoints com gap maior — útil pra perfis públicos onde
 * cada mídia merece mais peso visual.
 */
export function MediaGrid({
    items,
    onOpen,
    aspect = "square",
    density = "dense",
    className,
}: MediaGridProps): React.ReactElement | null {
    if (items.length === 0) return null;

    return (
        <div
            className={[
                "grid",
                DENSITY_CLASSES[density],
                className ?? "",
            ]
                .filter(Boolean)
                .join(" ")}
        >
            {items.map((item) => (
                <MediaThumbnail
                    key={item.id}
                    item={item}
                    aspect={aspect}
                    onOpen={onOpen}
                />
            ))}
        </div>
    );
}
