import { ImageResponse } from "next/og";

import {
    resolverCidadePorSlug,
} from "@/domain/busca/citySlug";
import { listarTodasCidadesComPerfis } from "@/server/acompanhante-profile/feed";

/**
 * Open Graph image dinâmica das landings de cidade
 * (`/acompanhantes/cidade/[uf]/[cidade]`).
 *
 * Cada cidade ganha sua própria OG image gerada em runtime,
 * destacando o nome da cidade + UF. Quando alguém compartilha o
 * link no WhatsApp/X, o card de preview tem peso visual e
 * comunica imediatamente o que vai encontrar.
 *
 * Usa runtime Node (não edge) pra poder consultar o Prisma e
 * resolver a cidade pelo slug.
 */

// Mantém o runtime alinhado com a página pra dividir o cache do
// Prisma client. Edge não consegue acessar o banco.
export const runtime = "nodejs";

export const alt = "Acompanhantes verificadas — Privello";

export const size = {
    width: 1200,
    height: 630,
};

export const contentType = "image/png";

interface RouteParams {
    uf: string;
    cidade: string;
}

export default async function OpenGraphImage({
    params,
}: {
    params: RouteParams;
}): Promise<Response> {
    let cidadeNome = "Brasil";
    let estadoSigla = "BR";
    try {
        const candidatas = await listarTodasCidadesComPerfis({ limit: 5000 });
        const resolved = resolverCidadePorSlug(
            params.uf,
            params.cidade,
            candidatas,
        );
        if (resolved) {
            cidadeNome = resolved.cidadeNome;
            estadoSigla = resolved.estadoSigla;
        }
    } catch {
        // Fallback genérico — melhor que nenhuma OG image.
    }

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
                {/* Marca */}
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "16px",
                        marginBottom: "40px",
                    }}
                >
                    <div
                        style={{
                            width: "56px",
                            height: "56px",
                            borderRadius: "50%",
                            background:
                                "linear-gradient(135deg, #ec7b5b 0%, #c5523a 100%)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "30px",
                        }}
                    >
                        🔥
                    </div>
                    <div
                        style={{
                            fontSize: "36px",
                            fontWeight: 700,
                            letterSpacing: "-0.02em",
                        }}
                    >
                        Privello
                    </div>
                </div>

                {/* Eyebrow */}
                <div
                    style={{
                        fontSize: "26px",
                        fontWeight: 500,
                        opacity: 0.75,
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        marginBottom: "12px",
                    }}
                >
                    Acompanhantes verificadas em
                </div>

                {/* Cidade — destaque máximo */}
                <div
                    style={{
                        fontSize: "92px",
                        fontWeight: 700,
                        lineHeight: 1.0,
                        letterSpacing: "-0.04em",
                        maxWidth: "1000px",
                    }}
                >
                    {cidadeNome}, {estadoSigla}
                </div>

                {/* Subtitle */}
                <div
                    style={{
                        marginTop: "32px",
                        fontSize: "28px",
                        fontWeight: 400,
                        opacity: 0.85,
                        maxWidth: "880px",
                        lineHeight: 1.3,
                    }}
                >
                    Perfis com fotos, vídeos e áudio. Contato direto
                    pelo WhatsApp.
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
                        fontSize: "20px",
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
