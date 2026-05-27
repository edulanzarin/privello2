"use client";

import * as React from "react";

import { CameraIcon } from "../icons";

/**
 * Tamanhos canônicos do {@link Avatar}.
 *
 * - `"sm"` (32px) — listas densas, comentários.
 * - `"md"` (48px) — cabeçalho de itens em listagem.
 * - `"lg"` (72px) — cabeçalho de página em painéis.
 * - `"xl"` (96px) — destaque principal de perfil.
 */
export type AvatarSize = "sm" | "md" | "lg" | "xl";

/**
 * Props do {@link Avatar}.
 *
 * Renderiza uma foto circular com fallback automático para iniciais
 * quando `src` está ausente ou falha em carregar. Quando `onClick` é
 * passado, o avatar vira um botão clicável com overlay sutil no
 * hover (ícone de câmera + opacidade) — usado para editar a foto
 * do próprio usuário.
 *
 * Quando `cornerBadge` é passado, exibe um pequeno selo circular no
 * canto inferior direito (estilo "verificado"). Útil para sinalizar
 * tiers/status de forma sutil sem ocupar espaço próximo ao nome.
 *
 * Nenhuma prop carrega nomes de entidades de domínio (Property 29).
 */
export interface AvatarProps {
    /** URL da imagem. Quando `null` ou `undefined`, exibe iniciais. */
    src?: string | null;
    /**
     * Texto base usado para gerar iniciais e como `alt` da imagem.
     * Tipicamente o nome do usuário. Quando vazio, mostra silhueta.
     */
    name?: string | null;
    /** Tamanho do avatar. Padrão: `"md"`. */
    size?: AvatarSize;
    /**
     * Quando passado, o avatar vira um `<button>` interativo com
     * overlay de "editar" no hover (ícone de câmera). O callback é
     * disparado ao clicar.
     */
    onClick?: () => void;
    /**
     * Selo opcional renderizado no canto inferior direito em forma
     * de círculo tonal. Ideal para indicadores de tier/status (ex.:
     * coração para plano Premium, diamante para tier Fan).
     */
    cornerBadge?: React.ReactNode;
    /**
     * Tom do {@link cornerBadge}. Padrão: `"primary"`. Use `"info"`
     * para selos informativos (verificado), etc.
     */
    cornerBadgeTone?: "primary" | "info" | "neutral";
    /**
     * Quando passado, adiciona um anel ao redor do avatar indicando
     * a presença de Story.
     *
     * - `"unseen"`: anel colorido (gradiente primary→secondary) —
     *   há Story que o viewer ainda não viu.
     * - `"seen"`: anel cinza neutro — todos os Stories ativos já
     *   foram vistos.
     * - `"none"` ou ausente: sem anel.
     *
     * Acompanhantes que não têm Story ativo não recebem anel.
     */
    storyRing?: "unseen" | "seen" | "none";
    /**
     * Rótulo acessível usado quando `onClick` está presente.
     * Default: `"Trocar foto"`.
     */
    "aria-label"?: string;
    /** Classes extras aplicadas ao container. */
    className?: string;
}

const SIZE_CLASSES: Record<AvatarSize, { box: string; text: string; icon: number }> = {
    sm: { box: "h-8 w-8", text: "text-xs", icon: 14 },
    md: { box: "h-12 w-12", text: "text-sm", icon: 18 },
    lg: { box: "h-[4.5rem] w-[4.5rem]", text: "text-lg", icon: 24 },
    xl: { box: "h-24 w-24", text: "text-2xl", icon: 32 },
};

const CORNER_BADGE_TONE_CLASSES: Record<
    NonNullable<AvatarProps["cornerBadgeTone"]>,
    string
> = {
    primary: "bg-primary-600 text-white",
    info: "bg-info-600 text-white",
    neutral: "bg-neutral-700 text-white",
};

const CORNER_BADGE_SIZE_CLASSES: Record<AvatarSize, string> = {
    sm: "h-3.5 w-3.5",
    md: "h-5 w-5",
    lg: "h-6 w-6",
    xl: "h-7 w-7",
};

/**
 * Avatar circular com fallback automático.
 *
 * - Quando `src` é uma URL válida e a imagem carrega, mostra a imagem.
 * - Quando `src` está ausente ou falha em carregar, mostra as duas
 *   primeiras iniciais do `name` em letras maiúsculas sobre fundo
 *   tonal.
 * - Quando não há nem imagem nem `name`, mostra um ícone de silhueta.
 * - Quando `cornerBadge` é passado, adiciona um selo circular tonal
 *   no canto inferior direito que "fura" para fora do disco.
 */
export function Avatar({
    src,
    name,
    size = "md",
    onClick,
    cornerBadge,
    cornerBadgeTone = "primary",
    storyRing = "none",
    "aria-label": ariaLabel,
    className,
}: AvatarProps): React.ReactElement {
    const dims = SIZE_CLASSES[size];
    const [errored, setErrored] = React.useState(false);
    const showImage = Boolean(src) && !errored;
    const initials = computeInitials(name);

    // Wrapper externo: relative para ancorar o cornerBadge fora do
    // disco. Quando há ring de Story, aplicamos `border` colorida +
    // `padding` no wrapper externo (forma um "anel" com gap entre
    // borda e disco — visual estilo Instagram). Cores:
    //
    //   - `unseen`: border salmão sólido (primary-500).
    //   - `seen`: border cinza neutro.
    //
    // Por que `border` e não `ring`: ring usa box-shadow que pode
    // ser cortado por `overflow-hidden` em ancestrais e às vezes
    // não pinta consistente com `ring-offset` arbitrário. Border
    // sempre renderiza.
    const hasRing = storyRing === "unseen" || storyRing === "seen";
    const ringClasses = hasRing
        ? storyRing === "unseen"
            ? "rounded-full border-2 border-primary-500 p-[3px]"
            : "rounded-full border-2 border-neutral-300 p-[3px]"
        : "";

    const outerComposed = [
        "relative inline-flex flex-none",
        dims.box,
        ringClasses,
        className ?? "",
    ]
        .filter(Boolean)
        .join(" ");

    // Disco: o ring sutil cinza só aparece quando NÃO há story ring
    // (pra não acumular dois anéis). Em story mode o gap entre disco
    // e border externa fica pelo padding.
    const discComposed = [
        "group relative inline-flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-primary-100 text-primary-700",
        hasRing ? "" : "ring-1 ring-neutral-200",
        onClick !== undefined
            ? "cursor-pointer transition-transform hover:scale-[1.02] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
            : "",
    ]
        .filter(Boolean)
        .join(" ");

    const discInner = (
        <>
            {showImage ? (
                <img
                    src={src as string}
                    alt={name ?? ""}
                    className="h-full w-full object-cover"
                    onError={() => setErrored(true)}
                />
            ) : initials ? (
                <span className={`font-semibold tracking-tight ${dims.text}`}>
                    {initials}
                </span>
            ) : (
                <Silhouette size={dims.icon} />
            )}

            {/* Overlay de "editar" — só aparece quando interativo. */}
            {onClick !== undefined ? (
                <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/45 text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
                >
                    <CameraIcon size={dims.icon} />
                </span>
            ) : null}
        </>
    );

    const disc =
        onClick !== undefined ? (
            <button
                type="button"
                onClick={onClick}
                aria-label={ariaLabel ?? "Trocar foto"}
                className={discComposed}
            >
                {discInner}
            </button>
        ) : (
            <span
                className={discComposed}
                aria-hidden={name == null && !src ? "true" : undefined}
            >
                {discInner}
            </span>
        );

    return (
        <span className={outerComposed}>
            {disc}
            {cornerBadge != null ? (
                <span
                    aria-hidden="true"
                    className={[
                        "absolute -bottom-0.5 -right-0.5 inline-flex items-center justify-center rounded-full ring-2 ring-surface shadow-sm",
                        CORNER_BADGE_SIZE_CLASSES[size],
                        CORNER_BADGE_TONE_CLASSES[cornerBadgeTone],
                    ].join(" ")}
                >
                    {cornerBadge}
                </span>
            ) : null}
        </span>
    );
}

/**
 * Extrai até duas letras das primeiras palavras do nome para usar como
 * fallback. Retorna `null` para entradas vazias/whitespace.
 */
function computeInitials(name: string | null | undefined): string | null {
    if (!name) return null;
    const words = name.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return null;
    const first = words[0]?.[0] ?? "";
    const last = words.length > 1 ? words[words.length - 1]?.[0] ?? "" : "";
    const initials = `${first}${last}`.toUpperCase();
    return initials.length > 0 ? initials : null;
}

function Silhouette({ size }: { size: number }): React.ReactElement {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21c0-4 4-7 8-7s8 3 8 7" />
        </svg>
    );
}
