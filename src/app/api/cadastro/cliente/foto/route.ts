import { NextResponse } from "next/server";

import {
    InvalidProfilePhotoError,
    stageProfilePhoto,
} from "@/server/storage/profileMedia";

/**
 * Sistema_de_Cadastro_Cliente — endpoint de staging da Foto_de_Perfil.
 *
 * Recebe um `multipart/form-data` com o campo `foto` (`File`),
 * valida MIME/tamanho via {@link stageProfilePhoto} (que reusa a regra
 * canônica `validarFotoPerfil` — Requirement 3.10 estendido ao
 * Cliente) e grava o objeto em `staged/<uuid>` no Cloudflare R2. A
 * `stagedKey` resultante é devolvida ao cliente para que a Server
 * Action de cadastro a anexe ao payload final do `<form>`.
 *
 * # Por que staging em vez de submit direto na Server Action
 *
 * Server Actions têm um limite padrão pequeno de tamanho de body
 * (1 MB) no Next.js. A foto de perfil pode chegar a 10 MB
 * (Requirement 3.10). Este endpoint dedicado aceita o upload
 * grande e devolve apenas o id opaco (`stagedKey`), que pode trafegar
 * sem problema no submit subsequente.
 *
 * # Atomicidade
 *
 * O staging só vira committed se a transação atômica de
 * `Sistema_de_Cadastro_Cliente.registrar` tiver sucesso. Em qualquer
 * falha, o staged é apagado em best-effort por `cleanupStaged`
 * (Property 15: nada de `staged/` ou `committed/` sobra para um
 * cadastro malsucedido).
 *
 * Mapeamento de respostas:
 *
 * - `200` em sucesso: `{ ok: true, stagedKey: string }`.
 * - `400` quando o `FormData` não traz um `File` válido: `{ ok: false,
 *   reason: "VALIDACAO" }`.
 * - `400` quando MIME/tamanho violam Requirement 3.10: `{ ok: false,
 *   reason: "FOTO_INVALIDA" }`.
 * - `500` em erro inesperado de R2: `{ ok: false, reason:
 *   "PERSISTENCIA" }`.
 *
 * Não exige sessão: o endpoint é parte do fluxo público de cadastro.
 * O staging é descartável (TTL implícito pela varredura de
 * `staged/<uuid>` órfãos), e a `stagedKey` opaca não autoriza nenhuma
 * outra ação além de ser anexada a um cadastro recém-criado pela
 * mesma sessão de UI.
 */
export async function POST(request: Request): Promise<NextResponse> {
    let formData: FormData;
    try {
        formData = await request.formData();
    } catch {
        return NextResponse.json(
            { ok: false, reason: "VALIDACAO" },
            { status: 400 },
        );
    }

    const file = formData.get("foto");
    if (!(file instanceof File) || file.size === 0) {
        return NextResponse.json(
            { ok: false, reason: "VALIDACAO" },
            { status: 400 },
        );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    try {
        const { stagedKey } = await stageProfilePhoto({
            mimeType: file.type,
            bytes: buffer,
        });
        return NextResponse.json(
            { ok: true, stagedKey },
            { status: 200 },
        );
    } catch (error) {
        if (error instanceof InvalidProfilePhotoError) {
            return NextResponse.json(
                { ok: false, reason: "FOTO_INVALIDA" },
                { status: 400 },
            );
        }
        return NextResponse.json(
            { ok: false, reason: "PERSISTENCIA" },
            { status: 500 },
        );
    }
}
