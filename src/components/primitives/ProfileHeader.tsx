import * as React from "react";

import { Avatar, type AvatarSize } from "./Avatar";

/**
 * Props do {@link ProfileHeader}.
 *
 * Cabeçalho identitário de perfil. Combina {@link Avatar} grande com
 * nome em destaque, identificador secundário e dois slots opcionais
 * (`badge` ao lado do nome e `actions` à direita) para informações
 * contextuais como plano vigente ou botões de ação rápida.
 *
 * Quando `onPhotoClick` é passado, o avatar vira clicável com
 * overlay sutil de "trocar foto" no hover. Use para abrir um
 * modal de upload de Foto_de_Perfil.
 *
 * Nenhuma prop carrega nomes de entidades de domínio (Property 29).
 */
export interface ProfileHeaderProps {
    /** URL da foto de perfil. `null` cai no fallback do Avatar. */
    photoUrl?: string | null;
    /** Nome em destaque. */
    name: string;
    /**
     * Identificador secundário exibido em texto menor abaixo do nome
     * (ex.: `"@usuario"`). Opcional.
     */
    identifier?: React.ReactNode;
    /**
     * Slot opcional ao lado do nome, tipicamente uma pílula de status
     * (ex.: badge "Premium", "Pendente").
     */
    badge?: React.ReactNode;
    /**
     * Selo opcional renderizado no canto inferior direito do avatar
     * (estilo "verificado"). Use para indicar tier/status sem ocupar
     * espaço próximo ao nome. Repassado para
     * {@link import("./Avatar").Avatar}.
     */
    avatarCornerBadge?: React.ReactNode;
    /** Tom do {@link avatarCornerBadge}. Padrão: `"primary"`. */
    avatarCornerBadgeTone?: "primary" | "info" | "neutral";
    /**
     * Slot opcional alinhado à direita, tipicamente um ou mais
     * `Button`/links de ação rápida (ex.: "Ver como cliente").
     */
    actions?: React.ReactNode;
    /**
     * Slot opcional renderizado dentro do bloco textual, abaixo do
     * identifier. Pensado para ações pequenas que pertencem ao
     * "cartão de identidade" (ex.: "Alterar foto", "Editar bio").
     * Em mobile fica empilhado naturalmente sem disputar espaço com
     * `actions`.
     */
    extras?: React.ReactNode;
    /**
     * Quando definido, o avatar vira clicável e este callback é
     * chamado ao clicar. Usado para abrir o fluxo de troca de
     * Foto_de_Perfil.
     */
    onPhotoClick?: () => void;
    /**
     * Estado do anel de Story ao redor do avatar. Quando `"unseen"`
     * ou `"seen"`, o avatar recebe o ring colorido/cinza. Quando
     * `"none"` (padrão) ou ausente, sem anel.
     */
    storyRing?: "unseen" | "seen" | "none";
    /**
     * Callback do avatar quando há Story (`storyRing !== "none"`).
     * Tem precedência sobre `onPhotoClick` — quando ambos forem
     * passados, este abre o viewer e o `onPhotoClick` é ignorado.
     */
    onStoryClick?: () => void;
    /** Tamanho do {@link Avatar}. Padrão: `"lg"`. */
    avatarSize?: AvatarSize;
    /** Classes extras aplicadas ao container. */
    className?: string;
}

/**
 * ProfileHeader — bloco identitário reusável.
 *
 * Layout responsivo: empilha verticalmente em telas estreitas (avatar
 * em cima do bloco textual, ações em uma linha separada) e fica em
 * linha única em telas médias e maiores.
 */
export function ProfileHeader({
    photoUrl,
    name,
    identifier,
    badge,
    avatarCornerBadge,
    avatarCornerBadgeTone,
    actions,
    extras,
    onPhotoClick,
    storyRing = "none",
    onStoryClick,
    avatarSize = "lg",
    className,
}: ProfileHeaderProps): React.ReactElement {
    const composed = [
        // Sempre em linha — avatar + bloco textual à esquerda,
        // `actions` à direita. O bloco textual encolhe (`min-w-0`)
        // para que o avatar e as ações nunca sejam empurrados em
        // mobile.
        "flex items-start justify-between gap-3",
        className ?? "",
    ]
        .filter(Boolean)
        .join(" ");

    const hasStoryRing = storyRing === "unseen" || storyRing === "seen";

    // Quando há ring de Story e `onStoryClick`, o avatar não usa o
    // overlay de "trocar foto" do Avatar interativo — em vez disso
    // envolvemos num botão externo que abre o viewer. `onPhotoClick`
    // só é honrado quando NÃO há ring (ou quando o caller não
    // passou onStoryClick).
    const avatarRender =
        hasStoryRing && onStoryClick !== undefined ? (
            <button
                type="button"
                onClick={onStoryClick}
                aria-label="Ver Stories"
                className="inline-flex shrink-0 rounded-full transition-transform hover:scale-[1.03] active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/40"
            >
                <Avatar
                    src={photoUrl}
                    name={name}
                    size={avatarSize}
                    storyRing={storyRing}
                    cornerBadge={avatarCornerBadge}
                    cornerBadgeTone={avatarCornerBadgeTone}
                />
            </button>
        ) : (
            <Avatar
                src={photoUrl}
                name={name}
                size={avatarSize}
                onClick={onPhotoClick}
                aria-label="Trocar foto de perfil"
                cornerBadge={avatarCornerBadge}
                cornerBadgeTone={avatarCornerBadgeTone}
                storyRing={storyRing}
            />
        );

    return (
        <div className={composed}>
            <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
                {avatarRender}
                <div className="flex min-w-0 flex-col gap-0.5">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="truncate text-lg font-semibold tracking-tight text-text-primary sm:text-xl">
                            {name}
                        </span>
                        {badge != null ? badge : null}
                    </div>
                    {identifier != null ? (
                        <span className="truncate text-sm text-text-secondary">
                            {identifier}
                        </span>
                    ) : null}
                    {extras != null ? (
                        <div className="mt-1.5 flex flex-wrap items-center gap-2">
                            {extras}
                        </div>
                    ) : null}
                </div>
            </div>
            {actions != null ? (
                <div className="flex flex-none items-center gap-2">
                    {actions}
                </div>
            ) : null}
        </div>
    );
}
