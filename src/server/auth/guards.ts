import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { resolveSession, verifySessionCookie } from "@/server/auth/sessions";
import { obterVigente } from "@/server/planos";
import type { PlanoDefinition } from "@/domain/plano/definitions";

/**
 * Guards de autorização para route handlers (`/api/...`).
 *
 * Substitui os blocos repetidos de `cookies()` + `verifySessionCookie`
 * + `resolveSession` + `if (!session) return NextResponse.json(...)`
 * que apareciam em quase todos os endpoints. Cada guard retorna **ou**
 * `{ ok: true, ... }` (resultado tipado pra ser desestruturado pelo
 * caller) **ou** `{ ok: false, response: NextResponse }` (resposta
 * pronta pra ser devolvida).
 *
 * Padrão de uso:
 *
 *   const auth = await requireAcompanhante();
 *   if (!auth.ok) return auth.response;
 *   const { userId } = auth;
 *
 * Mapeamento de respostas idêntico ao que cada endpoint já fazia
 * manualmente. Mudar uma mensagem aqui propaga pra todos os
 * consumidores — fonte única de verdade.
 */

export type SessionResolved = {
    userId: string;
    userType: "CLIENTE" | "ACOMPANHANTE";
};

type GuardOk<T> = { ok: true } & T;
type GuardFail = { ok: false; response: NextResponse };
type GuardResult<T> = GuardOk<T> | GuardFail;

/**
 * Resolve a sessão atual via cookie. Retorna 401 quando o cookie está
 * ausente, inválido, expirado ou revogado.
 */
export async function requireSession(): Promise<GuardResult<SessionResolved>> {
    const cookieStore = await cookies();
    const sessionId = await verifySessionCookie(
        cookieStore.get("sessionId")?.value,
    );
    if (!sessionId) {
        return {
            ok: false,
            response: NextResponse.json(
                { ok: false, reason: "NAO_AUTENTICADO" },
                { status: 401 },
            ),
        };
    }
    const session = await resolveSession(sessionId);
    if (!session) {
        return {
            ok: false,
            response: NextResponse.json(
                { ok: false, reason: "NAO_AUTENTICADO" },
                { status: 401 },
            ),
        };
    }
    return {
        ok: true,
        userId: session.userId,
        userType: session.userType,
    };
}

/**
 * Resolve a sessão e exige que o usuário seja `ACOMPANHANTE`.
 * Retorna 403 (`TIPO_INVALIDO`) caso contrário.
 */
export async function requireAcompanhante(): Promise<
    GuardResult<{ userId: string }>
> {
    const auth = await requireSession();
    if (!auth.ok) return auth;
    if (auth.userType !== "ACOMPANHANTE") {
        return {
            ok: false,
            response: NextResponse.json(
                { ok: false, reason: "TIPO_INVALIDO" },
                { status: 403 },
            ),
        };
    }
    return { ok: true, userId: auth.userId };
}

/**
 * Garante sessão válida + `userType === "CLIENTE"`. Usado por
 * endpoints exclusivos de Cliente (avaliações, reservas, etc).
 * Retorna 403 (`TIPO_INVALIDO`) quando o usuário autenticado é uma
 * Acompanhante.
 */
export async function requireCliente(): Promise<
    GuardResult<{ userId: string }>
> {
    const auth = await requireSession();
    if (!auth.ok) return auth;
    if (auth.userType !== "CLIENTE") {
        return {
            ok: false,
            response: NextResponse.json(
                { ok: false, reason: "TIPO_INVALIDO" },
                { status: 403 },
            ),
        };
    }
    return { ok: true, userId: auth.userId };
}

/**
 * `requireCliente` + verificação de `planoVigente === "FAN"`.
 *
 * Usado em endpoints de interações premium (curtidas, comentários).
 * Cliente Grátis recebe 402 com `reason: "PLANO_REQUERIDO"` —
 * a UI redireciona pra `/cliente/selecao-plano` quando ver isso.
 */
export async function requireClienteFan(): Promise<
    GuardResult<{ userId: string }>
> {
    const auth = await requireCliente();
    if (!auth.ok) return auth;

    const profile = await db.clientProfile.findUnique({
        where: { userId: auth.userId },
        select: { planoVigente: true },
    });

    if (profile?.planoVigente !== "FAN") {
        return {
            ok: false,
            response: NextResponse.json(
                { ok: false, reason: "PLANO_REQUERIDO" },
                { status: 402 },
            ),
        };
    }

    return { ok: true, userId: auth.userId };
}

/**
 * Opções de `requireAcompanhanteWithPlano`. Permite exigir benefícios
 * específicos do plano vigente (ex.: `permiteAudio` para o endpoint de
 * Áudio_de_Apresentação).
 */
export type RequireAcompanhantePlanoOptions = {
    /** Quando `true`, exige `plano.permiteAudio`. */
    permiteAudio?: boolean;
    /** Quando `true`, exige `plano.permiteStories`. */
    permiteStories?: boolean;
};

/**
 * Combina `requireAcompanhante` + `obterVigente`. Retorna:
 *
 * - 409 (`SEM_PLANO`) quando a Acompanhante ainda não selecionou plano.
 * - 403 (`PLANO_INVALIDO`) quando o plano vigente não atende às
 *   exigências do endpoint (ex.: `permiteAudio`).
 *
 * Em sucesso, devolve `userId` e `plano` já resolvido.
 */
export async function requireAcompanhanteWithPlano(
    options: RequireAcompanhantePlanoOptions = {},
): Promise<GuardResult<{ userId: string; plano: PlanoDefinition }>> {
    const auth = await requireAcompanhante();
    if (!auth.ok) return auth;

    const plano = await obterVigente(auth.userId);
    if (plano === null) {
        return {
            ok: false,
            response: NextResponse.json(
                { ok: false, reason: "SEM_PLANO" },
                { status: 409 },
            ),
        };
    }

    if (options.permiteAudio && !plano.permiteAudio) {
        return {
            ok: false,
            response: NextResponse.json(
                { ok: false, reason: "PLANO_INVALIDO" },
                { status: 403 },
            ),
        };
    }
    if (options.permiteStories && !plano.permiteStories) {
        return {
            ok: false,
            response: NextResponse.json(
                { ok: false, reason: "PLANO_INVALIDO" },
                { status: 403 },
            ),
        };
    }

    return { ok: true, userId: auth.userId, plano };
}

/**
 * Lê o FormData da request e valida que o campo `fieldName` é um
 * `File` não-vazio. Retorna 400 (`VALIDACAO`) caso contrário.
 *
 * Não lança — captura `request.formData()` em try/catch porque
 * payloads malformados podem estourar antes mesmo do parsing
 * interno do Next.
 */
export async function requireFile(
    request: Request,
    fieldName: string,
): Promise<GuardResult<{ file: File; formData: FormData }>> {
    let formData: FormData;
    try {
        formData = await request.formData();
    } catch {
        return {
            ok: false,
            response: NextResponse.json(
                { ok: false, reason: "VALIDACAO" },
                { status: 400 },
            ),
        };
    }

    const file = formData.get(fieldName);
    if (!(file instanceof File) || file.size === 0) {
        return {
            ok: false,
            response: NextResponse.json(
                { ok: false, reason: "VALIDACAO" },
                { status: 400 },
            ),
        };
    }

    return { ok: true, file, formData };
}
