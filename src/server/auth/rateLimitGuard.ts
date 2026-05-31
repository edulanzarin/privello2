/**
 * Wrapper sobre {@link checkRateLimit} para ser usado direto em
 * route handlers, devolvendo um `NextResponse` 429 quando
 * estourado — formato idêntico ao que `requireSession` etc.
 * devolvem em caso de falha.
 *
 * Mantém o caller enxuto:
 *
 * ```ts
 * const rl = enforceRateLimit("comments", auth.userId, {
 *     max: 10, windowMs: 60_000,
 * });
 * if (rl) return rl;
 * ```
 *
 * Tradeoffs já documentados em `rateLimitMemory.ts`: contagem
 * por instância, sem coordenação distribuída. Aceitável pra
 * defesa contra spam óbvio; alvo coordenado precisa Redis.
 *
 * Quando `clientKey` é `userId` (caller logado), esse limite é
 * "por conta". Quando é IP (caller anônimo), agrupa pessoas
 * atrás do mesmo NAT — granular o suficiente pra MVP.
 */

import { NextResponse } from "next/server";

import {
    checkRateLimit,
    type RateLimitInput,
} from "./rateLimitMemory";

/**
 * Avalia o limite e devolve `null` quando OK ou um `NextResponse`
 * 429 quando estourou. Sempre seta `Retry-After` (segundos
 * arredondados pra cima) pra clients respeitarem.
 *
 * `bucket` deve ser um nome lógico curto e único — apareceu na
 * `Map` global. `clientKey` é o `userId` (logados) ou IP
 * (anônimos via `clientKeyFromRequest`).
 */
export function enforceRateLimit(
    bucket: string,
    clientKey: string,
    input: RateLimitInput,
): NextResponse | null {
    const rl = checkRateLimit(bucket, clientKey, input);
    if (rl.ok) return null;

    const retryAfterSec = Math.max(1, Math.ceil(rl.retryAfterMs / 1000));
    return NextResponse.json(
        { ok: false, reason: "RATE_LIMITED", retryAfterSec },
        {
            status: 429,
            headers: {
                "Retry-After": String(retryAfterSec),
            },
        },
    );
}

/**
 * Conjuntos canônicos de limites pra endpoints comuns. Centralizar
 * aqui evita "engenheiro chuta um número" em cada route handler e
 * permite ajustar em um lugar quando o produto evoluir.
 *
 * Os números abaixo são conservadores — bloqueiam abuso óbvio
 * sem incomodar uso normal.
 */
export const LIMITS = {
    /** Comentários em mídias: 10/min por usuário. */
    comments: { max: 10, windowMs: 60_000 } satisfies RateLimitInput,
    /** Likes (toggle): 60/min — usuário pode dar like rápido. */
    likes: { max: 60, windowMs: 60_000 } satisfies RateLimitInput,
    /** Avaliações: 5/h — review é ato considerado, raro. */
    reviews: { max: 5, windowMs: 60 * 60_000 } satisfies RateLimitInput,
    /** Perguntas: 10/h por Cliente. */
    questions: { max: 10, windowMs: 60 * 60_000 } satisfies RateLimitInput,
    /** Respostas (Acompanhante): 30/min — pode rajar respostas. */
    questionAnswers: { max: 30, windowMs: 60_000 } satisfies RateLimitInput,
    /** Denúncias: 5/h — denúncia em massa é spam. */
    reports: { max: 5, windowMs: 60 * 60_000 } satisfies RateLimitInput,
    /** Verificação: 3/h — só em re-envio após rejeição. */
    verification: { max: 3, windowMs: 60 * 60_000 } satisfies RateLimitInput,
    /** Stories: 20/h — Premium publica vários por dia. */
    stories: { max: 20, windowMs: 60 * 60_000 } satisfies RateLimitInput,
    /** Reels: 10/h. */
    reels: { max: 10, windowMs: 60 * 60_000 } satisfies RateLimitInput,
    /** Mídias da galeria: 30/h — onboarding pode publicar várias. */
    medias: { max: 30, windowMs: 60 * 60_000 } satisfies RateLimitInput,
    /** Favoritos (toggle): 60/min — usuário pode salvar/desmarcar várias. */
    favorites: { max: 60, windowMs: 60_000 } satisfies RateLimitInput,
    /** Buscas salvas: 20/h — salvar busca é ato pontual. */
    savedSearch: { max: 20, windowMs: 60 * 60_000 } satisfies RateLimitInput,
} as const;
