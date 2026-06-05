"use client";

import * as React from "react";

/**
 * Banner de retorno do checkout do Stripe.
 *
 * Recebe o status de pagamento como prop (`success` | `cancel` |
 * `failure`) — o server component lê o query param da `success_url`/
 * `cancel_url` e repassa. Manter como prop (em vez de
 * `useSearchParams`) evita exigir um boundary de Suspense.
 *
 * Importante pro PIX: o pagamento é **assíncrono**. Ao voltar com
 * `success`, o webhook pode ainda não ter confirmado (o cliente
 * acabou de escanear o QR). Por isso a mensagem diz "pode levar
 * alguns instantes" — a liberação real acontece quando o webhook do
 * Stripe processa `async_payment_succeeded`.
 *
 * Cartão é síncrono: confirma na hora. A mesma mensagem cobre os
 * dois casos sem prometer ativação imediata que o PIX não garante.
 *
 * Retorna `null` quando não há status reconhecido.
 */
export interface PaymentResultBannerProps {
    /** Status cru do query param (`success`, `cancel`, `failure`). */
    status?: string;
}

export function PaymentResultBanner({
    status,
}: PaymentResultBannerProps): React.ReactElement | null {
    const [visible, setVisible] = React.useState(true);

    if (!status || !visible) return null;

    const isSuccess = status === "success";
    const isCancel = status === "cancel" || status === "failure";

    if (!isSuccess && !isCancel) return null;

    return (
        <div
            role="status"
            aria-live="polite"
            className={[
                "mx-auto mb-4 flex w-full max-w-3xl items-start gap-3 rounded-2xl border px-4 py-3 text-sm",
                isSuccess
                    ? "border-success-200 bg-success-50 text-success-800"
                    : "border-warning-200 bg-warning-50 text-warning-800",
            ].join(" ")}
        >
            <span className="mt-0.5 text-base leading-none">
                {isSuccess ? "✅" : "⚠️"}
            </span>
            <div className="flex-1">
                {isSuccess ? (
                    <>
                        <p className="font-medium">Pagamento recebido!</p>
                        <p className="mt-0.5 text-text-secondary">
                            A liberação pode levar alguns instantes. Se você
                            pagou via PIX, aguarde a confirmação e atualize a
                            página em seguida.
                        </p>
                    </>
                ) : (
                    <>
                        <p className="font-medium">Pagamento não concluído</p>
                        <p className="mt-0.5 text-text-secondary">
                            Nenhuma cobrança foi feita. Você pode tentar
                            novamente quando quiser.
                        </p>
                    </>
                )}
            </div>
            <button
                type="button"
                onClick={() => setVisible(false)}
                aria-label="Fechar aviso"
                className="text-text-tertiary transition-colors hover:text-text-primary"
            >
                ✕
            </button>
        </div>
    );
}
