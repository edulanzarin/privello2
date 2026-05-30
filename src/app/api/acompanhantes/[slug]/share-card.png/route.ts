import { createHash } from "node:crypto";

import { NextResponse } from "next/server";

import { gerarShareCard } from "@/server/acompanhante-profile/shareCard";

export const runtime = "nodejs";

/**
 * `GET /api/acompanhantes/[slug]/share-card.png`
 *
 * Gera (server-side, via sharp) um card-imagem 1080×1920 do perfil
 * pra compartilhar em Instagram Story / WhatsApp Status (T11).
 *
 * # Cache
 *
 * Resposta cacheável: `Cache-Control: public, max-age=3600` +
 * `ETag` derivado de `identificador + updatedAt + verificada +
 * plano`. Quando o cliente manda `If-None-Match` igual, devolvemos
 * `304 Not Modified` sem regerar a imagem.
 *
 * # Status
 *   - 200: PNG.
 *   - 304: ETag bateu.
 *   - 404: slug não encontrado ou perfil oculto.
 *   - 500: falha de geração.
 */
export async function GET(
    request: Request,
    context: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
    const { slug } = await context.params;

    const result = await gerarShareCard(slug);

    if (!result.ok) {
        const status =
            result.reason === "NAO_ENCONTRADO" || result.reason === "OCULTO"
                ? 404
                : 500;
        return NextResponse.json({ ok: false, reason: result.reason }, {
            status,
        });
    }

    // ETag forte derivado do seed (hash curto pra header enxuto).
    const etag = `"${createHash("sha256")
        .update(result.etagSeed)
        .digest("hex")
        .slice(0, 32)}"`;

    const ifNoneMatch = request.headers.get("if-none-match");
    if (ifNoneMatch === etag) {
        return new NextResponse(null, {
            status: 304,
            headers: {
                ETag: etag,
                "Cache-Control": "public, max-age=3600",
            },
        });
    }

    return new NextResponse(new Uint8Array(result.png), {
        status: 200,
        headers: {
            "Content-Type": "image/png",
            "Cache-Control": "public, max-age=3600",
            ETag: etag,
            "Content-Length": String(result.png.byteLength),
        },
    });
}
