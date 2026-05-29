import * as React from "react";

/**
 * Props do {@link ActivityFeedItem}.
 *
 * Item denso de feed estilo "linha do tempo de app moderno": ícone
 * circular tonal à esquerda, conteúdo (título + subtítulo) no meio,
 * timestamp/trailing à direita. Pensado para listagens longas onde
 * `Card`s individuais consumiriam espaço demais.
 *
 * Nenhuma prop carrega nomes de entidades de domínio (Property 29).
 */
export interface ActivityFeedItemProps {
    /** Ícone tonal exibido em círculo à esquerda. */
    icon?: React.ReactNode;
    /** Conteúdo principal (geralmente um `<span>` com texto + ênfases). */
    title: React.ReactNode;
    /**
     * Linha auxiliar abaixo do título (descrição curta, contexto).
     * Mantém em uma linha com `truncate`. Opcional.
     */
    subtitle?: React.ReactNode;
    /**
     * Slot à direita: timestamp relativo ("2h"), contador, badge ou
     * botão pequeno. Some em mobile estreito quando o título for
     * longo, mas mantém o leitor de tela ciente.
     */
    trailing?: React.ReactNode;
    /**
     * Quando fornecido, o item vira um link clicável (`<a>`) que
     * recebe foco e hover. Para navegação interna, prefira
     * envolver em `<Link>` do Next.js manualmente.
     */
    href?: string;
    /** Classes extras aplicadas ao container. */
    className?: string;
}

/**
 * ActivityFeedItem — uma linha do feed.
 *
 * Visual: linha horizontal com ícone à esquerda em círculo `primary-50`,
 * separador inferior fino entre itens (gerenciado pelo
 * {@link ActivityFeed} pai). Sem border/shadow individual — a
 * "leveza" vem do próprio espaçamento.
 */
export function ActivityFeedItem({
    icon,
    title,
    subtitle,
    trailing,
    href,
    className,
}: ActivityFeedItemProps): React.ReactElement {
    const composed = [
        "flex items-start gap-3 px-4 py-3 transition-colors duration-150",
        href !== undefined
            ? "hover:bg-[#fff0eb]/60 focus-visible:bg-[#fff0eb]/70 focus-visible:outline-none"
            : "",
        className ?? "",
    ]
        .filter(Boolean)
        .join(" ");

    const inner = (
        <>
            {icon != null ? (
                <span
                    aria-hidden="true"
                    className="inline-flex h-9 w-9 flex-none items-center justify-center rounded-full bg-[color:var(--accent-soft)] text-[color:var(--accent-deep)]"
                >
                    {icon}
                </span>
            ) : null}
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-sm text-text-primary">
                    {title}
                </span>
                {subtitle != null ? (
                    <span className="truncate text-xs text-text-secondary">
                        {subtitle}
                    </span>
                ) : null}
            </div>
            {trailing != null ? (
                <span className="flex-none whitespace-nowrap text-xs text-text-disabled">
                    {trailing}
                </span>
            ) : null}
        </>
    );

    if (href !== undefined) {
        return (
            <a href={href} className={composed}>
                {inner}
            </a>
        );
    }

    return <div className={composed}>{inner}</div>;
}

/**
 * Props do {@link ActivityFeed}.
 *
 * Container de itens de feed. Aplica fundo de superfície, borda fina
 * uniforme e separadores entre itens. Quando vazio, espera receber um
 * {@link import("./EmptyState").EmptyState} como filho único.
 */
export interface ActivityFeedProps {
    /** Itens (geralmente {@link ActivityFeedItem}) ou um EmptyState. */
    children: React.ReactNode;
    /** Classes extras aplicadas ao container. */
    className?: string;
    /** Rótulo acessível para leitores de tela. */
    "aria-label"?: string;
}

/**
 * ActivityFeed — container/lista do feed de atividade.
 *
 * Visual: card único com borda neutra fina, cantos discretos e
 * `divide-y` entre filhos. Suporta crescer sem virar um "muro de
 * cards", já que cada item é apenas uma linha densa.
 */
export function ActivityFeed({
    children,
    className,
    "aria-label": ariaLabel,
}: ActivityFeedProps): React.ReactElement {
    const composed = [
        "overflow-hidden rounded-lg bg-neutral-50 divide-y divide-neutral-200/70",
        className ?? "",
    ]
        .filter(Boolean)
        .join(" ");

    return (
        <div role="list" aria-label={ariaLabel} className={composed}>
            {children}
        </div>
    );
}
