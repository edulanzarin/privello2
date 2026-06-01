"use client";

import * as React from "react";
import Link from "next/link";

import { Button, EmptyState, FlameIcon } from "@/components";

/**
 * Error boundary de rota (V7 — observabilidade).
 *
 * O Next renderiza este componente quando um Server/Client Component
 * abaixo dele lança durante o render. Substitui a tela de erro crua
 * do framework por uma superfície da marca, com ação de "tentar de
 * novo" (`reset`) e link pra home.
 *
 * # Logging
 *
 * Em `useEffect`, reporta o erro. No browser não temos o logger
 * estruturado de servidor (que escreve em stdout), então logamos no
 * `console.error` — um sink externo (Sentry) plugaria aqui. O
 * `digest` do Next correlaciona com o log do servidor.
 */
export default function RouteError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}): React.ReactElement {
    React.useEffect(() => {
        console.error("[route-error]", {
            message: error.message,
            digest: error.digest,
        });
    }, [error]);

    return (
        <div className="flex min-h-[60vh] w-full items-center justify-center px-4">
            <EmptyState
                icon={<FlameIcon size={22} />}
                title="Algo deu errado"
                description="Tivemos um problema ao carregar esta página. Você pode tentar de novo — se persistir, volte mais tarde."
                action={
                    <div className="flex flex-wrap items-center justify-center gap-2">
                        <Button
                            type="button"
                            variant="primary"
                            size="md"
                            onClick={() => reset()}
                        >
                            Tentar de novo
                        </Button>
                        <Link
                            href="/"
                            className="inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                        >
                            Ir pra início
                        </Link>
                    </div>
                }
            />
        </div>
    );
}
