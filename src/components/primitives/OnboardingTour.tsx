"use client";

import * as React from "react";

import { XIcon } from "../icons";

/**
 * Item destacado dentro do {@link OnboardingTour} — um benefício/
 * passo, com ícone opcional e texto.
 */
export interface OnboardingTourItem {
    /** Ícone tonal à esquerda do item. Opcional. */
    icon?: React.ReactNode;
    /** Texto do item. */
    text: React.ReactNode;
}

/**
 * Props do {@link OnboardingTour}.
 *
 * Banner de boas-vindas/tour dismissível, persistido por
 * `storageKey` no `localStorage`. Pensado pra explicar um recurso
 * ou benefício no primeiro acesso a uma área. Genérico — não carrega
 * nomes de entidades de domínio (Property 29). Quem dá significado
 * (o que o banner promove) é o consumidor via props.
 */
export interface OnboardingTourProps {
    /**
     * Chave única no `localStorage` pra lembrar que o usuário já
     * fechou. Enquanto não houver a chave, o banner aparece.
     */
    storageKey: string;
    /** Ícone tonal grande no cabeçalho. Opcional. */
    icon?: React.ReactNode;
    /** Título do banner. */
    title: React.ReactNode;
    /** Subtítulo/descrição curta abaixo do título. Opcional. */
    description?: React.ReactNode;
    /** Lista de benefícios/passos destacados. */
    items?: ReadonlyArray<OnboardingTourItem>;
    /** URL de destino do CTA principal. */
    ctaHref: string;
    /** Texto do CTA principal. */
    ctaLabel: React.ReactNode;
    /** Texto do botão de dispensar. Padrão: `"Agora não"`. */
    dismissLabel?: React.ReactNode;
    /** Classes extras aplicadas ao container. */
    className?: string;
}

/**
 * OnboardingTour — card de boas-vindas dismissível.
 *
 * # Persistência
 *
 * Ao montar, lê `localStorage[storageKey]`. Se já estiver marcado
 * (`"1"`), não renderiza. Ao fechar (X ou "Agora não"), grava a
 * marca e some. Clicar no CTA **também** marca como visto — o
 * usuário já agiu, não precisa ver de novo.
 *
 * Renderiza `null` no primeiro paint (antes do efeito de hidratação
 * resolver o estado), evitando flash de conteúdo pra quem já
 * dispensou. Sem dependência de servidor — estado puramente local.
 */
export function OnboardingTour({
    storageKey,
    icon,
    title,
    description,
    items,
    ctaHref,
    ctaLabel,
    dismissLabel = "Agora não",
    className,
}: OnboardingTourProps): React.ReactElement | null {
    // `null` enquanto não sabemos (SSR/primeiro paint). Depois vira
    // boolean — evita flash pra quem já fechou.
    const [visivel, setVisivel] = React.useState<boolean | null>(null);

    React.useEffect(() => {
        try {
            const visto = window.localStorage.getItem(storageKey);
            setVisivel(visto !== "1");
        } catch {
            // localStorage indisponível (modo privado etc): mostra.
            setVisivel(true);
        }
    }, [storageKey]);

    function marcarVisto(): void {
        try {
            window.localStorage.setItem(storageKey, "1");
        } catch {
            // ignora — no pior caso reaparece na próxima sessão.
        }
        setVisivel(false);
    }

    if (visivel !== true) return null;

    const composed = [
        "relative overflow-hidden rounded-3xl border border-accent/25 bg-gradient-to-br from-accent-soft/80 to-surface p-5",
        className ?? "",
    ]
        .filter(Boolean)
        .join(" ");

    return (
        <div className={composed}>
            <button
                type="button"
                onClick={marcarVisto}
                aria-label="Fechar"
                className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-white/60 hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
            >
                <XIcon size={15} />
            </button>

            <div className="flex flex-col gap-3 pr-8">
                <div className="flex items-center gap-3">
                    {icon != null ? (
                        <span
                            aria-hidden="true"
                            className="inline-flex h-11 w-11 flex-none items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-accent-deep text-white shadow-[0_8px_20px_-6px_rgba(197,82,58,0.5)]"
                        >
                            {icon}
                        </span>
                    ) : null}
                    <div className="flex min-w-0 flex-col gap-0.5">
                        <span className="text-base font-semibold tracking-tight text-text-primary">
                            {title}
                        </span>
                        {description != null ? (
                            <span className="text-sm text-text-secondary">
                                {description}
                            </span>
                        ) : null}
                    </div>
                </div>

                {items != null && items.length > 0 ? (
                    <ul className="flex flex-col gap-2 pt-1">
                        {items.map((item, i) => (
                            <li
                                key={i}
                                className="flex items-center gap-2.5 text-sm text-text-primary"
                            >
                                {item.icon != null ? (
                                    <span
                                        aria-hidden="true"
                                        className="inline-flex h-7 w-7 flex-none items-center justify-center rounded-full bg-white/70 text-accent-deep"
                                    >
                                        {item.icon}
                                    </span>
                                ) : null}
                                <span>{item.text}</span>
                            </li>
                        ))}
                    </ul>
                ) : null}

                <div className="flex flex-wrap items-center gap-2 pt-2">
                    <a
                        href={ctaHref}
                        onClick={marcarVisto}
                        className="glass-cta inline-flex flex-none items-center justify-center px-4 py-2 text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                    >
                        {ctaLabel}
                    </a>
                    <button
                        type="button"
                        onClick={marcarVisto}
                        className="inline-flex flex-none items-center justify-center rounded-full px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                    >
                        {dismissLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
