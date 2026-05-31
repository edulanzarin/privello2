"use client";

import * as React from "react";

import { useToast } from "@/components";

/**
 * Tratamento client-side de respostas 429 (W7).
 *
 * Vários endpoints de criação (favoritar, avaliar, perguntar,
 * denunciar) retornam `429 { reason: "RATE_LIMITED", retryAfterSec }`
 * quando o usuário dispara rápido demais. Antes, alguns fluxos
 * engoliam isso silenciosamente. Este hook centraliza o feedback:
 * mostra um toast amigável com o tempo de espera.
 */

/**
 * Formata os segundos de `Retry-After` numa frase curta em pt-BR.
 */
function formatarEspera(segundos: number | undefined): string {
    if (!segundos || segundos <= 0) return "um momento";
    if (segundos < 60) return `${segundos}s`;
    const min = Math.ceil(segundos / 60);
    return min === 1 ? "1 minuto" : `${min} minutos`;
}

export interface RateLimitToast {
    /**
     * Inspeciona uma `Response`. Se for 429, mostra o toast e
     * devolve `true` (o caller deve abortar o fluxo). Senão, `false`.
     * Lê `retryAfterSec` do corpo JSON quando disponível.
     */
    handle: (res: Response) => Promise<boolean>;
}

/**
 * Hook que devolve {@link RateLimitToast.handle}. Use logo após um
 * `fetch` de criação:
 *
 * ```ts
 * const res = await fetch(...);
 * if (await rateLimit.handle(res)) return; // 429 já avisado
 * ```
 */
export function useRateLimitToast(): RateLimitToast {
    const toast = useToast();

    const handle = React.useCallback(
        async (res: Response): Promise<boolean> => {
            if (res.status !== 429) return false;
            let retryAfterSec: number | undefined;
            try {
                const data = (await res.clone().json()) as {
                    retryAfterSec?: number;
                };
                retryAfterSec = data?.retryAfterSec;
            } catch {
                // sem corpo JSON — usa header.
                const header = res.headers.get("retry-after");
                if (header) {
                    const n = Number.parseInt(header, 10);
                    if (Number.isFinite(n)) retryAfterSec = n;
                }
            }
            toast.info(
                `Você fez isso rápido demais. Tente de novo em ${formatarEspera(
                    retryAfterSec,
                )}.`,
            );
            return true;
        },
        [toast],
    );

    return { handle };
}
