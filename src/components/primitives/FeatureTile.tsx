import * as React from "react";

/**
 * Tom visual do {@link FeatureTile}.
 *
 * - `"accent"` (padrão): hero círculo warm `accent-soft` com
 *   ícone em `accent-deep`. Pra destacar features do produto
 *   (segurança, verificação, mídia 360°…).
 * - `"neutral"`: hero círculo neutro `neutral-100`. Para tiles
 *   informativos secundários.
 */
export type FeatureTileTone = "accent" | "neutral";

/**
 * Props do {@link FeatureTile}.
 *
 * Card vertical com hero circular grande, título e subtítulo.
 * Usado em landing pages, hero da home e seções de "por que usar
 * Privello". Inspirado no estilo dos tiles "Mídia 360°", "100%
 * dos perfis com documentos", "Verificação facial" do mercado.
 *
 * Visual: borda hairline sutil, fundo branco surface, padding
 * generoso. Sem hover (informativo, não clicável). Quando
 * `href` é passado, vira link com lift suave.
 *
 * Nenhuma prop carrega nomes de entidades de domínio (Property 29).
 */
export interface FeatureTileProps {
    /** Ícone exibido no hero circular. */
    icon: React.ReactNode;
    /** Título principal — duas linhas no máximo (em mobile). */
    title: React.ReactNode;
    /** Subtítulo opcional — uma linha. */
    subtitle?: React.ReactNode;
    /** Tom visual. Padrão: `"accent"`. */
    tone?: FeatureTileTone;
    /** Quando definido, transforma em `<a>` clicável. */
    href?: string;
    /** Classes extras aplicadas ao container. */
    className?: string;
}

const TONE_CIRCLE: Record<FeatureTileTone, string> = {
    accent:
        "bg-accent-soft text-accent-deep ring-4 ring-accent/15",
    neutral:
        "bg-neutral-100 text-text-primary ring-4 ring-neutral-200/60",
};

/**
 * FeatureTile — card de destaque informativo.
 *
 * Visual:
 *   - Container surface arredondado (rounded-3xl) com hairline
 *     muito fino.
 *   - Hero circular 48x48px com `ring` warm pra criar halo
 *     suave (efeito "selo").
 *   - Título centralizado em peso medium.
 *   - Subtítulo opcional em texto secundário.
 *   - Hover sutil (`lift`) quando clicável.
 */
export function FeatureTile({
    icon,
    title,
    subtitle,
    tone = "accent",
    href,
    className,
}: FeatureTileProps): React.ReactElement {
    const inner = (
        <>
            <span
                aria-hidden="true"
                className={`flex h-12 w-12 flex-none items-center justify-center rounded-full ${TONE_CIRCLE[tone]}`}
            >
                {icon}
            </span>
            <div className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold leading-tight tracking-tight text-text-primary">
                    {title}
                </span>
                {subtitle != null ? (
                    <span className="text-xs leading-relaxed text-text-secondary">
                        {subtitle}
                    </span>
                ) : null}
            </div>
        </>
    );

    const composed = [
        "flex flex-col items-center gap-3 rounded-3xl border border-border bg-surface px-4 py-6 text-center",
        href ? "lift focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40" : "",
        className ?? "",
    ]
        .filter(Boolean)
        .join(" ");

    if (href !== undefined) {
        return (
            <a href={href} className={composed}>
                {inner}
            </a>
        );
    }
    return <div className={composed}>{inner}</div>;
}
