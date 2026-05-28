"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

import {
    Button,
    ReelsViewer,
    type ReelsViewerItem,
    type ReelsViewerPaywall,
} from "@/components";
import { buildAuthUrl } from "@/domain/redirect";
import type { QuotaReels } from "@/server/storage/reelMedia";

/**
 * Viewer kind do consumidor — espelha o tipo já usado no perfil
 * público.
 */
export type ReelsViewerKind = "anonimo" | "cliente" | "acompanhante";

export interface ReelsViewProps {
    initialItems: ReadonlyArray<ReelsViewerItem>;
    initialNextCursor: string | null;
    viewerKind: ReelsViewerKind;
    viewerPlano: "GRATIS" | "FAN" | null;
    initialQuota: QuotaReels;
}

const QUOTA_GRATIS_LOCAL_KEY = "privello:reels-views-anon";

/**
 * Anônimos não têm `userId` — quota deles é rastreada no
 * `localStorage` (best-effort, sem persistência server-side).
 *
 * Estrutura: `{ start: <epoch_ms>, count: <number> }`. Janela de
 * 24h: quando `start + 24h < now`, reseta.
 */
function lerQuotaAnonima(): { start: number; count: number } {
    if (typeof window === "undefined") return { start: Date.now(), count: 0 };
    try {
        const raw = window.localStorage.getItem(QUOTA_GRATIS_LOCAL_KEY);
        if (!raw) return { start: Date.now(), count: 0 };
        const parsed = JSON.parse(raw) as Partial<{
            start: number;
            count: number;
        }>;
        if (
            typeof parsed.start === "number" &&
            typeof parsed.count === "number" &&
            Date.now() - parsed.start < 24 * 60 * 60 * 1000
        ) {
            return { start: parsed.start, count: parsed.count };
        }
    } catch {
        // ignore
    }
    return { start: Date.now(), count: 0 };
}

function escreverQuotaAnonima(state: {
    start: number;
    count: number;
}): void {
    if (typeof window === "undefined") return;
    try {
        window.localStorage.setItem(
            QUOTA_GRATIS_LOCAL_KEY,
            JSON.stringify(state),
        );
    } catch {
        // ignore
    }
}

/**
 * `ReelsView` — orquestra o `ReelsViewer` com:
 *
 *   - Estado local da lista (anexa páginas vindas do
 *     `/api/reels`).
 *   - Registro de view via `POST /api/reels/[id]/view` quando
 *     autenticado; via localStorage pra anônimo.
 *   - Like via `POST /api/medias/[id]/likes` (reusa endpoint
 *     existente). Apenas Cliente Fan persiste — Grátis/anônimo
 *     vê tooltip de upgrade.
 *   - Comentários: leva pro perfil público + scroll pra seção
 *     (`/acompanhantes/<slug>#comentarios-<reelId>` futuro;
 *     por ora vai pro perfil sem âncora).
 *   - Paywall: dispara quando viewer Grátis/anônimo estoura
 *     quota.
 */
export function ReelsView({
    initialItems,
    initialNextCursor,
    viewerKind,
    viewerPlano,
    initialQuota,
}: ReelsViewProps): React.ReactElement {
    const pathname = usePathname();

    const [items, setItems] = React.useState<ReelsViewerItem[]>(
        initialItems.map((i) => ({ ...i })),
    );
    const [cursor, setCursor] = React.useState<string | null>(
        initialNextCursor,
    );
    const [loadingMore, setLoadingMore] = React.useState(false);
    const [paywallOn, setPaywallOn] = React.useState(false);

    const ilimitado = initialQuota.ilimitado;

    // Usado pra anônimos contar localmente — ref pra evitar re-renders.
    const quotaAnonimaRef = React.useRef(
        viewerKind === "anonimo" ? lerQuotaAnonima() : null,
    );

    /**
     * Carrega próxima página do feed e anexa à lista. Idempotente —
     * mesmo cursor não duplica.
     */
    async function loadMore(): Promise<void> {
        if (loadingMore || cursor === null || paywallOn) return;
        setLoadingMore(true);
        try {
            const params = new URLSearchParams();
            params.set("cursor", cursor);
            params.set("limit", "10");
            const res = await fetch(`/api/reels?${params.toString()}`);
            if (!res.ok) return;
            const payload = (await res.json().catch(() => null)) as
                | {
                    ok: boolean;
                    items: ReadonlyArray<{
                        id: string;
                        storageKey: string;
                        posterStorageKey: string | null;
                        caption: string | null;
                        likesCount: number;
                        liked: boolean;
                        commentsCount: number;
                        owner: {
                            identificador: string;
                            nome: string;
                            fotoUrl: string | null;
                            cidadeNome: string;
                            estadoSigla: string;
                        };
                    }>;
                    nextCursor: string | null;
                }
                | null;
            if (payload === null || !payload.ok) return;
            setItems((prev) => {
                const existingIds = new Set(prev.map((i) => i.id));
                const novos = payload.items
                    .filter((reel) => !existingIds.has(reel.id))
                    .map((reel) => ({
                        id: reel.id,
                        videoUrl: `/api/storage/${reel.storageKey}`,
                        posterUrl: reel.posterStorageKey
                            ? `/api/storage/${reel.posterStorageKey}`
                            : null,
                        caption: reel.caption,
                        likes: reel.likesCount,
                        liked: reel.liked,
                        owner: reel.owner,
                    }));
                return [...prev, ...novos];
            });
            setCursor(payload.nextCursor);
        } catch {
            // best-effort; usuário pode tentar de novo rolando
        } finally {
            setLoadingMore(false);
        }
    }

    /**
     * Registra view do reel ativo. Quando autenticado, chama
     * endpoint persistente; quando anônimo, conta localmente.
     * Em ambos, se a quota estourou, ativa o paywall.
     */
    async function handleViewActive(reelId: string): Promise<void> {
        if (ilimitado) return;

        // Anônimo: conta no localStorage.
        if (viewerKind === "anonimo") {
            const state = quotaAnonimaRef.current;
            if (!state) return;
            // Janela rotativa de 24h.
            if (Date.now() - state.start > 24 * 60 * 60 * 1000) {
                state.start = Date.now();
                state.count = 0;
            }
            state.count += 1;
            escreverQuotaAnonima(state);
            if (state.count > initialQuota.limite) {
                setPaywallOn(true);
            }
            return;
        }

        // Autenticado: bate no backend.
        try {
            const res = await fetch(
                `/api/reels/${encodeURIComponent(reelId)}/view`,
                { method: "POST" },
            );
            if (!res.ok) return;
            const payload = (await res.json().catch(() => null)) as
                | { ok: true; quotaEstourada: boolean }
                | null;
            if (payload?.quotaEstourada) {
                setPaywallOn(true);
            }
        } catch {
            // best-effort
        }
    }

    /**
     * Toggle de like. Apenas Cliente Fan persiste; outros recebem
     * 402 e a UI aponta pro caminho de upgrade.
     */
    async function handleToggleLike(
        reelId: string,
        desired: boolean,
    ): Promise<void> {
        // Anônimo: paywall direto.
        if (viewerKind === "anonimo") {
            setPaywallOn(true);
            return;
        }
        // Cliente Grátis: paywall (gating de Fan).
        if (viewerKind === "cliente" && viewerPlano !== "FAN") {
            setPaywallOn(true);
            return;
        }

        // Otimista no estado local.
        setItems((prev) =>
            prev.map((i) =>
                i.id === reelId
                    ? {
                        ...i,
                        liked: desired,
                        likes: Math.max(0, i.likes + (desired ? 1 : -1)),
                    }
                    : i,
            ),
        );

        try {
            await fetch(`/api/medias/${encodeURIComponent(reelId)}/likes`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ liked: desired }),
            });
        } catch {
            // se falhar, próxima carga corrige; UX não bloqueia.
        }
    }

    const paywall: ReelsViewerPaywall | null = paywallOn
        ? buildPaywall(viewerKind, pathname)
        : null;

    return (
        <ReelsViewer
            items={items}
            onNeedMore={() => void loadMore()}
            onViewActive={(id) => void handleViewActive(id)}
            onToggleLike={(id, desired) => void handleToggleLike(id, desired)}
            paywall={paywall}
        />
    );
}

function buildPaywall(
    viewerKind: ReelsViewerKind,
    pathname: string,
): ReelsViewerPaywall {
    if (viewerKind === "anonimo") {
        return {
            title: "Crie sua conta pra continuar",
            description:
                "Você assistiu seus 5 reels do dia. Crie conta pra continuar vendo + curtir, comentar e ver perfis completos.",
            actions: (
                <>
                    <Button
                        href={buildAuthUrl("/cadastro", pathname)}
                        size="md"
                        variant="primary"
                    >
                        Criar conta grátis
                    </Button>
                    <Button
                        href={buildAuthUrl("/login", pathname)}
                        size="md"
                        variant="ghost"
                    >
                        Entrar
                    </Button>
                </>
            ),
        };
    }
    return {
        title: "Vire Fan pra continuar",
        description:
            "Você assistiu 5 reels nas últimas 24h. Fans têm acesso ilimitado, podem curtir, comentar e ver tudo.",
        actions: (
            <Button
                href="/cliente/selecao-plano"
                size="md"
                variant="primary"
            >
                Ver planos
            </Button>
        ),
    };
}
