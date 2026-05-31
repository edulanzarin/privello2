/**
 * Sistema de Verificação de Identidade da Acompanhante.
 *
 * Fluxo:
 *
 *   1. Acompanhante envia 2 fotos: **selfie segurando o documento**
 *      e **documento isolado** (frente). Service grava em R2
 *      privado (não acessível publicamente — só admin abre).
 *   2. Admin abre `/admin/verificacoes`, vê fila de PENDENTES,
 *      compara as 2 fotos e aprova ou rejeita.
 *   3. Aprovação: `AcompanhanteProfile.verificada = true`,
 *      badge "Verificada" aparece em todos os lugares.
 *   4. Rejeição: registra `motivoRejeicao` (Acompanhante vê na
 *      própria conta) e mantém `verificada = false`.
 *
 * # Reenvio
 *
 * Cada Acompanhante tem 0 ou 1 verificação (unique constraint).
 * Reenvio (após rejeição ou pra atualizar foto) sobrescreve a
 * linha existente: status volta a `PENDENTE`, `revisadaEm/Por`
 * zeram. Mantém o `id` original — admin vê histórico simples
 * (1 pedido ativo por vez).
 *
 * # Privacidade
 *
 * - Selfie + documento ficam em chaves R2 com prefixo
 *   `private/verifications/<userId>/...`. Não passam pela rota
 *   pública `/api/storage/[...key]` (essa serve `committed/...`
 *   apenas).
 * - Acesso é restrito ao admin via endpoint dedicado
 *   `/api/admin/verificacoes/[id]/foto?tipo=selfie|documento`.
 * - Quando a verificação é aprovada/rejeitada e revisada,
 *   mantemos as imagens em R2 por 90 dias pra eventual auditoria.
 *   GC do cleanup apaga depois.
 */

import { randomUUID } from "node:crypto";

import {
    classificarMidia,
    validarGaleriaMidia,
    type GaleriaMime,
} from "@/domain/validation";
import { db } from "@/lib/db";
import { createR2Client, type R2Client } from "@/lib/storage/r2";
import { criarNotificacao } from "@/server/notifications";

// ---------------------------------------------------------------------------
// R2 client helper
// ---------------------------------------------------------------------------

let r2ClientSingleton: R2Client | null = null;
function getR2Client(): R2Client {
    if (!r2ClientSingleton) {
        r2ClientSingleton = createR2Client();
    }
    return r2ClientSingleton;
}

export function __setR2ClientForVerificationTests(
    client: R2Client | null,
): void {
    r2ClientSingleton = client;
}

const MIME_TO_EXT: Readonly<Record<GaleriaMime, string>> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "video/quicktime": "mov",
};

function buildPrivateKey(
    userId: string,
    tipo: "selfie" | "documento",
    mimeType: GaleriaMime,
): string {
    const ext = MIME_TO_EXT[mimeType];
    return `private/verifications/${userId}/${tipo}-${randomUUID()}.${ext}`;
}

// ---------------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------------

export type SubmeterVerificacaoInput = {
    userId: string;
    selfieMimeType: string;
    selfieBytes: Buffer | Uint8Array;
    documentoMimeType: string;
    documentoBytes: Buffer | Uint8Array;
    now?: Date;
};

export type SubmeterVerificacaoResult =
    | { ok: true; verificationId: string }
    | {
        ok: false;
        reason:
            | "MIDIA_INVALIDA"
            | "TIPO_INVALIDO"
            | "PERSISTENCIA";
    };

/**
 * Status atual da verificação visto pela Acompanhante (própria conta).
 */
export interface VerificacaoStatus {
    status: "PENDENTE" | "APROVADA" | "REJEITADA";
    submetidaEm: Date;
    revisadaEm: Date | null;
    motivoRejeicao: string | null;
    /**
     * Quando a verificação aprovada deixa de valer. NULL quando
     * status != APROVADA. UI pode usar pra avisar a Acompanhante
     * com antecedência.
     */
    expiraEm: Date | null;
}

// ---------------------------------------------------------------------------
// Submeter
// ---------------------------------------------------------------------------

/**
 * Acompanhante envia (ou re-envia) selfie + documento. Sobrescreve
 * pedido anterior se existir — garante que cada Acompanhante tem
 * apenas 1 pedido ativo no admin.
 *
 * Aceita apenas imagens (não vídeo). Validação MIME + tamanho via
 * `validarGaleriaMidia` (mesma da galeria).
 */
export async function submeterVerificacao(
    input: SubmeterVerificacaoInput,
): Promise<SubmeterVerificacaoResult> {
    // Valida selfie.
    const selfieSize = input.selfieBytes.byteLength;
    if (
        !validarGaleriaMidia({
            mimeType: input.selfieMimeType,
            sizeBytes: selfieSize,
        })
    ) {
        return { ok: false, reason: "MIDIA_INVALIDA" };
    }
    const selfieTipo = classificarMidia(input.selfieMimeType);
    if (selfieTipo !== "FOTO") {
        return { ok: false, reason: "TIPO_INVALIDO" };
    }
    const selfieMime = input.selfieMimeType as GaleriaMime;

    // Valida documento.
    const docSize = input.documentoBytes.byteLength;
    if (
        !validarGaleriaMidia({
            mimeType: input.documentoMimeType,
            sizeBytes: docSize,
        })
    ) {
        return { ok: false, reason: "MIDIA_INVALIDA" };
    }
    const docTipo = classificarMidia(input.documentoMimeType);
    if (docTipo !== "FOTO") {
        return { ok: false, reason: "TIPO_INVALIDO" };
    }
    const docMime = input.documentoMimeType as GaleriaMime;

    const selfieKey = buildPrivateKey(input.userId, "selfie", selfieMime);
    const docKey = buildPrivateKey(input.userId, "documento", docMime);

    // Estratégia: subir bytes em chave staged temporária e depois
    // `commit` pra path `private/...`. O R2 client local em dev
    // salva em `.storage/private/...`; em prod copia entre keys
    // do mesmo bucket. Sem watermark — material precisa ficar
    // original pra admin comparar.
    try {
        const r2 = getR2Client();
        const stagedSelfie = `staged/${randomUUID()}.${MIME_TO_EXT[selfieMime]}`;
        const stagedDoc = `staged/${randomUUID()}.${MIME_TO_EXT[docMime]}`;

        await r2.putStaged(stagedSelfie, input.selfieBytes, selfieMime);
        await r2.putStaged(stagedDoc, input.documentoBytes, docMime);
        await r2.commit(stagedSelfie, selfieKey);
        await r2.commit(stagedDoc, docKey);
    } catch {
        return { ok: false, reason: "PERSISTENCIA" };
    }

    const now = input.now ?? new Date();

    // Upsert: cria nova verificação ou sobrescreve a anterior.
    // Usamos delete + create (em vez de upsert) pra que o `id`
    // antigo não seja reaproveitado quando o admin já ter visto.
    let verificationId: string;
    try {
        // Apaga anterior (se existir).
        await db.verification.deleteMany({
            where: { userId: input.userId },
        });
        const created = await db.verification.create({
            data: {
                userId: input.userId,
                selfieStorageKey: selfieKey,
                documentoStorageKey: docKey,
                status: "PENDENTE",
                submetidaEm: now,
            },
            select: { id: true },
        });
        verificationId = created.id;
    } catch {
        return { ok: false, reason: "PERSISTENCIA" };
    }

    return { ok: true, verificationId };
}

// ---------------------------------------------------------------------------
// Status (Acompanhante vê própria conta)
// ---------------------------------------------------------------------------

/**
 * Lê o status atual da verificação de uma Acompanhante. Retorna
 * `null` quando ela nunca enviou.
 */
export async function obterStatusVerificacao(
    userId: string,
): Promise<VerificacaoStatus | null> {
    const row = await db.verification.findUnique({
        where: { userId },
        select: {
            status: true,
            submetidaEm: true,
            revisadaEm: true,
            motivoRejeicao: true,
            expiraEm: true,
        },
    });
    if (!row) return null;
    return {
        status: row.status,
        submetidaEm: row.submetidaEm,
        revisadaEm: row.revisadaEm,
        motivoRejeicao: row.motivoRejeicao,
        expiraEm: row.expiraEm,
    };
}

// ---------------------------------------------------------------------------
// Admin: lista, aprovar, rejeitar
// ---------------------------------------------------------------------------

/**
 * Item da fila de verificações vista pelo admin.
 */
export interface VerificacaoFila {
    id: string;
    userId: string;
    userIdentificador: string;
    userNome: string;
    selfieKey: string;
    documentoKey: string;
    status: "PENDENTE" | "APROVADA" | "REJEITADA";
    motivoRejeicao: string | null;
    submetidaEm: Date;
    revisadaEm: Date | null;
}

/**
 * Lista todas as verificações da fila do admin. Por default mostra
 * apenas `PENDENTE`s mais antigas primeiro (FIFO). Filtro opcional
 * por status pra histórico.
 */
export async function listarFilaVerificacoes(options: {
    status?: "PENDENTE" | "APROVADA" | "REJEITADA";
    limit?: number;
} = {}): Promise<ReadonlyArray<VerificacaoFila>> {
    const limit = Math.max(1, Math.min(200, options.limit ?? 50));
    const status = options.status ?? "PENDENTE";

    const rows = await db.verification.findMany({
        where: { status },
        orderBy: status === "PENDENTE"
            ? { submetidaEm: "asc" }
            : { revisadaEm: "desc" },
        take: limit,
        select: {
            id: true,
            userId: true,
            selfieStorageKey: true,
            documentoStorageKey: true,
            status: true,
            motivoRejeicao: true,
            submetidaEm: true,
            revisadaEm: true,
            user: {
                select: { identificador: true, nome: true },
            },
        },
    });

    return rows.map((r) => ({
        id: r.id,
        userId: r.userId,
        userIdentificador: r.user.identificador,
        userNome: r.user.nome,
        selfieKey: r.selfieStorageKey,
        documentoKey: r.documentoStorageKey,
        status: r.status,
        motivoRejeicao: r.motivoRejeicao,
        submetidaEm: r.submetidaEm,
        revisadaEm: r.revisadaEm,
    }));
}

/**
 * Janela de validade da verificação aprovada (em dias). Após esse
 * período, o cleanup noturno rebaixa `verificada` pra `false` e
 * o selo desaparece até o reenvio.
 */
const VERIFICATION_VALIDITY_DAYS = 180;

/**
 * Aprova uma verificação. Atualiza `Verification.status =
 * APROVADA` e `AcompanhanteProfile.verificada = true` em uma
 * transação. Seta também `expiraEm = now + 180d` — quando o
 * cleanup detectar a expiração, o flag `verificada` é rebaixado
 * (Acompanhante reenvia documento pra renovar).
 */
export async function aprovarVerificacao(input: {
    verificationId: string;
    adminUserId: string;
    now?: Date;
}): Promise<
    | { ok: true }
    | { ok: false; reason: "NAO_ENCONTRADA" | "PERSISTENCIA" }
> {
    const now = input.now ?? new Date();
    const expiraEm = new Date(
        now.getTime() + VERIFICATION_VALIDITY_DAYS * 24 * 60 * 60 * 1000,
    );

    const verification = await db.verification.findUnique({
        where: { id: input.verificationId },
        select: { userId: true },
    });
    if (!verification) {
        return { ok: false, reason: "NAO_ENCONTRADA" };
    }

    try {
        await db.$transaction(async (tx) => {
            await tx.verification.update({
                where: { id: input.verificationId },
                data: {
                    status: "APROVADA",
                    motivoRejeicao: null,
                    revisadaEm: now,
                    revisadaPorUserId: input.adminUserId,
                    expiraEm,
                },
            });
            await tx.acompanhanteProfile.update({
                where: { userId: verification.userId },
                data: { verificada: true },
            });
            // Notifica a Acompanhante na mesma transação (V2) — se
            // o commit falhar, a notificação some junto.
            await criarNotificacao({
                userId: verification.userId,
                type: "VERIFICACAO_APROVADA",
                payload: { expiraEm: expiraEm.toISOString() },
                client: tx,
            });
        });
    } catch {
        return { ok: false, reason: "PERSISTENCIA" };
    }
    return { ok: true };
}

/**
 * Rejeita uma verificação. Mantém `verificada = false` (caso já
 * fosse `true` por aprovação anterior, **rebaixa**). Salva o
 * motivo em texto livre pra Acompanhante ver.
 */
export async function rejeitarVerificacao(input: {
    verificationId: string;
    adminUserId: string;
    motivo: string;
    now?: Date;
}): Promise<
    | { ok: true }
    | {
        ok: false;
        reason: "NAO_ENCONTRADA" | "MOTIVO_INVALIDO" | "PERSISTENCIA";
    }
> {
    const motivo = input.motivo.trim();
    if (motivo.length === 0 || motivo.length > 500) {
        return { ok: false, reason: "MOTIVO_INVALIDO" };
    }
    const now = input.now ?? new Date();

    const verification = await db.verification.findUnique({
        where: { id: input.verificationId },
        select: { userId: true },
    });
    if (!verification) {
        return { ok: false, reason: "NAO_ENCONTRADA" };
    }

    try {
        await db.$transaction(async (tx) => {
            await tx.verification.update({
                where: { id: input.verificationId },
                data: {
                    status: "REJEITADA",
                    motivoRejeicao: motivo,
                    revisadaEm: now,
                    revisadaPorUserId: input.adminUserId,
                },
            });
            // Rebaixa caso estivesse marcada por aprovação anterior.
            await tx.acompanhanteProfile.update({
                where: { userId: verification.userId },
                data: { verificada: false },
            });
            // Notifica a Acompanhante com o motivo (V2), na mesma
            // transação.
            await criarNotificacao({
                userId: verification.userId,
                type: "VERIFICACAO_REJEITADA",
                payload: { motivo },
                client: tx,
            });
        });
    } catch {
        return { ok: false, reason: "PERSISTENCIA" };
    }
    return { ok: true };
}

// ---------------------------------------------------------------------------
// Admin: ler bytes da imagem (rota privada)
// ---------------------------------------------------------------------------

/**
 * Lê os bytes da imagem privada da verificação. Usado pelo endpoint
 * `/api/admin/verificacoes/[id]/foto?tipo=selfie|documento`.
 *
 * Retorna `null` quando não encontra ou quando o tipo é inválido.
 * Caller é responsável por verificar autorização (admin) antes
 * de chamar.
 */
export async function lerImagemVerificacao(
    verificationId: string,
    tipo: "selfie" | "documento",
): Promise<{ bytes: Uint8Array; mimeType: string } | null> {
    const row = await db.verification.findUnique({
        where: { id: verificationId },
        select: { selfieStorageKey: true, documentoStorageKey: true },
    });
    if (!row) return null;

    const key =
        tipo === "selfie" ? row.selfieStorageKey : row.documentoStorageKey;

    try {
        const r2 = getR2Client();
        const bytes = await r2.fetch(key);
        if (bytes === null) return null;
        // Inferimos MIME do extension da key.
        const ext = key.split(".").pop()?.toLowerCase() ?? "";
        const mimeType =
            ext === "jpg"
                ? "image/jpeg"
                : ext === "png"
                    ? "image/png"
                    : ext === "webp"
                        ? "image/webp"
                        : "application/octet-stream";
        return { bytes, mimeType };
    } catch {
        return null;
    }
}

// ---------------------------------------------------------------------------
// Cleanup: rebaixa verificações expiradas
// ---------------------------------------------------------------------------

/**
 * Resultado do {@link rebaixarVerificacoesExpiradas}.
 */
export interface ReverificacaoCleanupResult {
    /** Quantas verificações tiveram status APROVADA mantido mas
     *  `verificada=false` aplicado por estarem expiradas. */
    rebaixadas: number;
}

/**
 * Roda durante o cleanup noturno: encontra verificações
 * `status=APROVADA` com `expiraEm < now` e:
 *   1. Mantém `Verification.status = APROVADA` (preserva
 *      histórico — admin não precisa re-revisar).
 *   2. Limpa `expiraEm = NULL` pra não re-processar.
 *   3. Seta `acompanhante_profiles.verificada = false` —
 *      Acompanhante perde o selo até reenviar o pedido.
 *
 * UX consequente: a Acompanhante vê na aba "Verificação" um
 * estado "Verificação expirada — reenvie pra renovar".
 *
 * Idempotente: re-rodar não tem efeito porque `expiraEm = NULL`
 * sai do filtro WHERE.
 */
export async function rebaixarVerificacoesExpiradas(
    options: { now?: Date } = {},
): Promise<ReverificacaoCleanupResult> {
    const now = options.now ?? new Date();

    const expiradas = await db.verification.findMany({
        where: {
            status: "APROVADA",
            expiraEm: { lt: now, not: null },
        },
        select: { id: true, userId: true },
    });

    if (expiradas.length === 0) {
        return { rebaixadas: 0 };
    }

    let rebaixadas = 0;
    for (const v of expiradas) {
        try {
            await db.$transaction(async (tx) => {
                await tx.verification.update({
                    where: { id: v.id },
                    data: { expiraEm: null },
                });
                await tx.acompanhanteProfile.update({
                    where: { userId: v.userId },
                    data: { verificada: false },
                });
            });
            rebaixadas += 1;
        } catch {
            // Se uma falhar, segue pras próximas — cleanup
            // best-effort. Próxima rodada tenta de novo.
        }
    }

    return { rebaixadas };
}
