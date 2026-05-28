import * as React from "react";

/**
 * Props do {@link EmptyState}.
 *
 * Bloco padronizado de "estado vazio": ícone tonal, título curto,
 * descrição opcional e slot de ação (CTA, link). Pensado para
 * substituir caixas tracejadas inconsistentes espalhadas por
 * painéis e listagens.
 *
 * Tamanhos:
 * - `"sm"`: usado dentro de listas/abas onde já existe contexto.
 *   Padding reduzido, ícone 32px, texto compacto.
 * - `"md"` (padrão): página inteira ou seção principal. Padding
 *   generoso, ícone 40px, hierarquia tipográfica padrão.
 *
 * Nenhuma prop carrega nomes de entidades de domínio (Property 29).
 */
export interface EmptyStateProps {
    /** Ícone tonal exibido em círculo no topo. Opcional. */
    icon?: React.ReactNode;
    /** Título principal. */
    title: React.ReactNode;
    /** Descrição auxiliar abaixo do título. Opcional. */
    description?: React.ReactNode;
    /**
     * Slot de ação (botão, link). Renderizado abaixo da descrição.
     * Quando ausente, o estado é apenas informativo.
     */
    action?: React.ReactNode;
    /** Tamanho do bloco. Padrão: `"md"`. */
    size?: "sm" | "md";
    /** Classes extras aplicadas ao container. */
    className?: string;
}

const SIZE_CLASSES: Record<NonNullable<EmptyStateProps["size"]>, string> = {
    sm: "px-4 py-6 gap-2",
    md: "px-6 py-12 gap-3",
};

const ICON_SIZE_CLASSES: Record<NonNullable<EmptyStateProps["size"]>, string> = {
    sm: "h-9 w-9",
    md: "h-12 w-12",
};

const TITLE_SIZE_CLASSES: Record<NonNullable<EmptyStateProps["size"]>, string> =
{
    sm: "text-sm",
    md: "text-base",
};

/**
 * EmptyState — estado vazio padronizado.
 *
 * Visual: container centralizado com ícone tonal em círculo,
 * tipografia compacta e ação opcional. Sem borda tracejada (que
 * costuma destoar do restante da UI); a hierarquia visual vem do
 * próprio espaçamento e tom.
 */
export function EmptyState({
    icon,
    title,
    description,
    action,
    size = "md",
    className,
}: EmptyStateProps): React.ReactElement {
    const composed = [
        "flex flex-col items-center justify-center text-center",
        SIZE_CLASSES[size],
        className ?? "",
    ]
        .filter(Boolean)
        .join(" ");

    return (
        <div className={composed}>
            {icon != null ? (
                <span
                    aria-hidden="true"
                    className={[
                        "inline-flex flex-none items-center justify-center rounded-full bg-[color:var(--accent-soft)] text-[color:var(--accent-deep)] ring-4 ring-[color:var(--accent)]/12",
                        ICON_SIZE_CLASSES[size],
                    ].join(" ")}
                >
                    {icon}
                </span>
            ) : null}
            <span
                className={[
                    "font-semibold tracking-tight text-text-primary",
                    TITLE_SIZE_CLASSES[size],
                ].join(" ")}
            >
                {title}
            </span>
            {description != null ? (
                <span className="max-w-sm text-xs text-text-secondary">
                    {description}
                </span>
            ) : null}
            {action != null ? <div className="mt-1">{action}</div> : null}
        </div>
    );
}
