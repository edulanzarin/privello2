import * as React from "react";
import Image from "next/image";

/**
 * Variantes do {@link Logo}.
 *
 * - `"mark"`: apenas o símbolo (ícone), útil para favicons, avatares e
 *   contextos de espaço reduzido.
 * - `"wordmark"`: símbolo + nome em texto, padrão para top bar e
 *   cabeçalhos.
 */
export type LogoVariant = "mark" | "wordmark";

/**
 * Props do {@link Logo}.
 *
 * Marca da plataforma. O símbolo vem de `public/logo.png` (servido
 * em `/logo.png`) — substituir esse arquivo basta para rebrandar
 * em todos os consumidores. A wordmark é renderizada na fonte do
 * produto (mesma família tipográfica) para manter peso visual
 * homogêneo.
 *
 * Nenhuma prop carrega nomes de entidades de domínio (Property 29).
 */
export interface LogoProps {
    /** Variante visual. Padrão: `"wordmark"`. */
    variant?: LogoVariant;
    /** Tamanho do símbolo em pixels. Padrão: 22. */
    size?: number;
    /** Classes extras aplicadas ao container. */
    className?: string;
}

/**
 * Logo da plataforma.
 *
 * Renderiza a imagem `logo.png` opcionalmente acompanhada do
 * wordmark "Privello" em semibold. A imagem é renderizada
 * via `next/image` com `priority` para que apareça sem layout
 * shift no topo do shell.
 */
export function Logo({
    variant = "wordmark",
    size = 22,
    className,
}: LogoProps): React.ReactElement {
    const composed = ["inline-flex items-center gap-2", className ?? ""]
        .filter(Boolean)
        .join(" ");

    return (
        <span className={composed} aria-label="Privello">
            <Image
                src="/logo.png"
                alt=""
                width={size}
                height={size}
                priority
                className="block"
            />
            {variant === "wordmark" ? (
                <span className="text-base font-semibold tracking-tight text-text-primary">
                    Privello
                </span>
            ) : null}
        </span>
    );
}
