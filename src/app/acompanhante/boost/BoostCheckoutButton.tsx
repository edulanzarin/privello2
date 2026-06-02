"use client";

import * as React from "react";

import {
    Button,
    FlameIcon,
    InlineAlert,
    useToast,
} from "@/components";
import { formatarPrecoBoost } from "@/domain/boost/definitions";

/**
 * Botão de compra de Boost.
 *
 * Dispara `POST /api/acompanhante/boost/checkout` e, em sucesso,
 * redireciona o navegador (`window.location.href`) para a URL do
 * Checkout Pro do Mercado Pago retornada pelo servidor.
 *
 * Estados:
 *  - `ativo === false`: rótulo "Comprar boost (R$ 9,90)".
 *  - `ativo === true`: rótulo "Estender por mais 24h" — comprar
 *    durante uma janela ativa adiciona horas cumulativamente.
 *  - `pendingPaymentId !== null`: mostra alerta informando que há
 *    pagamento aguardando confirmação. Não bloqueia nova compra
 *    (o usuário pode tentar de novo se o checkout anterior travou).
 *
 * # Agendamento (T09)
 *
 * Toggle "Começar agora" / "Programar". No modo programar, mostra
 * um `datetime-local` — a data escolhida vira `startAt` no body do
 * checkout. O boost só estende `boostUntil` quando a hora chegar
 * (via cron). Datas inválidas/fora da janela são barradas no server.
 */
export interface BoostCheckoutButtonProps {
    ativo: boolean;
    pendingPaymentId: string | null;
}

type Modo = "agora" | "programar";

export function BoostCheckoutButton({
    ativo,
    pendingPaymentId,
}: BoostCheckoutButtonProps): React.ReactElement {
    const [submitting, setSubmitting] = React.useState(false);
    const [modo, setModo] = React.useState<Modo>("agora");
    const [startAtLocal, setStartAtLocal] = React.useState("");
    const toast = useToast();

    // Mínimo do datetime-local: agora + 10min, formato
    // "YYYY-MM-DDTHH:mm" (sem segundos/timezone — o input usa local).
    const minDateTime = React.useMemo(() => {
        const d = new Date(Date.now() + 10 * 60 * 1000);
        const pad = (n: number) => String(n).padStart(2, "0");
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
            d.getDate(),
        )}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }, []);

    async function handleClick(): Promise<void> {
        setSubmitting(true);

        // Valida o agendamento no client antes de bater no server.
        let startAtIso: string | null = null;
        if (modo === "programar") {
            if (startAtLocal.length === 0) {
                toast.danger("Escolha a data e hora de início.");
                setSubmitting(false);
                return;
            }
            const parsed = new Date(startAtLocal);
            if (Number.isNaN(parsed.getTime())) {
                toast.danger("Data inválida.");
                setSubmitting(false);
                return;
            }
            startAtIso = parsed.toISOString();
        }

        try {
            const res = await fetch("/api/acompanhante/boost/checkout", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(
                    startAtIso !== null ? { startAt: startAtIso } : {},
                ),
            });
            const payload = (await res.json().catch(() => null)) as
                | { ok?: boolean; reason?: string; checkoutUrl?: string }
                | null;
            if (!res.ok || !payload?.ok || !payload.checkoutUrl) {
                toast.danger(reasonToMessage(payload?.reason ?? "DESCONHECIDO"));
                return;
            }
            // Redireciona pro checkout do Mercado Pago.
            window.location.href = payload.checkoutUrl;
        } catch {
            toast.danger("Falha de rede. Tente novamente.");
        } finally {
            setSubmitting(false);
        }
    }

    const ctaLabel =
        modo === "programar"
            ? `Programar boost (${formatarPrecoBoost()})`
            : ativo
                ? `Estender boost por mais 24h (${formatarPrecoBoost()})`
                : `Comprar boost (${formatarPrecoBoost()})`;

    return (
        <div className="flex flex-col gap-3">
            {pendingPaymentId !== null ? (
                <InlineAlert tone="info">
                    Você tem um pagamento aguardando confirmação.
                    Se já pagou, aguarde alguns segundos e atualize a página.
                </InlineAlert>
            ) : null}

            {/* Toggle de modo de início. */}
            <div
                role="group"
                aria-label="Quando começar o boost"
                className="grid grid-cols-2 gap-2"
            >
                <button
                    type="button"
                    onClick={() => setModo("agora")}
                    aria-pressed={modo === "agora"}
                    className={[
                        "rounded-xl border px-3 py-2 text-sm font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
                        modo === "agora"
                            ? "border-accent/50 bg-accent-soft text-accent-deep"
                            : "border-border bg-surface text-text-secondary hover:border-accent/30",
                    ].join(" ")}
                >
                    Começar agora
                </button>
                <button
                    type="button"
                    onClick={() => setModo("programar")}
                    aria-pressed={modo === "programar"}
                    className={[
                        "rounded-xl border px-3 py-2 text-sm font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
                        modo === "programar"
                            ? "border-accent/50 bg-accent-soft text-accent-deep"
                            : "border-border bg-surface text-text-secondary hover:border-accent/30",
                    ].join(" ")}
                >
                    Programar
                </button>
            </div>

            {modo === "programar" ? (
                <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-text-secondary">
                        Início (sua hora local)
                    </span>
                    <input
                        type="datetime-local"
                        value={startAtLocal}
                        min={minDateTime}
                        onChange={(e) => setStartAtLocal(e.target.value)}
                        className="rounded-xl border border-border bg-surface px-3 py-2 text-sm focus:border-accent focus:outline-none"
                    />
                    <span className="text-[0.65rem] text-text-disabled">
                        O boost ativa automaticamente na hora escolhida e
                        dura 24h. Até lá, o pagamento fica confirmado e
                        aguardando.
                    </span>
                </label>
            ) : null}

            <Button
                type="button"
                variant="primary"
                size="lg"
                onClick={() => void handleClick()}
                loading={submitting}
                disabled={submitting}
            >
                <FlameIcon size={16} />
                {ctaLabel}
            </Button>
        </div>
    );
}

function reasonToMessage(reason: string): string {
    switch (reason) {
        case "PERFIL_NAO_ENCONTRADO":
            return "Perfil não encontrado.";
        case "PAGAMENTO_NAO_CONFIGURADO":
            return "Pagamentos indisponíveis no momento. Tente novamente mais tarde.";
        case "AGENDAMENTO_INVALIDO":
            return "Data de início inválida. Escolha entre agora e 30 dias à frente.";
        case "TIPO_INVALIDO":
            return "Esta conta não pode comprar boost.";
        case "NAO_AUTENTICADO":
            return "Sua sessão expirou. Faça login novamente.";
        default:
            return "Não foi possível iniciar o pagamento. Tente novamente.";
    }
}
