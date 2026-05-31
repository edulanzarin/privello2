"use client";

import * as React from "react";

/**
 * Global error boundary (V7 — observabilidade).
 *
 * Última linha de defesa: o Next renderiza este componente quando o
 * **próprio root layout** falha. Como substitui a árvore inteira,
 * precisa declarar seu próprio `<html>`/`<body>` e NÃO pode depender
 * de providers, fontes ou componentes da app (que vivem no layout
 * que acabou de quebrar). Por isso usa estilos inline.
 *
 * Casos comuns (render do layout quebrar) são raros; o
 * {@link import("./error").default} cobre o grosso. Este existe pra
 * nunca expor a tela branca/crua do framework.
 */
export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}): React.ReactElement {
    React.useEffect(() => {
        console.error("[global-error]", {
            message: error.message,
            digest: error.digest,
        });
    }, [error]);

    return (
        <html lang="pt-BR">
            <body
                style={{
                    margin: 0,
                    minHeight: "100vh",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily:
                        "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
                    background: "#fbf9f6",
                    color: "#2a201b",
                    padding: "24px",
                }}
            >
                <div style={{ maxWidth: 420, textAlign: "center" }}>
                    <div
                        style={{
                            fontSize: 40,
                            fontWeight: 800,
                            letterSpacing: "-0.02em",
                            color: "#c5523a",
                        }}
                    >
                        privello<span style={{ color: "#ec7b5b" }}>.</span>
                    </div>
                    <h1
                        style={{
                            fontSize: 20,
                            fontWeight: 700,
                            margin: "16px 0 8px",
                        }}
                    >
                        Algo deu errado
                    </h1>
                    <p
                        style={{
                            fontSize: 14,
                            color: "#6b5d54",
                            margin: "0 0 20px",
                            lineHeight: 1.5,
                        }}
                    >
                        Tivemos um problema inesperado. Tente recarregar a
                        página.
                    </p>
                    <button
                        type="button"
                        onClick={() => reset()}
                        style={{
                            border: "none",
                            cursor: "pointer",
                            borderRadius: 999,
                            padding: "10px 20px",
                            fontSize: 14,
                            fontWeight: 600,
                            color: "#ffffff",
                            background:
                                "linear-gradient(135deg, #ec7b5b, #c5523a)",
                        }}
                    >
                        Tentar de novo
                    </button>
                </div>
            </body>
        </html>
    );
}
