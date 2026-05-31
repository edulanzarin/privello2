import { createHash } from "node:crypto";

import { NextResponse } from "next/server";

import { gerarShareCityCard } from "@/server/acompanhante-profile/shareCityCard";

export const runtime = "nodejs";

/**
 * `GET /api/acompanhantes/share-city.png?cidade=...&uf=...`
 *
 * Gera (server-side, via sharp) um card-imagem 1080×1920 com
 * "N acompanhantes em [Cidade], [UF]" pra compartilhar a busca em
 * Instagram Story / WhatsApp Status (V6).
 *
 * # Cache
 *
 * Resposta cacheável: `Cache-Control: public, max-age=3600` +
 * `ETag` derivado de cidade + contagem + fotos da colagem. Quando
 * o cliente manda `If-None-Match` igual, devolvemos `304`.
 *
 * # Status
 *   - 200: PNG.
 *   - 304: ETag bateu.
 *   - 400: cidade/uf inválidos.
 *   - 404: nenhum perfil visível na cidade.
 *   - 500: falha de geração.
 */
export async function GET(request: Request): Promise<NextResponse> {
    const url = new URL(request.url);
    const cidade = url.searchParams.get("cidade") ?? "";
    const uf = url.searchParams.get("uf") ?? "";

    const result = await gerarShareCityCard({
        cidadeNome: cidade,
        estadoSigla: uf,
    });

    if (!result.ok) {
        const status =
            result.reason === "CIDADE_INVALIDA"
                ? 400
                : result.reason === "SEM_RESULTADOS"
                    ? 404
                    : 500;
        return NextResponse.json(
            { ok: false, reason: result.reason },
            { status },
        );
    }

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
