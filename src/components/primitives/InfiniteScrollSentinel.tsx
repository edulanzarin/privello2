"use client";

import * as React from "react";

/**
 * Props do {@link InfiniteScrollSentinel}.
 *
 * Sentinela invisível usada para acionar carregamento de mais
 * itens quando o usuário rola até o fim de uma listagem. Implementa
 * scroll infinito via `IntersectionObserver` — sem listeners de
 * `scroll` (que custam mais CPU).
 *
 * O caller controla o estado de carregamento via `loading` e
 * `hasMore`. Quando ambos são `false`/`true` apropriado e a
 * sentinela entra na viewport, dispara `onLoadMore` uma vez.
 *
 * Para evitar disparos duplicados (ex.: durante o carregamento
 * de uma página), o callback só é chamado quando `loading` é
 * `false`. Quando o usuário desativa JS (SSR), nada acontece —
 * o caller deve oferecer fallback (botão manual).
 *
 * Sem domínio nas props (Property 29).
 */
export interface InfiniteScrollSentinelProps {
    /** Há mais itens pra carregar? Quando `false`, sentinela some. */
    hasMore: boolean;
    /** Está carregando agora? Bloqueia disparos duplicados. */
    loading: boolean;
    /** Callback ao entrar na viewport. */
    onLoadMore: () => void;
    /**
     * Distância em pixels antes da sentinela ficar visível pra
     * já disparar o carregamento. Padrão: 600 (~ uma tela mobile).
     */
    rootMargin?: number;
    /** Mensagem opcional exibida durante carregamento. */
    loadingLabel?: React.ReactNode;
}

/**
 * InfiniteScrollSentinel — sentinela de scroll infinito.
 *
 * Renderiza um elemento invisível (placeholder de altura zero)
 * que dispara `onLoadMore` quando entra na viewport via
 * `IntersectionObserver`. Inclui um spinner simples enquanto
 * `loading` é `true`.
 */
export function InfiniteScrollSentinel({
    hasMore,
    loading,
    onLoadMore,
    rootMargin = 600,
    loadingLabel = "Carregando…",
}: InfiniteScrollSentinelProps): React.ReactElement | null {
    const ref = React.useRef<HTMLDivElement>(null);
    // Mantém a callback estável dentro do effect (sem reassinar
    // observer a cada render por causa de identidade nova).
    const onLoadMoreRef = React.useRef(onLoadMore);
    React.useEffect(() => {
        onLoadMoreRef.current = onLoadMore;
    }, [onLoadMore]);

    React.useEffect(() => {
        if (!hasMore || loading) return;
        const node = ref.current;
        if (!node) return;

        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting) {
                        onLoadMoreRef.current();
                    }
                }
            },
            { rootMargin: `${rootMargin}px 0px` },
        );
        observer.observe(node);
        return () => observer.disconnect();
    }, [hasMore, loading, rootMargin]);

    if (!hasMore && !loading) return null;

    return (
        <div
            ref={ref}
            aria-live="polite"
            className="flex items-center justify-center py-6"
        >
            {loading ? (
                <span className="inline-flex items-center gap-2 text-xs text-text-secondary">
                    <span
                        aria-hidden="true"
                        className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-accent/30 border-t-accent"
                    />
                    {loadingLabel}
                </span>
            ) : (
                <span aria-hidden="true" className="block h-1 w-1" />
            )}
        </div>
    );
}
