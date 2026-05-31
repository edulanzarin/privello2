"use client";

import * as React from "react";
import Link from "next/link";

import {
    BellIcon,
    BookmarkIcon,
    ChatIcon,
    FlameIcon,
    ShieldIcon,
    XIcon,
} from "@/components";

import type { NotificationItem } from "@/server/notifications";

/**
 * Sininho de notificações in-site (V2) — vai no slot `topTrailing`
 * da TopBar do painel da Acompanhante.
 *
 * Comportamento:
 *
 *   1. Ao montar, busca `/api/notifications` (lista + contagem de
 *      não lidas). Mostra um badge com o número quando há não lidas.
 *   2. Clicar abre um dropdown com as notificações mais recentes.
 *      Ao abrir, marca todas como lidas (`POST /read { all: true }`)
 *      e zera o badge — o conteúdo continua visível.
 *   3. Cada item tem ícone por categoria, texto e tempo relativo.
 *      Alguns linkam pra um destino (perfil de quem avaliou, aba de
 *      verificação, etc.).
 *
 * Sem dependência de polling — recarrega quando o dropdown abre.
 * Componente de domínio (conhece os tipos de notificação), por isso
 * vive em `_painel/` e não nos primitivos.
 */
export function NotificationBell(): React.ReactElement {
    const [items, setItems] = React.useState<ReadonlyArray<NotificationItem>>(
        [],
    );
    const [naoLidas, setNaoLidas] = React.useState(0);
    const [open, setOpen] = React.useState(false);
    const [carregando, setCarregando] = React.useState(false);
    const rootRef = React.useRef<HTMLDivElement>(null);

    const carregar = React.useCallback(async (): Promise<void> => {
        setCarregando(true);
        try {
            const res = await fetch("/api/notifications?limit=30", {
                headers: { Accept: "application/json" },
            });
            if (!res.ok) return;
            const data = (await res.json()) as {
                ok: boolean;
                items?: ReadonlyArray<NotificationItem>;
                naoLidas?: number;
            };
            if (data.ok && data.items) {
                setItems(data.items);
                setNaoLidas(data.naoLidas ?? 0);
            }
        } catch {
            // silencioso — sininho é secundário.
        } finally {
            setCarregando(false);
        }
    }, []);

    // Carga inicial (só a contagem importa antes de abrir, mas já
    // trazemos a lista pra abrir instantâneo).
    React.useEffect(() => {
        void carregar();
    }, [carregar]);

    // Fecha ao clicar fora ou apertar Esc.
    React.useEffect(() => {
        if (!open) return;
        function onPointer(e: MouseEvent): void {
            if (
                rootRef.current &&
                !rootRef.current.contains(e.target as Node)
            ) {
                setOpen(false);
            }
        }
        function onKey(e: KeyboardEvent): void {
            if (e.key === "Escape") setOpen(false);
        }
        document.addEventListener("mousedown", onPointer);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("mousedown", onPointer);
            document.removeEventListener("keydown", onKey);
        };
    }, [open]);

    async function abrir(): Promise<void> {
        const next = !open;
        setOpen(next);
        if (next) {
            await carregar();
            // Marca todas como lidas ao abrir e zera o badge.
            if (naoLidas > 0) {
                setNaoLidas(0);
                try {
                    await fetch("/api/notifications/read", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ all: true }),
                    });
                } catch {
                    // se falhar, recarrega na próxima abertura.
                }
            }
        }
    }

    return (
        <div ref={rootRef} className="relative">
            <button
                type="button"
                onClick={() => void abrir()}
                aria-label={
                    naoLidas > 0
                        ? `Notificações, ${naoLidas} não lidas`
                        : "Notificações"
                }
                aria-haspopup="true"
                aria-expanded={open}
                className="relative flex h-9 w-9 items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-[#ec7b5b]/10 hover:text-[color:var(--accent-deep)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ec7b5b]/40"
            >
                <BellIcon size={20} />
                {naoLidas > 0 ? (
                    <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-[color:var(--accent)] px-1 text-[0.6rem] font-semibold text-white ring-2 ring-white">
                        {naoLidas > 9 ? "9+" : naoLidas}
                    </span>
                ) : null}
            </button>

            {open ? (
                <div
                    role="menu"
                    className="absolute right-0 top-11 z-40 w-[min(20rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-[#ec7b5b]/15 bg-white shadow-[0_16px_48px_-12px_rgba(0,0,0,0.28)]"
                >
                    <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-2.5">
                        <span className="text-sm font-semibold text-text-primary">
                            Notificações
                        </span>
                        <button
                            type="button"
                            onClick={() => setOpen(false)}
                            aria-label="Fechar"
                            className="flex h-7 w-7 items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-neutral-100 hover:text-text-primary"
                        >
                            <XIcon size={14} />
                        </button>
                    </div>

                    <div className="max-h-[60vh] overflow-y-auto">
                        {items.length === 0 ? (
                            <div className="px-4 py-8 text-center text-sm text-text-secondary">
                                {carregando
                                    ? "Carregando…"
                                    : "Nada por aqui ainda."}
                            </div>
                        ) : (
                            <ul className="flex flex-col">
                                {items.map((n) => (
                                    <li key={n.id}>
                                        <NotificacaoLinha notificacao={n} />
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            ) : null}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Linha de notificação
// ---------------------------------------------------------------------------

function NotificacaoLinha({
    notificacao,
}: {
    notificacao: NotificationItem;
}): React.ReactElement {
    const view = describe(notificacao);

    const inner = (
        <div className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-[#fff0eb]/50">
            <span
                aria-hidden="true"
                className={[
                    "mt-0.5 inline-flex h-8 w-8 flex-none items-center justify-center rounded-full",
                    view.iconClasses,
                ].join(" ")}
            >
                {view.icon}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-sm leading-snug text-text-primary">
                    {view.texto}
                </span>
                <span className="text-[0.7rem] text-text-secondary">
                    {formatRelative(notificacao.criadoEm)}
                </span>
            </div>
        </div>
    );

    if (view.href) {
        return <Link href={view.href}>{inner}</Link>;
    }
    return inner;
}

interface NotificacaoView {
    icon: React.ReactNode;
    iconClasses: string;
    texto: React.ReactNode;
    href?: string;
}

/**
 * Traduz uma notificação no que a UI mostra (ícone, texto, link).
 * Discrimina por `type` — o TS estreita o `payload`.
 */
function describe(n: NotificationItem): NotificacaoView {
    switch (n.type) {
        case "NOVA_AVALIACAO":
            return {
                icon: <ChatIcon size={15} />,
                iconClasses:
                    "bg-[#ec7b5b]/12 text-[color:var(--accent-deep)]",
                texto: (
                    <>
                        <strong className="font-semibold">
                            {n.payload.autorNome}
                        </strong>{" "}
                        deixou uma avaliação no seu perfil.
                    </>
                ),
                href: "/acompanhante#perfil",
            };
        case "NOVO_FAVORITO":
            return {
                icon: <BookmarkIcon size={15} />,
                iconClasses: "bg-rose-100 text-rose-600",
                texto:
                    n.payload.total === 1 ? (
                        <>Alguém salvou seu perfil. Você tem 1 salvamento.</>
                    ) : (
                        <>
                            Mais alguém salvou seu perfil. Já são{" "}
                            <strong className="font-semibold">
                                {n.payload.total}
                            </strong>{" "}
                            pessoas.
                        </>
                    ),
            };
        case "VERIFICACAO_APROVADA":
            return {
                icon: <ShieldIcon size={15} />,
                iconClasses: "bg-success-100 text-success-700",
                texto: (
                    <>Sua verificação foi aprovada. O selo já está ativo.</>
                ),
                href: "/acompanhante#verificacao",
            };
        case "VERIFICACAO_REJEITADA":
            return {
                icon: <ShieldIcon size={15} />,
                iconClasses: "bg-danger-100 text-danger-700",
                texto: (
                    <>
                        Sua verificação foi recusada:{" "}
                        <span className="text-text-secondary">
                            {n.payload.motivo}
                        </span>
                    </>
                ),
                href: "/acompanhante#verificacao",
            };
        case "BOOST_ATIVADO":
            return {
                icon: <FlameIcon size={15} />,
                iconClasses:
                    "bg-amber-100 text-amber-600",
                texto: (
                    <>
                        Seu boost está ativo até{" "}
                        <strong className="font-semibold">
                            {formatData(n.payload.expiraEm)}
                        </strong>
                        .
                    </>
                ),
                href: "/acompanhante#estatisticas",
            };
        default:
            return {
                icon: <BellIcon size={15} />,
                iconClasses: "bg-neutral-100 text-text-secondary",
                texto: <>Você tem uma novidade.</>,
            };
    }
}

function formatData(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "short",
    });
}

function formatRelative(date: Date | string): string {
    const d = typeof date === "string" ? new Date(date) : date;
    const diff = Date.now() - d.getTime();
    const min = Math.floor(diff / 60_000);
    if (min < 1) return "agora";
    if (min < 60) return `há ${min}min`;
    const h = Math.floor(min / 60);
    if (h < 24) return `há ${h}h`;
    const days = Math.floor(h / 24);
    if (days < 7) return `há ${days}d`;
    const weeks = Math.floor(days / 7);
    if (weeks < 5) return `há ${weeks}sem`;
    const months = Math.floor(days / 30);
    if (months < 12) return `há ${months}m`;
    const years = Math.floor(days / 365);
    return `há ${years}a`;
}
