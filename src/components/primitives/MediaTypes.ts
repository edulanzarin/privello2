/**
 * Tipos de mídia exibidos nos primitivos de galeria
 * ({@link import("./MediaThumbnail").MediaThumbnail},
 * {@link import("./MediaGrid").MediaGrid},
 * {@link import("./MediaCarousel").MediaCarousel}).
 *
 * Vivem num módulo separado porque são consumidos por múltiplos
 * primitivos que precisam compartilhar o mesmo contrato. Manter
 * aqui evita dependências circulares e dá um único lugar onde
 * estender quando o `Sistema_de_Midias` ganhar campos novos
 * (descrição, tags, etc.).
 *
 * Nenhum tipo carrega nomes de entidades de domínio (Property 29).
 */

/**
 * Item exibido em galeria/carrossel.
 *
 * Cobre tanto fotos quanto vídeos. O campo `type` discrimina o
 * tratamento visual (badge "play" sobre vídeos, controles diferentes
 * no carrossel) e o `posterUrl` opcional permite exibir um frame
 * estático antes do vídeo carregar.
 */
export type MediaItem = {
    /** Identificador estável do item (storage key, hash, etc.). */
    id: string;
    /** Tipo do item — discrimina renderização. */
    type: "photo" | "video";
    /**
     * URL pública do arquivo. Para fotos é a imagem em si; para
     * vídeos é a fonte do `<video>`. Pode ser relativa
     * (`/api/storage/<key>`) ou absoluta.
     */
    url: string;
    /**
     * Thumbnail/poster opcional. Para vídeos, idealmente um frame
     * extraído pelo `Sistema_de_Midias`. Quando ausente para vídeo,
     * o navegador exibe o primeiro frame após o load.
     */
    posterUrl?: string | null;
    /**
     * Texto descritivo da mídia. Usado como `alt` em fotos e
     * `aria-label` em vídeos. Quando ausente, cai num default
     * neutro.
     */
    description?: string | null;
    /**
     * Data de publicação. O carrossel formata como tempo relativo
     * ("há 2h", "há 3d") quando exibido. Aceita `Date` ou ISO
     * string para facilitar serialização Server → Client.
     */
    createdAt?: Date | string;
    /** Total de curtidas. Quando ausente, o contador não é exibido. */
    likes?: number;
    /**
     * `true` se o usuário atual já curtiu este item. Default: `false`.
     */
    liked?: boolean;
    /** Total de comentários. Quando ausente, o contador não é exibido. */
    comments?: number;
};

/**
 * Comentário exibido pelo {@link import("./Comment").Comment} e pelo
 * {@link import("./MediaCarousel").MediaCarousel}.
 *
 * O `authorIdentifier` é o `@` do autor — mantido como string em vez
 * de slug porque a UI não precisa diferenciar Cliente/Acompanhante
 * para renderizar.
 */
export type MediaComment = {
    id: string;
    /** Nome de exibição do autor. */
    authorName: string;
    /** Identificador (`@username`) do autor. */
    authorIdentifier: string;
    /** URL da foto de perfil do autor. */
    authorPhotoUrl?: string | null;
    /** Texto do comentário. */
    text: string;
    /**
     * Tempo relativo já formatado pelo servidor (ex.: `"2h"`,
     * `"ontem"`, `"3d"`). A formatação é responsabilidade da camada
     * de dados; o primitivo apenas renderiza.
     */
    timeAgo: string;
};
