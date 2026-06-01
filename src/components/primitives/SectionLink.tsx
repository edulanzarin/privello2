import * as React from "react";
import Link from "next/link";

import { ChevronRightIcon } from "../icons";

/**
 * Props do {@link SectionLink}.
 *
 * Link compacto com seta usado no slot `trailing` de seções
 * editoriais (ex.: "Ver todos →" no header de "Em destaque" da
 * home). Centraliza o visual pra que toda página de listagem nasça
 * com o mesmo `text-sm font-medium text-primary-700` + chevron.
 *
 * Quando recebe `href` interno (com `/`), renderiza usando
 * `next/link` pra navegação sem reload. Para URLs externas, passe
 * a prop `external` que renderiza um `<a>` puro.
 *
 * Nenhuma prop carrega nomes de entidades de domínio (Property 29).
 */
export interface SectionLinkProps {
    /** URL de destino. */
    href: string;
    /** Texto do link. */
    children: React.ReactNode;
    /**
     * Quando `true`, ignora `next/link` e renderiza um `<a>` puro
     * (com `target="_blank"` + `rel="noopener noreferrer"` por
     * padrão). Útil para destinos externos ou âncoras com side
     * effects.
     */
    external?: boolean;
    /** Classes extras aplicadas ao container. */
    className?: string;
}

/**
 * SectionLink — link "ver mais" com seta, usado em headers de
 * seção. Visualmente leve (apenas tipografia, sem fundo) pra não
 * competir com o {@link SectionTitle} ao lado.
 */
export function SectionLink({
    href,
    children,
    external = false,
    className,
}: SectionLinkProps): React.ReactElement {
    const composed = [
        "inline-flex items-center gap-1.5 text-sm font-semibold tracking-tight text-accent-deep transition-colors hover:text-accent focus:outline-none focus-visible:underline",
        className ?? "",
    ]
        .filter(Boolean)
        .join(" ");

    const inner = (
        <>
            <span>{children}</span>
            <ChevronRightIcon size={14} />
        </>
    );

    if (external) {
        return (
            <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className={composed}
            >
                {inner}
            </a>
        );
    }

    return (
        <Link href={href} className={composed}>
            {inner}
        </Link>
    );
}
