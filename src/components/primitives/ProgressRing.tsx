import * as React from "react";

/**
 * Tamanhos do {@link ProgressRing}. Cada tamanho define `size` em px
 * e a espessura do traço. Mantemos lookup fixo pra que o SVG saia
 * crisp em qualquer multiple-of-2 sem ajustes manuais.
 */
export type ProgressRingSize = "sm" | "md" | "lg";

/**
 * Props do {@link ProgressRing}.
 *
 * Anel circular SVG mostrando progresso 0-100. Visual: um trilho
 * cinza claro completo + um arco warm que cobre `value%` da
 * circunferência. Texto centralizado mostra o número (sem `%`,
 * caller passa o sufixo se quiser).
 *
 * Animação opcional: ao montar, anima do 0 até o `value`. Sem
 * animação por padrão pra não competir com loading skeletons.
 *
 * Nenhuma prop carrega nomes de entidades de domínio (Property 29).
 */
export interface ProgressRingProps {
    /** Valor entre 0 e 100. Clampado se passar dos limites. */
    value: number;
    /** Tamanho. Padrão: `"md"`. */
    size?: ProgressRingSize;
    /**
     * Conteúdo no centro do anel. Quando ausente, mostra o número
     * grande em fonte semibold. Quando passado (ex.: ícone de
     * troféu pra perfil 100%), substitui o texto.
     */
    children?: React.ReactNode;
    /**
     * Quando `true`, anima o arco do 0 até `value` ao montar.
     * Padrão: `true`.
     */
    animate?: boolean;
    /**
     * Rótulo acessível. Sem ele, o componente é decorativo (`aria-hidden`).
     * Tipicamente "Perfil X% completo" — mas o caller decide o
     * texto pra evitar domain leak.
     */
    "aria-label"?: string;
    /** Classes extras. */
    className?: string;
}

const SIZE_DIMS: Record<ProgressRingSize, { size: number; stroke: number; fontSize: string }> =
{
    sm: { size: 48, stroke: 4, fontSize: "text-xs" },
    md: { size: 72, stroke: 6, fontSize: "text-sm" },
    lg: { size: 96, stroke: 7, fontSize: "text-base" },
};

/**
 * ProgressRing — indicador circular de progresso 0-100.
 *
 * Visual: trilho cinza claro + arco warm (`var(--accent)`). Quando
 * `value === 100`, troca o tom do arco pra verde-azulado discreto
 * (success-ish) — sinaliza visualmente "completo".
 */
export function ProgressRing({
    value,
    size = "md",
    children,
    animate = true,
    "aria-label": ariaLabel,
    className,
}: ProgressRingProps): React.ReactElement {
    const dims = SIZE_DIMS[size];
    const clamped = Math.max(0, Math.min(100, Math.round(value)));
    const radius = (dims.size - dims.stroke) / 2;
    const circumference = 2 * Math.PI * radius;
    const center = dims.size / 2;

    // Estado de animação. Inicia em 0 e em uma microtask vai pra
    // `clamped` — o `transition-* ` no stroke faz a curva se mover
    // suave. Quando `animate=false`, vai direto pro valor final.
    const [shown, setShown] = React.useState(animate ? 0 : clamped);
    React.useEffect(() => {
        if (!animate) {
            setShown(clamped);
            return;
        }
        const id = window.requestAnimationFrame(() => setShown(clamped));
        return () => window.cancelAnimationFrame(id);
    }, [clamped, animate]);

    const offset = circumference - (shown / 100) * circumference;
    const isComplete = clamped === 100;
    const arcColor = isComplete
        ? "rgb(16, 185, 129)" // emerald-500 — confere "feito"
        : "var(--accent)";

    return (
        <div
            className={["relative inline-flex flex-none", className ?? ""]
                .filter(Boolean)
                .join(" ")}
            style={{ width: dims.size, height: dims.size }}
            role={ariaLabel ? "img" : undefined}
            aria-label={ariaLabel}
            aria-hidden={ariaLabel ? undefined : true}
        >
            <svg
                width={dims.size}
                height={dims.size}
                viewBox={`0 0 ${dims.size} ${dims.size}`}
                className="-rotate-90"
            >
                {/* Trilho de fundo — cinza claro hairline. */}
                <circle
                    cx={center}
                    cy={center}
                    r={radius}
                    fill="none"
                    stroke="rgb(229, 231, 235)" // border / neutral-200
                    strokeWidth={dims.stroke}
                />
                {/* Arco do progresso. */}
                <circle
                    cx={center}
                    cy={center}
                    r={radius}
                    fill="none"
                    stroke={arcColor}
                    strokeWidth={dims.stroke}
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    style={{
                        transition: animate
                            ? "stroke-dashoffset 600ms cubic-bezier(0.22, 1, 0.36, 1), stroke 200ms"
                            : undefined,
                    }}
                />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
                {children !== undefined ? (
                    children
                ) : (
                    <span
                        className={[
                            "font-semibold tabular-nums tracking-tight text-text-primary",
                            dims.fontSize,
                        ].join(" ")}
                    >
                        {clamped}
                    </span>
                )}
            </div>
        </div>
    );
}
