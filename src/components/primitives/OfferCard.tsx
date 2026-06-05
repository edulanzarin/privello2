import * as React from "react";

import { CheckIcon, HeartIcon } from "../icons";

import { Badge } from "./Badge";
import { Card } from "./Card";

/**
 * Tipo de ícone usado por benefício no {@link OfferCard}.
 */
export type OfferIconComponent = React.ComponentType<{
    size?: number;
    className?: string;
}>;

/**
 * Item da lista de benefícios apresentada pelo {@link OfferCard}.
 */
export interface OfferBenefit {
    /** Texto do benefício. */
    label: string;
    /**
     * Ícone exibido na pílula tonal à esquerda do label. Quando
     * `undefined`, a pílula renderiza o {@link CheckIcon} padrão.
     */
    icon?: OfferIconComponent;
    /**
     * Quando `true`, destaca o item (gradiente + tipografia em
     * medium). Útil para diferenciais exclusivos da oferta.
     */
    highlight?: boolean;
}

/**
 * Props do {@link OfferCard}.
 *
 * Cartão visual para apresentar uma oferta dentro de uma tela de
 * comparação. O componente cuida da estética e delega o
 * formulário/CTA ao consumidor via `children`.
 *
 * Nenhuma prop carrega nomes de entidades de domínio (Property 29).
 */
export interface OfferCardProps {
    /** Título principal da oferta. */
    name: React.ReactNode;
    /** Frase curta sob o nome. */
    description: React.ReactNode;
    /**
     * Preço da oferta (opcional). Quando presente, renderiza um
     * destaque visual com o valor + sufixo (ex.: "/mês", "/24h"),
     * abaixo da descrição. Aceita conteúdo livre pra incluir
     * formatações específicas (R$, badges de desconto, etc.).
     */
    price?: React.ReactNode;
    /**
     * Sufixo do preço (opcional). Renderizado em tom secundário ao
     * lado do `price` (ex.: `/mês`, `por 24h`).
     */
    priceSuffix?: React.ReactNode;
    /** Itens de benefício renderizados em lista vertical com pílulas. */
    benefits: ReadonlyArray<OfferBenefit>;
    /**
     * Quando `true`, marca o card como "recomendado":
     * - Aplica `featured` no {@link Card} (anel sutil + sombra glass).
     * - Renderiza o badge gradient padrão "Recomendado" no canto.
     * - Tinge as pílulas dos benefícios de `primary-100` em vez de
     *   `neutral-100`.
     */
    recommended?: boolean;
    /**
     * Conteúdo opcional do badge no canto superior direito. Quando
     * ausente e `recommended === true`, cai no padrão "Recomendado".
     */
    badge?: React.ReactNode;
    /**
     * Atraso da animação de entrada (`fade-in`) em milissegundos.
     */
    animationDelayMs?: number;
    /**
     * Conteúdo livre renderizado no rodapé do card (formulário,
     * botão de CTA, etc.).
     */
    children: React.ReactNode;
}

/**
 * OfferCard — cartão visual de oferta para telas de comparação.
 *
 * Reusa o {@link Card} primitivo na variante `elevated` e o
 * `featured` quando `recommended`. Mantém a apresentação consistente
 * entre todas as telas que comparam ofertas, deixando o slot
 * `children` aberto para a camada de dados/forms.
 */
export function OfferCard({
    name,
    description,
    price,
    priceSuffix,
    benefits,
    recommended = false,
    badge,
    animationDelayMs = 0,
    children,
}: OfferCardProps): React.ReactElement {
    const renderedBadge =
        badge ??
        (recommended ? (
            <Badge
                tone="primaryGradient"
                icon={<HeartIcon size={11} />}
                className="absolute right-5 top-5 px-3 py-1"
            >
                Recomendado
            </Badge>
        ) : null);

    return (
        <Card
            variant="elevated"
            featured={recommended}
            style={{ animationDelay: `${animationDelayMs}ms` }}
            className="group relative animate-fade-in opacity-0 [animation-fill-mode:forwards]"
        >
            {renderedBadge}

            <div className="flex h-full flex-col gap-5">
                <div className="space-y-1">
                    <h2 className="text-xl font-semibold tracking-tight text-text-primary">
                        {name}
                    </h2>
                    <p className="text-sm text-text-secondary">{description}</p>
                </div>

                {price !== undefined ? (
                    <div className="flex items-baseline gap-1.5">
                        <span
                            className={`text-3xl font-bold tracking-tight ${
                                recommended
                                    ? "text-accent-deep"
                                    : "text-text-primary"
                            }`}
                        >
                            {price}
                        </span>
                        {priceSuffix !== undefined ? (
                            <span className="text-sm text-text-secondary">
                                {priceSuffix}
                            </span>
                        ) : null}
                    </div>
                ) : null}

                <div className="h-px bg-gradient-to-r from-transparent via-neutral-200 to-transparent" />

                <ul className="flex-1 space-y-3 text-sm text-text-primary">
                    {benefits.map((b) => {
                        const Icon = b.icon ?? CheckIcon;
                        const tone = b.highlight
                            ? "bg-gradient-to-br from-accent to-accent-deep text-white shadow-[0_4px_12px_-4px_rgba(197,82,58,0.45)]"
                            : recommended
                                ? "bg-accent-soft text-accent-deep"
                                : "bg-neutral-100 text-neutral-700";
                        return (
                            <li
                                key={b.label}
                                className={`flex items-start gap-3 ${b.highlight ? "font-medium" : ""}`}
                            >
                                <span
                                    aria-hidden="true"
                                    className={`mt-0.5 inline-flex h-5 w-5 flex-none items-center justify-center rounded-full ${tone}`}
                                >
                                    <Icon size={12} />
                                </span>
                                {b.label}
                            </li>
                        );
                    })}
                </ul>

                {children}
            </div>
        </Card>
    );
}
