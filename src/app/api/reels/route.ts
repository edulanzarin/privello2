import { NextResponse, type NextRequest } from "next/server";

import { getCurrentSession } from "@/server/auth/currentSession";
import { obterPerfilCliente } from "@/server/cliente-profile";
import { listarFeedReels } from "@/server/storage/reelMedia";

/**
 * `GET /api/reels?cidade=&uf=&cursor=` — feed paginado de Reels.
 *
 * Anônimo / Cliente / Acompanhante — todos podem consumir. O
 * algoritmo (em `listarFeedReels`) prioriza:
 *
 *   1. Cidade do viewer (vindo da query string ou geo-IP futuro).
 *   2. Boost ativo do dono.
 *   3. Plano Premium do dono.
 *   4. Frescor (decay 7 dias).
 *   5. Não-vistos pelo viewer.
 *
 * Query params:
 *   - `cidade`, `uf`: localização preferida (UF case-insensitive).
 *     Quando ausentes, fallback é "global" (sem boost geográfico).
 *   - `cursor`: ID do último Reel da página anterior (paginação
 *     opaca por slot).
 *   - `limit`: tamanho da página (default 10, max 50).
 *
 * Response:
 *
 * ```json
 * {
 *   "ok": true,
 *   "items": [...],
 *   "nextCursor": "<reel-id>" | null
 * }
 * ```
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
    const url = request.nextUrl;
    const cidade = url.searchParams.get("cidade");
    const uf = url.searchParams.get("uf");
    const cursor = url.searchParams.get("cursor");
    const limitRaw = url.searchParams.get("limit");
    const limit = limitRaw ? Number.parseInt(limitRaw, 10) : undefined;

    const session = await getCurrentSession();

    // Quando o viewer é Cliente sem cidade definida na query string,
    // futuramente podemos tentar pegar do perfil. Por ora ele só
    // entra com `?cidade=&uf=` explicitamente.
    void session; // mantido pra extensão futura

    const result = await listarFeedReels({
        viewerUserId: session?.userId ?? null,
        cidadeNome: cidade ?? null,
        estadoSigla: uf ?? null,
        cursorReelId: cursor ?? null,
        limit,
    });

    return NextResponse.json({
        ok: true,
        items: result.items,
        nextCursor: result.nextCursor,
    });
}
