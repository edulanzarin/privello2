import { NextResponse } from "next/server";

import { requireAcompanhante, requireFile } from "@/server/auth/guards";
import { enforceRateLimit, LIMITS } from "@/server/auth/rateLimitGuard";
import { submeterVerificacao } from "@/server/verification";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * `POST /api/verificacao` — Acompanhante envia (ou re-envia)
 * pedido de verificação de identidade.
 *
 * Aceita `multipart/form-data` com:
 *   - `selfie` (`File`): selfie segurando o documento.
 *   - `documento` (`File`): foto do documento isolado.
 *
 * Mapeamento de respostas:
 * - `200`: `{ ok: true, verificationId }`.
 * - `401`: `NAO_AUTENTICADO`.
 * - `403`: `TIPO_INVALIDO` (não é Acompanhante).
 * - `400`: `MIDIA_INVALIDA | TIPO_INVALIDO | VALIDACAO`.
 * - `500`: `PERSISTENCIA`.
 */
export async function POST(request: Request): Promise<NextResponse> {
    const auth = await requireAcompanhante(request);
    if (!auth.ok) return auth.response;

    const rl = enforceRateLimit("verification", auth.userId, LIMITS.verification);
    if (rl) return rl;

    // formData só pode ser parseada uma vez — usamos `requireFile`
    // pra `selfie` e depois pegamos `documento` do mesmo formData.
    const selfieGuard = await requireFile(request, "selfie");
    if (!selfieGuard.ok) return selfieGuard.response;

    const documentoFile = selfieGuard.formData.get("documento");
    if (!(documentoFile instanceof File) || documentoFile.size === 0) {
        return NextResponse.json(
            { ok: false, reason: "VALIDACAO" },
            { status: 400 },
        );
    }

    const selfieBytes = Buffer.from(await selfieGuard.file.arrayBuffer());
    const docBytes = Buffer.from(await documentoFile.arrayBuffer());

    const result = await submeterVerificacao({
        userId: auth.userId,
        selfieMimeType: selfieGuard.file.type,
        selfieBytes,
        documentoMimeType: documentoFile.type,
        documentoBytes: docBytes,
    });

    if (result.ok) {
        return NextResponse.json(result, { status: 200 });
    }
    if (
        result.reason === "MIDIA_INVALIDA" ||
        result.reason === "TIPO_INVALIDO"
    ) {
        return NextResponse.json(result, { status: 400 });
    }
    return NextResponse.json(result, { status: 500 });
}
