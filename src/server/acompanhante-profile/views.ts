import { cookies } from "next/headers";

import { db } from "@/lib/db";
import type { ViewOrigin } from "@/domain/stats/origem";

import {
    incrementarStatDiaria,
    registrarViewAvancada,
} from "./stats";

/**
 * Cooldown padrão entre visualizações que contam para o mesmo
 * `userId` no mesmo viewer (anônimo ou autenticado). 6 horas é
 * um equilíbrio entre detectar tráfego de retorno legítimo e evitar
 * inflar o número via refresh agressivo.
 */
export const VIEW_COOLDOWN_SECONDS = 6 * 60 * 60;

/**
 * Cookie único que guarda o cooldown de visualizações por viewer.
 *
 * # Por que um único cookie em vez de um por perfil
 *
 * A primeira versão usava um cookie `pv_<userId>` por perfil
 * visualizado. Funciona bem pra poucos perfis, mas navegadores
 * limitam o número de cookies por origem (Chrome ~180, Firefox
 * ~50). Um power user que visita 30 perfis num dia já corre risco
 * de quebrar a aplicação inteira (auth, csrf, etc.) por estourar
 * a cota.
 *
 * Solução: 1 cookie único `pv` com payload base64-JSON compacto:
 *
 *   ```ts
 *   { v: { "<userId-curto>": <timestamp_seg> } }
 *   ```
 *
 * Mantemos no máximo {@link VIEW_COOKIE_MAX_ENTRIES} entradas e
 * fazemos eviction LRU quando estoura. Entradas expiradas são
 * limpas em cada gravação.
 *
 * # Privacidade
 *
 * O cookie é HTTP-only (não acessível via JS) e same-site. Mesmo
 * em comprometimento de XSS o atacante não vê o conteúdo. Os UUIDs
 * em si não são PII — são identificadores públicos de perfis.
 */
export const VIEW_COOLDOWN_COOKIE_NAME = "pv";

/**
 * Limite de perfis lembrados por viewer. Acima disso, fazemos
 * eviction LRU (descarta o mais antigo). Em cookies, 200 entries
 * com UUID curto + timestamp ficam em ~3-4 KB — bem dentro do
 * limite de 4 KB por cookie.
 */
const VIEW_COOKIE_MAX_ENTRIES = 200;

interface ViewCookiePayload {
    /** Map de `<userId>` → timestamp da última view (epoch seconds). */
    v: Record<string, number>;
}

/**
 * Lê o cookie de cooldown e retorna o payload parseado, ou objeto
 * vazio quando ausente/inválido. Limpa entradas expiradas no
 * processo.
 */
async function lerCookie(): Promise<ViewCookiePayload> {
    const cookieStore = await cookies();
    const raw = cookieStore.get(VIEW_COOLDOWN_COOKIE_NAME)?.value;
    if (!raw) return { v: {} };
    try {
        const decoded = Buffer.from(raw, "base64url").toString("utf8");
        const parsed = JSON.parse(decoded) as Partial<ViewCookiePayload>;
        if (
            typeof parsed === "object" &&
            parsed !== null &&
            typeof parsed.v === "object" &&
            parsed.v !== null
        ) {
            // Filtra entradas expiradas e valida shape.
            const nowSec = Math.floor(Date.now() / 1000);
            const cutoff = nowSec - VIEW_COOLDOWN_SECONDS;
            const cleaned: Record<string, number> = {};
            for (const [key, value] of Object.entries(parsed.v)) {
                if (
                    typeof key === "string" &&
                    key.length > 0 &&
                    typeof value === "number" &&
                    value > cutoff
                ) {
                    cleaned[key] = value;
                }
            }
            return { v: cleaned };
        }
    } catch {
        // Cookie corrompido — recomeça do zero.
    }
    return { v: {} };
}

/**
 * Lê o cookie e retorna `true` quando o viewer já contou view pra
 * este `targetUserId` nas últimas 6h.
 */
export async function viewCooldownAtivo(
    targetUserId: string,
): Promise<boolean> {
    const payload = await lerCookie();
    const ts = payload.v[targetUserId];
    if (typeof ts !== "number") return false;
    const nowSec = Math.floor(Date.now() / 1000);
    return ts > nowSec - VIEW_COOLDOWN_SECONDS;
}

/**
 * Marca o `targetUserId` como visualizado agora. Atualiza o cookie
 * com cap em {@link VIEW_COOKIE_MAX_ENTRIES} (LRU drop).
 *
 * Deve ser chamado de Route Handler ou Server Action (Next proíbe
 * `cookies().set()` em RSC).
 */
export async function marcarViewCooldown(targetUserId: string): Promise<void> {
    const payload = await lerCookie();
    const nowSec = Math.floor(Date.now() / 1000);
    payload.v[targetUserId] = nowSec;

    // Eviction LRU quando passa do limite — descarta o mais antigo.
    const entries = Object.entries(payload.v);
    if (entries.length > VIEW_COOKIE_MAX_ENTRIES) {
        entries.sort((a, b) => b[1] - a[1]);
        const trimmed = entries.slice(0, VIEW_COOKIE_MAX_ENTRIES);
        payload.v = Object.fromEntries(trimmed);
    }

    const cookieStore = await cookies();
    const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString(
        "base64url",
    );
    cookieStore.set({
        name: VIEW_COOLDOWN_COOKIE_NAME,
        value: encoded,
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: VIEW_COOLDOWN_SECONDS,
    });
}

/**
 * Resultado de {@link incrementarVisualizacao}.
 *
 * - `applied: true`: visualização contada, caller deve gravar o
 *   cookie de cooldown.
 * - `applied: false`: visualização pulada (auto-view, target não é
 *   Acompanhante, ou banco recusou). Caller não grava cookie.
 */
export type IncrementarVisualizacaoResult = { applied: boolean };

/**
 * Incrementa o contador de visualizações públicas do perfil de uma
 * Acompanhante. **Não toca em cookies** — quem grava o cookie de
 * cooldown é o Route Handler que orquestra a operação (porque
 * `cookies().set()` é proibido em RSC, e o caller deste módulo
 * idealmente roda em Route Handler).
 *
 * Falha silenciosamente em qualquer erro de banco — vista é métrica,
 * não pode derrubar a página pública.
 *
 * @param targetUserId - `userId` do dono do perfil sendo visualizado.
 * @param viewerUserId - `userId` do visitante autenticado, ou `null`
 *   para anônimos. Quando o visitante é a própria Acompanhante,
 *   o incremento é pulado (não faz sentido auto-view).
 * @param origin - Origem da visita (busca/home/direct/compartilhado),
 *   classificada server-side a partir do referrer. Default `DIRECT`.
 */
export async function incrementarVisualizacao(
    targetUserId: string,
    viewerUserId: string | null,
    origin: ViewOrigin = "DIRECT",
): Promise<IncrementarVisualizacaoResult> {
    if (viewerUserId !== null && viewerUserId === targetUserId) {
        return { applied: false };
    }

    try {
        await db.acompanhanteProfile.update({
            where: { userId: targetUserId },
            data: { viewsCount: { increment: 1 } },
            select: { userId: true },
        });
        // Incremento da série diária pra o gráfico do painel.
        // Best-effort — falha aqui não derruba a métrica agregada.
        await incrementarStatDiaria({
            userId: targetUserId,
            field: "views",
        }).catch(() => undefined);
        // Agregações avançadas (heatmap + origem). Best-effort.
        await registrarViewAvancada({
            userId: targetUserId,
            origin,
        }).catch(() => undefined);
        return { applied: true };
    } catch {
        // Métrica não derruba página.
        return { applied: false };
    }
}
