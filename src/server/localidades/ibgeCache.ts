/**
 * Repositório de cache de respostas da API_IBGE.
 *
 * Combina duas camadas:
 *
 * 1. **In-memory** (`Map<string, …>` por processo) para evitar ida ao Postgres
 *    em hits dentro do mesmo container. Entradas in-memory são invalidadas
 *    preguiçosamente por `expiresAt <= now` em cada leitura.
 * 2. **Tabela `IbgeCacheEntry`** (Postgres via Prisma) como fonte de verdade
 *    persistente, usada também para servir dados *stale* quando a API_IBGE
 *    está indisponível (ver `LocalidadesService` na task 7.3).
 *
 * O TTL é clampado para o intervalo [24h, 168h] (=7 dias) exigido pelo
 * Requirement 4.5. Valores fora de `[1, 168h]` são considerados entrada
 * inválida e provocam erro síncrono.
 *
 * Requirements: 4.5.
 */
import type { Prisma } from "@prisma/client";

import { db } from "@/lib/db";

/** TTL mínimo permitido (24 horas em milissegundos) — Requirement 4.5. */
export const IBGE_CACHE_TTL_MIN_MS = 24 * 60 * 60 * 1000;

/** TTL máximo permitido (168 horas = 7 dias em milissegundos) — Requirement 4.5. */
export const IBGE_CACHE_TTL_MAX_MS = 168 * 60 * 60 * 1000;

/** TTL padrão usado quando `IBGE_CACHE_TTL_HOURS` está ausente do ambiente. */
export const IBGE_CACHE_TTL_DEFAULT_HOURS = 72;

/** Resultado de `getCache`. */
export type IbgeCacheLookup<T> = {
    /** Payload bruto (JSON) que foi previamente persistido. */
    payload: T;
    /** Instante em que a entrada foi gravada. */
    fetchedAt: Date;
    /** Instante a partir do qual a entrada é considerada expirada. */
    expiresAt: Date;
    /** `true` quando `expiresAt <= now`. Útil para servir conteúdo *stale*. */
    isExpired: boolean;
};

/** Estrutura interna da camada in-memory. */
type InMemoryEntry = {
    payload: unknown;
    fetchedAt: Date;
    expiresAt: Date;
};

/**
 * Mapa em memória compartilhado por todo o processo Node. Invalidado
 * preguiçosamente: leituras descartam entradas com `expiresAt <= now`, e
 * escritas substituem incondicionalmente.
 */
const inMemoryCache = new Map<string, InMemoryEntry>();

/**
 * Lê uma entrada de cache pelo `key`.
 *
 * - Procura primeiro na camada in-memory; se encontrar uma entrada ainda
 *   válida (`expiresAt > now`), retorna sem tocar no banco.
 * - Se a entrada in-memory existir mas estiver expirada, ela é removida e a
 *   busca prossegue para o Postgres (que pode conter uma entrada *stale*
 *   utilizável como fallback).
 * - Em qualquer caso, retorna `null` se nenhuma camada conhecer o `key`.
 *
 * O parâmetro `opts.now` permite injeção de relógio nos testes.
 */
export async function getCache<T = unknown>(
    key: string,
    opts: { now?: Date } = {},
): Promise<IbgeCacheLookup<T> | null> {
    const now = opts.now ?? new Date();
    const nowMs = now.getTime();

    const memEntry = inMemoryCache.get(key);
    if (memEntry !== undefined) {
        if (memEntry.expiresAt.getTime() > nowMs) {
            return {
                payload: memEntry.payload as T,
                fetchedAt: memEntry.fetchedAt,
                expiresAt: memEntry.expiresAt,
                isExpired: false,
            };
        }
        // Expirada: limpa para evitar acumular lixo entre requisições.
        inMemoryCache.delete(key);
    }

    const row = await db.ibgeCacheEntry.findUnique({ where: { key } });
    if (row === null) {
        return null;
    }

    const isExpired = row.expiresAt.getTime() <= nowMs;
    if (!isExpired) {
        // Repovoamos a camada in-memory para acelerar leituras subsequentes.
        inMemoryCache.set(key, {
            payload: row.payload,
            fetchedAt: row.fetchedAt,
            expiresAt: row.expiresAt,
        });
    }

    return {
        payload: row.payload as T,
        fetchedAt: row.fetchedAt,
        expiresAt: row.expiresAt,
        isExpired,
    };
}

/**
 * Persiste (upsert) uma entrada de cache em ambas as camadas (Postgres +
 * in-memory) calculando `expiresAt = now + clampedTtl`.
 *
 * `ttlMs` deve estar em `[1, 168h]`; valores fora desse intervalo são
 * considerados entrada inválida e provocam `RangeError`. Dentro do intervalo
 * permitido, valores menores que `24h` são elevados para `24h` para satisfazer
 * o piso do Requirement 4.5.
 *
 * O parâmetro `opts.now` permite injeção de relógio nos testes.
 */
export async function upsertCache(
    key: string,
    payload: unknown,
    ttlMs: number,
    opts: { now?: Date } = {},
): Promise<void> {
    if (!Number.isFinite(ttlMs) || ttlMs < 1 || ttlMs > IBGE_CACHE_TTL_MAX_MS) {
        throw new RangeError(
            `ttlMs deve estar no intervalo [1, ${IBGE_CACHE_TTL_MAX_MS}]ms; recebido: ${ttlMs}`,
        );
    }

    const clampedTtlMs = Math.max(
        IBGE_CACHE_TTL_MIN_MS,
        Math.min(IBGE_CACHE_TTL_MAX_MS, ttlMs),
    );

    const now = opts.now ?? new Date();
    const fetchedAt = now;
    const expiresAt = new Date(now.getTime() + clampedTtlMs);

    const jsonPayload = payload as Prisma.InputJsonValue;

    await db.ibgeCacheEntry.upsert({
        where: { key },
        create: {
            key,
            payload: jsonPayload,
            fetchedAt,
            expiresAt,
        },
        update: {
            payload: jsonPayload,
            fetchedAt,
            expiresAt,
        },
    });

    inMemoryCache.set(key, { payload, fetchedAt, expiresAt });
}

/**
 * Resolve o TTL configurado lendo `IBGE_CACHE_TTL_HOURS` do ambiente,
 * aplicando o default de 72 horas quando ausente/vazio/inválido e clampando o
 * resultado em `[24, 168]` horas (Requirement 4.5).
 *
 * Retorna o TTL já em **milissegundos**, pronto para ser passado a
 * `upsertCache`.
 *
 * Observação: a leitura é direta de `process.env` (sem passar por
 * `validateEnv`) para que o cache permaneça utilizável mesmo que outras
 * variáveis não relacionadas ao IBGE estejam ausentes em contextos de teste.
 */
export function resolveTtlMsFromEnv(): number {
    const raw = process.env.IBGE_CACHE_TTL_HOURS;
    let hours = IBGE_CACHE_TTL_DEFAULT_HOURS;

    if (raw !== undefined && raw.trim() !== "") {
        const parsed = Number.parseInt(raw, 10);
        if (Number.isInteger(parsed) && String(parsed) === raw.trim()) {
            hours = parsed;
        }
    }

    if (hours < 24) hours = 24;
    if (hours > 168) hours = 168;

    return hours * 60 * 60 * 1000;
}

/**
 * Limpa a camada in-memory deste processo. Existe principalmente para garantir
 * isolamento entre suites/casos de teste; código de produção raramente deve
 * chamá-la.
 */
export function resetInMemoryCache(): void {
    inMemoryCache.clear();
}
