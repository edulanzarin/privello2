"use client";

import * as React from "react";
import Link from "next/link";

import {
    Card,
    CheckIcon,
    ProgressRing,
    SparklesIcon,
} from "@/components";
import type { CompletudeResultado } from "@/server/acompanhante-profile/completude";

/**
 * Card "complete seu perfil" mostrado no topo do painel privado da
 * Acompanhante quando o percentual é menor que 100. Some quando o
 * perfil chega a 100% — o badge "Perfil 100%" passa a aparecer ao
 * lado do nome (separado, mais discreto).
 *
 * Visual: linha topo com {@link ProgressRing} grande à esquerda,
 * texto "Perfil X% completo" e contagem; lista compacta de itens
 * faltantes (com link clicável) abaixo. Itens já cumpridos vivem
 * lá embaixo num expander discreto pra não competir.
 */
export interface CompletudeCardProps {
    completude: CompletudeResultado;
}

export function CompletudeCard({
    completude,
}: CompletudeCardProps): React.ReactElement | null {
    if (completude.percentual >= 100) return null;

    const faltantes = completude.itens.filter((i) => !i.completo);
    const cumpridos = completude.itens.filter((i) => i.completo);

    return (
        <Card>
            <div className="flex flex-col gap-4">
                <div className="flex items-center gap-4">
                    <ProgressRing
                        value={completude.percentual}
                        size="lg"
                        aria-label={`Perfil ${completude.percentual} por cento completo`}
                    />
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="text-base font-semibold tracking-tight text-text-primary">
                            Complete seu perfil
                        </span>
                        <span className="text-xs text-text-secondary">
                            {completude.completos} de {completude.total} itens
                            cumpridos. Perfis completos atraem mais Cliente.
                        </span>
                    </div>
                </div>

                {faltantes.length > 0 ? (
                    <ul
                        aria-label="Itens faltantes"
                        className="flex flex-col gap-1.5 border-t border-border pt-3"
                    >
                        {faltantes.map((item) => (
                            <li key={item.key}>
                                <Link
                                    href={item.href}
                                    className="group flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-text-primary transition-colors hover:bg-accent-soft/60 focus:outline-none focus-visible:bg-accent-soft focus-visible:ring-2 focus-visible:ring-accent/40"
                                >
                                    <span
                                        aria-hidden="true"
                                        className="inline-flex h-5 w-5 flex-none items-center justify-center rounded-full border border-dashed border-border text-text-disabled"
                                    >
                                        <SparklesIcon size={11} />
                                    </span>
                                    <span className="flex-1">{item.label}</span>
                                    <span
                                        aria-hidden="true"
                                        className="text-xs text-text-secondary group-hover:text-accent-deep"
                                    >
                                        →
                                    </span>
                                </Link>
                            </li>
                        ))}
                    </ul>
                ) : null}

                {cumpridos.length > 0 ? (
                    <details className="group">
                        <summary className="cursor-pointer list-none text-xs font-medium text-text-secondary hover:text-text-primary [&::-webkit-details-marker]:hidden">
                            Ver {cumpridos.length} itens já cumpridos ↓
                        </summary>
                        <ul
                            aria-label="Itens cumpridos"
                            className="mt-2 flex flex-col gap-1"
                        >
                            {cumpridos.map((item) => (
                                <li
                                    key={item.key}
                                    className="flex items-center gap-2.5 px-2 py-1 text-xs text-text-secondary"
                                >
                                    <span
                                        aria-hidden="true"
                                        className="inline-flex h-4 w-4 flex-none items-center justify-center rounded-full bg-[rgb(16,185,129)] text-white"
                                    >
                                        <CheckIcon size={10} />
                                    </span>
                                    <span className="line-through opacity-70">
                                        {item.label}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </details>
                ) : null}
            </div>
        </Card>
    );
}
