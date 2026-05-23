"use client";

import * as React from "react";

import {
    Button,
    FlameIcon,
    InlineAlert,
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
 */
export interface BoostCheckoutButtonProps {
    ativo: boolean;
    pendingPaymentId: string | null;
}

export function BoostCheckoutButton({
    ativo,
    pendingPaymentId,
}: BoostCheckoutButtonProps): React.ReactElement {
    const [submitting, setSubmitting] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    async function handleClick(): Promise<void> {
        setSubmitting(true);
        setError(null);
        try {
            const res = await fetch("/api/acompanhante/boost/checkout", {
                method: "POST",
            });
            const payload = (await res.json().catch(() => null)) as
                | { ok?: boolean; reason?: string; checkoutUrl?: string }
                | null;
            if (!res.ok || !payload?.ok || !payload.checkoutUrl) {
                setError(reasonToMessage(payload?.reason ?? "DESCONHECIDO"));
                return;
            }
            // Redireciona pro checkout do Mercado Pago.
            window.location.href = payload.checkoutUrl;
        } catch {
            setError("Falha de rede. Tente novamente.");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="flex flex-col gap-3">
            {pendingPaymentId !== null ? (
                <InlineAlert tone="info">
                    Você tem um pagamento aguardando confirmação do Mercado Pago.
                    Se já pagou, aguarde alguns segundos e atualize a página.
                </InlineAlert>
            ) : null}

            {error !== null ? (
                <InlineAlert tone="danger">{error}</InlineAlert>
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
                {ativo
                    ? `Estender boost por mais 24h (${formatarPrecoBoost()})`
                    : `Comprar boost (${formatarPrecoBoost()})`}
            </Button>
        </div>
    );
}

function reasonToMessage(reason: string): string {
    switch (reason) {
        case "PERFIL_NAO_ENCONTRADO":
            return "Perfil não encontrado.";
        case "MP_NAO_CONFIGURADO":
            return "Pagamentos indisponíveis no momento. Tente novamente mais tarde.";
        case "TIPO_INVALIDO":
            return "Esta conta não pode comprar boost.";
        case "NAO_AUTENTICADO":
            return "Sua sessão expirou. Faça login novamente.";
        default:
            return "Não foi possível iniciar o pagamento. Tente novamente.";
    }
}
