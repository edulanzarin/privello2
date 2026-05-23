/**
 * Helpers compartilhados para a Foto_de_Perfil.
 *
 * Concentra as operações comuns entre os fluxos de Cliente e Acompanhante
 * que envolvem o upload e a promoção de uma Foto_de_Perfil em Cloudflare R2.
 * Mantém:
 *
 *   - {@link MIME_TO_EXT}: tradução determinística entre o `mimeType`
 *     validado por {@link validarFotoPerfil} e a extensão da chave final
 *     em R2 (`committed/<userId>/profile.<ext>`). Reusada por
 *     `Sistema_de_Onboarding.finalizar` e por
 *     `Sistema_de_Cadastro_Cliente.registrar` para que o formato da
 *     chave seja idêntico nos dois caminhos.
 *
 *   - {@link buildProfileKey}: derivação canônica da chave final, evitando
 *     que cada serviço re-implemente o template de string.
 *
 *   - {@link stageProfilePhoto}: valida o arquivo (MIME e tamanho via o
 *     mesmo {@link validarFotoPerfil} consumido pelos schemas) e grava em
 *     `staged/<uuid>` no R2. É a versão genérica/sem-draft do
 *     `uploadFoto` do onboarding — usada pelo cadastro de Cliente, onde
 *     não há `OnboardingDraft` para anexar a chave.
 *
 *   - {@link commitProfilePhoto}: copia o staged para a chave final e
 *     apaga o staged, com até duas tentativas. Em caso de falha,
 *     marca a `Media` como `PENDING_REPAIR` em best-effort. É a
 *     versão extraída do pós-commit de `finalizar`, agora reaproveitada
 *     também pelo cadastro de Cliente.
 *
 * Requirements: 3.10 (validação MIME/tamanho), 7.7 (R2 confinado em
 * `src/lib/storage/r2.ts`).
 */

import { randomUUID } from "node:crypto";

import {
    validarFotoPerfil,
    type FotoPerfilMime,
} from "@/domain/validation";
import { db } from "@/lib/db";
import { createR2Client, type R2Client } from "@/lib/storage/r2";

/**
 * Mapeamento determinístico entre o `mimeType` da Foto_de_Perfil (já
 * validado por {@link validarFotoPerfil}) e a extensão usada na chave
 * final em R2.
 */
export const MIME_TO_EXT: Readonly<Record<FotoPerfilMime, string>> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
};

/**
 * Constrói a chave final de Foto_de_Perfil para um usuário.
 *
 * Formato: `committed/<userId>/profile.<ext>` — espelhando o padrão
 * documentado em `design.md` (Sistema_de_Onboarding → "Atomicidade do
 * Onboarding").
 */
export function buildProfileKey(userId: string, mimeType: FotoPerfilMime): string {
    return `committed/${userId}/profile.${MIME_TO_EXT[mimeType]}`;
}

// ---------------------------------------------------------------------------
// R2 client (lazy + test seam)
// ---------------------------------------------------------------------------

let r2ClientSingleton: R2Client | null = null;

function getR2Client(): R2Client {
    if (!r2ClientSingleton) {
        r2ClientSingleton = createR2Client();
    }
    return r2ClientSingleton;
}

/**
 * Test-only seam que substitui o `R2Client` usado pelos helpers de mídia
 * de perfil. Passe `null` para forçar a próxima chamada a reconstruir o
 * cliente a partir de `process.env`. Código de produção NÃO deve invocar.
 */
export function __setR2ClientForTests(client: R2Client | null): void {
    r2ClientSingleton = client;
}

// ---------------------------------------------------------------------------
// Erros
// ---------------------------------------------------------------------------

/**
 * Lançado por {@link stageProfilePhoto} quando o arquivo recebido falha
 * na verificação de MIME ou tamanho. Reusa o mesmo código de erro
 * `INVALID_FOTO_PERFIL` do `Sistema_de_Onboarding` para que o consumidor
 * trate ambos os caminhos com a mesma mensagem amigável.
 */
export class InvalidProfilePhotoError extends Error {
    public readonly code = "INVALID_FOTO_PERFIL" as const;

    constructor() {
        super(
            "Foto de perfil inválida: MIME deve ser image/jpeg, image/png ou image/webp e o tamanho deve ser ≤ 10 MB.",
        );
        this.name = "InvalidProfilePhotoError";
    }
}

// ---------------------------------------------------------------------------
// Stage
// ---------------------------------------------------------------------------

/**
 * Valida o arquivo (MIME e tamanho) sem subir pra R2. Permite que
 * fluxos que vão delegar o staging para outro helper (ex.:
 * `replaceUserMediaSlot`) façam só a validação aqui sem efeitos
 * colaterais. O cadastro/onboarding usa o `stageProfilePhoto`
 * abaixo, que combina validação + staging em uma chamada.
 *
 * @throws {InvalidProfilePhotoError} quando MIME ou tamanho violam o
 *   contrato canônico (Requirement 3.10).
 */
export function validateProfilePhotoOrThrow(file: {
    mimeType: string;
    bytes: Uint8Array | Buffer;
}): { mimeType: FotoPerfilMime; sizeBytes: number } {
    const sizeBytes = file.bytes.byteLength;
    if (!validarFotoPerfil({ mimeType: file.mimeType, sizeBytes })) {
        throw new InvalidProfilePhotoError();
    }
    return {
        mimeType: file.mimeType as FotoPerfilMime,
        sizeBytes,
    };
}

/**
 * Valida o arquivo e grava em `staged/<uuid>` no R2.
 *
 * Diferente do {@link import("@/server/onboarding").uploadFoto}, esta
 * função **não** está vinculada a um `OnboardingDraft`: a `stagedKey`
 * retornada deve ser carregada pela camada chamadora (cookie, hidden
 * input, etc.) até a transação atômica de cadastro promover o objeto via
 * {@link commitProfilePhoto}. Isso é o que permite reutilizá-la no
 * cadastro de Cliente (que é single-page e não tem draft).
 *
 * @throws {InvalidProfilePhotoError} quando MIME ou tamanho violam o
 *   contrato canônico (Requirement 3.10).
 */
export async function stageProfilePhoto(file: {
    mimeType: string;
    bytes: Uint8Array | Buffer;
}): Promise<{ stagedKey: string; mimeType: FotoPerfilMime; sizeBytes: number }> {
    const { mimeType, sizeBytes } = validateProfilePhotoOrThrow(file);

    const stagedKey = `staged/${randomUUID()}`;
    await getR2Client().putStaged(stagedKey, file.bytes, file.mimeType);

    return {
        stagedKey,
        mimeType,
        sizeBytes,
    };
}

// ---------------------------------------------------------------------------
// Commit
// ---------------------------------------------------------------------------

/**
 * Promove um objeto staged para a chave final em R2.
 *
 * Tenta o ciclo `commit + delete` até duas vezes. Se ainda falhar,
 * atualiza `Media.status = PENDING_REPAIR` em best-effort para que a
 * conciliação periódica reaproveite e a foto não seja exibida com chave
 * inexistente. Erros aqui **não** falham a operação chamadora porque a
 * transação SQL é a fonte de verdade do estado lógico do cadastro
 * (vide design.md → "Atomicidade do Onboarding (detalhe)").
 *
 * @returns `true` se a promoção em R2 teve sucesso; `false` caso contrário.
 */
export async function commitProfilePhoto(args: {
    stagedKey: string;
    finalKey: string;
    mediaId: string;
}): Promise<boolean> {
    const { stagedKey, finalKey, mediaId } = args;
    const r2 = getR2Client();

    let r2Ok = false;
    for (let attempt = 0; attempt < 2 && !r2Ok; attempt++) {
        try {
            await r2.commit(stagedKey, finalKey);
            await r2.deleteObject(stagedKey);
            r2Ok = true;
        } catch {
            // Próxima iteração tenta novamente; após a segunda falha,
            // caímos no ramo de PENDING_REPAIR abaixo.
        }
    }

    if (!r2Ok) {
        try {
            await db.media.update({
                where: { id: mediaId },
                data: { status: "PENDING_REPAIR" },
            });
        } catch {
            // Best-effort: se o update falhar, a próxima execução do
            // reparo idempotente cuida disso.
        }
    }

    return r2Ok;
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

/**
 * Apaga um objeto staged em best-effort. Usado quando uma transação
 * falha após o staging ter ocorrido (Property 15: nada de `staged/` ou
 * `committed/` sobra para o cadastro malsucedido).
 */
export async function cleanupStaged(stagedKey: string): Promise<void> {
    try {
        await getR2Client().deleteObject(stagedKey);
    } catch {
        // Best-effort: a varredura periódica reaproveita.
    }
}
