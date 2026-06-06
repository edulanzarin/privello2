import { ImageResponse } from "next/og";

/**
 * Open Graph image dinâmica da home (`/`).
 *
 * O Next gera essa imagem automaticamente em build/runtime e a serve
 * em `/opengraph-image` com `Content-Type: image/png`. Quando alguém
 * compartilha `https://www.privello.com.br` no WhatsApp/X/Telegram, o
 * card de preview usa essa imagem em vez do ícone genérico.
 *
 * Tamanho 1200×630 é o padrão recomendado pelo Open Graph (proporção
 * 1.91:1) — funciona em todas as redes.
 *
 * Sem import de fonte: `next/og` usa fonte de sistema por padrão
 * (basta declarar via CSS); evita download externo no edge runtime.
 */

export const runtime = "edge";

export const alt = "Privello — Acompanhantes verificadas no Brasil";

export const size = {
    width: 1200,
    height: 630,
};

export const contentType = "image/png";

export default async function OpenGraphImage(): Promise<Response> {
    return new ImageResponse(
        (
            <div
                style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    justifyContent: "center",
                    padding: "80px",
                    background:
                        "linear-gradient(135deg, #1a1410 0%, #2a1f1a 50%, #c5523a 100%)",
                    color: "#fbf9f6",
                    fontFamily: "system-ui, -apple-system, sans-serif",
                }}
            >
                {/* Logo mark — círculo com chama */}
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "16px",
                        marginBottom: "48px",
                    }}
                >
                    <div
                        style={{
                            width: "64px",
                            height: "64px",
                            borderRadius: "50%",
                            background:
                                "linear-gradient(135deg, #ec7b5b 0%, #c5523a 100%)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "36px",
                        }}
                    >
                        🔥
                    </div>
                    <div
                        style={{
                            fontSize: "44px",
                            fontWeight: 700,
                            letterSpacing: "-0.02em",
                        }}
                    >
                        Privello
                    </div>
                </div>

                {/* Headline */}
                <div
                    style={{
                        fontSize: "76px",
                        fontWeight: 700,
                        lineHeight: 1.05,
                        letterSpacing: "-0.03em",
                        maxWidth: "950px",
                    }}
                >
                    Acompanhantes verificadas no Brasil
                </div>

                {/* Subtitle */}
                <div
                    style={{
                        marginTop: "28px",
                        fontSize: "30px",
                        fontWeight: 400,
                        opacity: 0.85,
                        maxWidth: "880px",
                        lineHeight: 1.3,
                    }}
                >
                    Perfis com fotos, vídeos e áudio. Privacidade,
                    transparência e contato direto.
                </div>

                {/* Domain pill no canto */}
                <div
                    style={{
                        position: "absolute",
                        bottom: "60px",
                        right: "80px",
                        padding: "12px 24px",
                        borderRadius: "999px",
                        background: "rgba(251, 249, 246, 0.12)",
                        border: "1px solid rgba(251, 249, 246, 0.24)",
                        fontSize: "22px",
                        fontWeight: 500,
                        letterSpacing: "0.02em",
                        display: "flex",
                    }}
                >
                    privello.com.br
                </div>
            </div>
        ),
        size,
    );
}
