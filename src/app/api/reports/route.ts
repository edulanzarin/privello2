import { NextResponse } from "next/server";

import { requireSession } from "@/server/auth/guards";
import {
    criarReport,
    type ReportMotivo,
    type ReportTargetType,
} from "@/server/reports";

export const runtime = "nodejs";

const MOTIVOS_VALIDOS: ReadonlySet<ReportMotivo> = new Set([
    "CONTEUDO_FALSO",
    "MENOR_DE_IDADE",
    "ASSEDIO",
    "GOLPE",
    "SPAM",
    "OUTRO",
]);

const TARGETS_VALIDOS: ReadonlySet<ReportTargetType> = new Set([
    "USER",
    "MEDIA",
    "COMMENT",
    "REVIEW",
]);

/**
 * `POST /api/reports` — qualquer usuário logado denuncia um alvo.
 *
 * Body JSON:
 * ```
 * {
 *   targetType: "USER" | "MEDIA" | "COMMENT" | "REVIEW",
 *   targetId: string (uuid),
 *   motivo: ReportMotivo,
 *   descricao?: string (≤ 2000)
 * }
 * ```
 *
 * Mapeamento:
 * - `200`: `{ ok: true, reportId }`.
 * - `400`: `VALIDACAO | DESCRICAO_INVALIDA`.
 * - `401`: `NAO_AUTENTICADO`.
 * - `404`: `ALVO_NAO_ENCONTRADO`.
 * - `500`: `PERSISTENCIA`.
 */
export async function POST(request: Request): Promise<NextResponse> {
    const auth = await requireSession(request);
    if (!auth.ok) return auth.response;

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json(
            { ok: false, reason: "VALIDACAO" },
            { status: 400 },
        );
    }

    if (!body || typeof body !== "object") {
        return NextResponse.json(
            { ok: false, reason: "VALIDACAO" },
            { status: 400 },
        );
    }
    const b = body as Record<string, unknown>;

    const targetType = b.targetType;
    const targetId = b.targetId;
    const motivo = b.motivo;
    const descricao = b.descricao;

    if (
        typeof targetType !== "string" ||
        !TARGETS_VALIDOS.has(targetType as ReportTargetType)
    ) {
        return NextResponse.json(
            { ok: false, reason: "VALIDACAO" },
            { status: 400 },
        );
    }
    if (typeof targetId !== "string" || targetId.length === 0) {
        return NextResponse.json(
            { ok: false, reason: "VALIDACAO" },
            { status: 400 },
        );
    }
    if (
        typeof motivo !== "string" ||
        !MOTIVOS_VALIDOS.has(motivo as ReportMotivo)
    ) {
        return NextResponse.json(
            { ok: false, reason: "VALIDACAO" },
            { status: 400 },
        );
    }
    const descricaoFinal =
        typeof descricao === "string" ? descricao : null;

    const result = await criarReport({
        reporterUserId: auth.userId,
        targetType: targetType as ReportTargetType,
        targetId,
        motivo: motivo as ReportMotivo,
        descricao: descricaoFinal,
    });

    if (result.ok) return NextResponse.json(result, { status: 200 });

    if (result.reason === "ALVO_NAO_ENCONTRADO") {
        return NextResponse.json(result, { status: 404 });
    }
    if (result.reason === "DESCRICAO_INVALIDA") {
        return NextResponse.json(result, { status: 400 });
    }
    return NextResponse.json(result, { status: 500 });
}
