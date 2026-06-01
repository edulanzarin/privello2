"use client";

import * as React from "react";
import Link from "next/link";

import {
    Avatar,
    LinkButton,
    SectionHeader,
    VerifiedBadgeIcon,
} from "@/components";

import { useVistosRecentemente } from "@/lib/recentlyViewed";

/**
 * Rail "Vistos recentemente" do painel do Cliente (W1).
 *
 * Lê o histórico local (localStorage) dos últimos perfis abertos e
 * mostra um carrossel horizontal de avatares clicáveis. Como o
 * histórico é client-only, o componente renderiza `null` no SSR e
 * quando não há nada — não ocupa espaço pra quem nunca abriu perfil.
 *
 * Privacidade: nada disso vai pro servidor; é conveniência local.
 */
export function VistosRecentementeRail(): React.ReactElement | null {
    const { vistos, limpar } = useVistosRecentemente();

    if (vistos.length === 0) return null;

    return (
        <section className="flex flex-col gap-3">
            <SectionHeader
                title="Vistos recentemente"
                subtitle="Os últimos perfis que você abriu."
                trailing={
                    <LinkButton onClick={limpar} tone="danger">
                        Limpar
                    </LinkButton>
                }
            />
            <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 scrollbar-none">
                {vistos.map((p) => (
                    <Link
                        key={p.identificador}
                        href={`/acompanhantes/${p.identificador}`}
                        className="flex w-20 flex-none flex-col items-center gap-1.5 rounded-2xl p-1 text-center transition-colors hover:bg-accent-soft/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                    >
                        <span className="relative">
                            <Avatar
                                src={p.fotoUrl}
                                name={p.nome}
                                size="lg"
                            />
                            {p.verificada ? (
                                <span
                                    aria-hidden="true"
                                    className="absolute -bottom-0.5 -right-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-white text-accent-deep ring-2 ring-white"
                                >
                                    <VerifiedBadgeIcon size={14} />
                                </span>
                            ) : null}
                        </span>
                        <span className="line-clamp-1 w-full text-xs font-medium text-text-primary">
                            {p.nome}
                        </span>
                        <span className="line-clamp-1 w-full text-[0.65rem] text-text-secondary">
                            {p.cidadeNome}
                        </span>
                    </Link>
                ))}
            </div>
        </section>
    );
}
