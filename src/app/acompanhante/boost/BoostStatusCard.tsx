"use client";

import * as React from "react";

import { Card, FlameIcon } from "@/components";

/**
 * Card "Em chamas" exibido quando há boost ativo.
 *
 * Mostra um countdown que decrementa em tempo real (1Hz) usando o
 * `boostUntil` recebido como ISO string. Quando expira, exibe
 * "expirado" sem recarregar a página — o caller decide via
 * `router.refresh()` se quiser reesincronizar o estado do servidor.
 */
export interface BoostStatusCardProps {
    /** ISO string da data/hora em que o boost expira. */
    boostUntil: string;
}

export function BoostStatusCard({
    boostUntil,
}: BoostStatusCardProps): React.ReactElement {
    const target = React.useMemo(
        () => new Date(boostUntil).getTime(),
        [boostUntil],
    );
    const [now, setNow] = React.useState(() => Date.now());

    React.useEffect(() => {
        const id = window.setInterval(() => setNow(Date.now()), 1000);
        return () => window.clearInterval(id);
    }, []);

    const diff = Math.max(0, target - now);
    const totalSeconds = Math.floor(diff / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const expired = diff <= 0;

    return (
        <Card variant="elevated" featured>
            <div className="flex items-center gap-4">
                <span
                    aria-hidden="true"
                    className="inline-flex h-14 w-14 flex-none items-center justify-center rounded-full bg-primary-100 text-primary-700"
                >
                    <FlameIcon size={28} />
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-base font-semibold text-text-primary">
                        {expired ? "Boost expirado" : "Em chamas agora"}
                    </span>
                    <span className="text-sm text-text-secondary">
                        {expired
                            ? "Atualize a página para comprar de novo."
                            : "Sua presença está em prioridade total."}
                    </span>
                    {!expired ? (
                        <span
                            aria-live="polite"
                            className="mt-1 font-mono text-sm font-semibold tabular-nums tracking-tight text-primary-700"
                        >
                            {pad(hours)}:{pad(minutes)}:{pad(seconds)}
                        </span>
                    ) : null}
                </div>
            </div>
        </Card>
    );
}

function pad(n: number): string {
    return n.toString().padStart(2, "0");
}
