import * as React from "react";

import { Badge, type BadgeTone } from "./Badge";

/**
 * Tom semântico do {@link RankBadge}.
 *
 * Mapeia uma "posição" no ranking visual sem carregar nomes de
 * entidades de domínio. O consumidor decide o que cada tom
 * representa (boost, premium, padrão) e provê o ícone+label
 * correspondente.
 *
 * - `"hero"`: o destaque máximo — gradiente forte, sombra. Use
 *   pra itens pagos por destaque temporário.
 * - `"feature"`: destaque moderado — pill primário com ícone. Use
 *   pra tier pago de longo prazo.
 * - `"standard"`: baseline — pill neutro. Use pra tier base ou
 *   itens sem destaque.
 */
export type RankBadgeTone = "hero" | "feature" | "standard";

/**
 * Props do {@link RankBadge}.
 *
 * Selo discriminado em três tons que reflete posição/prioridade
 * sem expor o vocabulário de domínio. Wrap fino sobre o
 * {@link Badge} centralizando o mapeamento `tone → tom visual`.
 *
 * Nenhuma prop carrega nomes de entidades de domínio (Property 29).
 */
export interface RankBadgeProps {
    /** Tom semântico. Padrão: `"standard"`. */
    tone?: RankBadgeTone;
    /** Ícone exibido à esquerda do label. */
    icon?: React.ReactNode;
    /** Conteúdo (label) do badge. */
    children: React.ReactNode;
    /** Classes extras aplicadas ao Badge. */
    className?: string;
}

const TONE_TO_BADGE: Record<RankBadgeTone, BadgeTone> = {
    hero: "primaryGradient",
    feature: "primary",
    standard: "neutral",
};

/**
 * RankBadge — wrapper de {@link Badge} com 3 tons semânticos.
 *
 * Usado em listagens (home, busca, perfil público) para indicar
 * posição/destaque do item. Centraliza o mapeamento
 * `RankBadgeTone → BadgeTone` para que toda nova listagem nasça
 * com a mesma linguagem visual.
 */
export function RankBadge({
    tone = "standard",
    icon,
    children,
    className,
}: RankBadgeProps): React.ReactElement {
    return (
        <Badge tone={TONE_TO_BADGE[tone]} icon={icon} className={className}>
            {children}
        </Badge>
    );
}
