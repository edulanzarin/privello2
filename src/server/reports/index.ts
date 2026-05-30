/**
 * Sistema de Denúncias.
 *
 * Qualquer usuário logado pode denunciar:
 *
 * - Um perfil (`USER`): perfil de Acompanhante ou Cliente.
 * - Uma mídia (`MEDIA`): foto, vídeo, story ou reel.
 * - Um comentário (`COMMENT`): comment em mídia.
 * - Uma avaliação (`REVIEW`): review de Acompanhante.
 *
 * Cada denúncia gera uma linha em `reports`. Admin abre `/admin`
 * e tria a fila — pode `RESOLVIDA` (com nota) ou `DESCARTADA`.
 *
 * # Autoria & limites
 *
 * - Mesmo usuário pode denunciar o mesmo alvo várias vezes (sem
 *   constraint unique). Em prod podemos adicionar rate-limit
 *   pra evitar spam — por ora confiamos no botão UI desabilitar
 *   após o envio.
 * - Não validamos FK: `targetId` é polimórfico (Prisma não tem
 *   polymorphic relations). Service valida existência do alvo
 *   no momento da criação pra evitar denúncias contra ids
 *   inválidos.
 */

import { db } from "@/lib/db";

// ---------------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------------

export type ReportTargetType = "USER" | "MEDIA" | "COMMENT" | "REVIEW";

export type ReportMotivo =
    | "CONTEUDO_FALSO"
    | "MENOR_DE_IDADE"
    | "ASSEDIO"
    | "GOLPE"
    | "SPAM"
    | "OUTRO";

export type ReportStatus = "PENDENTE" | "RESOLVIDA" | "DESCARTADA";

export type CriarReportInput = {
    reporterUserId: string;
    targetType: ReportTargetType;
    targetId: string;
    motivo: ReportMotivo;
    descricao?: string | null;
    now?: Date;
};

export type CriarReportResult =
    | { ok: true; reportId: string }
    | {
        ok: false;
        reason:
            | "ALVO_NAO_ENCONTRADO"
            | "DESCRICAO_INVALIDA"
            | "JA_DENUNCIADO"
            | "PERSISTENCIA";
    };

/**
 * Item da fila de denúncias visto pelo admin.
 */
export interface ReportFila {
    id: string;
    reporterUserId: string;
    reporterIdentificador: string;
    reporterNome: string;
    targetType: ReportTargetType;
    targetId: string;
    motivo: ReportMotivo;
    descricao: string | null;
    status: ReportStatus;
    resolucao: string | null;
    criadaEm: Date;
    resolvidaEm: Date | null;
}

// ---------------------------------------------------------------------------
// Validação de alvo
// ---------------------------------------------------------------------------

/**
 * Confirma que o `targetId` existe no domínio correspondente.
 * Não valida ownership (qualquer usuário pode denunciar qualquer
 * alvo) — só existência.
 */
async function alvoExiste(
    targetType: ReportTargetType,
    targetId: string,
): Promise<boolean> {
    switch (targetType) {
        case "USER": {
            const u = await db.user.findUnique({
                where: { id: targetId },
                select: { id: true },
            });
            return u !== null;
        }
        case "MEDIA": {
            const m = await db.media.findUnique({
                where: { id: targetId },
                select: { id: true },
            });
            return m !== null;
        }
        case "COMMENT": {
            const c = await db.mediaComment.findUnique({
                where: { id: targetId },
                select: { id: true },
            });
            return c !== null;
        }
        case "REVIEW": {
            const r = await db.acompanhanteReview.findUnique({
                where: { id: targetId },
                select: { id: true },
            });
            return r !== null;
        }
    }
}

// ---------------------------------------------------------------------------
// Criar denúncia
// ---------------------------------------------------------------------------

/**
 * Cria uma denúncia. Valida descrição (≤ 2000 chars) e existência
 * do alvo. Não bloqueia auto-denúncia (caller decide se filtra).
 */
export async function criarReport(
    input: CriarReportInput,
): Promise<CriarReportResult> {
    const descricao = input.descricao?.trim() ?? null;
    if (descricao !== null && descricao.length > 2000) {
        return { ok: false, reason: "DESCRICAO_INVALIDA" };
    }
    const descricaoFinal = descricao && descricao.length > 0 ? descricao : null;

    const exists = await alvoExiste(input.targetType, input.targetId);
    if (!exists) {
        return { ok: false, reason: "ALVO_NAO_ENCONTRADO" };
    }

    try {
        const created = await db.report.create({
            data: {
                reporterUserId: input.reporterUserId,
                targetType: input.targetType,
                targetId: input.targetId,
                motivo: input.motivo,
                descricao: descricaoFinal,
                status: "PENDENTE",
                criadaEm: input.now ?? new Date(),
            },
            select: { id: true },
        });
        return { ok: true, reportId: created.id };
    } catch (err) {
        // Detecta violação do unique parcial (já existe denúncia
        // PENDENTE do mesmo reporter pro mesmo target). Prisma
        // emite `P2002` em conflitos de constraint unique.
        if (
            err !== null &&
            typeof err === "object" &&
            "code" in err &&
            (err as { code?: unknown }).code === "P2002"
        ) {
            return { ok: false, reason: "JA_DENUNCIADO" };
        }
        return { ok: false, reason: "PERSISTENCIA" };
    }
}

// ---------------------------------------------------------------------------
// Admin: listar fila
// ---------------------------------------------------------------------------

/**
 * Lista denúncias na fila do admin. Por default mostra apenas
 * `PENDENTE`s mais antigas primeiro (FIFO). Suporta filtro por
 * status e paginação simples por offset.
 */
export async function listarFilaReports(options: {
    status?: ReportStatus;
    limit?: number;
    offset?: number;
} = {}): Promise<ReadonlyArray<ReportFila>> {
    const limit = Math.max(1, Math.min(200, options.limit ?? 50));
    const offset = Math.max(0, options.offset ?? 0);
    const status = options.status ?? "PENDENTE";

    const rows = await db.report.findMany({
        where: { status },
        orderBy: status === "PENDENTE"
            ? { criadaEm: "asc" }
            : { resolvidaEm: "desc" },
        skip: offset,
        take: limit,
        select: {
            id: true,
            reporterUserId: true,
            targetType: true,
            targetId: true,
            motivo: true,
            descricao: true,
            status: true,
            resolucao: true,
            criadaEm: true,
            resolvidaEm: true,
            reporter: {
                select: { identificador: true, nome: true },
            },
        },
    });

    return rows.map((r) => ({
        id: r.id,
        reporterUserId: r.reporterUserId,
        reporterIdentificador: r.reporter.identificador,
        reporterNome: r.reporter.nome,
        targetType: r.targetType,
        targetId: r.targetId,
        motivo: r.motivo,
        descricao: r.descricao,
        status: r.status,
        resolucao: r.resolucao,
        criadaEm: r.criadaEm,
        resolvidaEm: r.resolvidaEm,
    }));
}

// ---------------------------------------------------------------------------
// Admin: resolver / descartar
// ---------------------------------------------------------------------------

/**
 * Marca a denúncia como `RESOLVIDA`. `resolucao` é texto livre que
 * descreve o que o admin fez (ex.: "perfil banido", "mídia
 * removida"). Empilha como audit trail informal.
 */
export async function resolverReport(input: {
    reportId: string;
    adminUserId: string;
    resolucao: string;
    now?: Date;
}): Promise<
    | { ok: true }
    | { ok: false; reason: "NAO_ENCONTRADA" | "RESOLUCAO_INVALIDA" | "PERSISTENCIA" }
> {
    const resolucao = input.resolucao.trim();
    if (resolucao.length === 0 || resolucao.length > 500) {
        return { ok: false, reason: "RESOLUCAO_INVALIDA" };
    }

    const exists = await db.report.findUnique({
        where: { id: input.reportId },
        select: { id: true },
    });
    if (!exists) return { ok: false, reason: "NAO_ENCONTRADA" };

    try {
        await db.report.update({
            where: { id: input.reportId },
            data: {
                status: "RESOLVIDA",
                resolucao,
                resolvidaEm: input.now ?? new Date(),
                resolvidaPorUserId: input.adminUserId,
            },
        });
    } catch {
        return { ok: false, reason: "PERSISTENCIA" };
    }
    return { ok: true };
}

/**
 * Marca a denúncia como `DESCARTADA` (sem ação). `resolucao` é
 * opcional — em geral admin escreve por que descartou.
 */
export async function descartarReport(input: {
    reportId: string;
    adminUserId: string;
    resolucao?: string | null;
    now?: Date;
}): Promise<
    | { ok: true }
    | { ok: false; reason: "NAO_ENCONTRADA" | "RESOLUCAO_INVALIDA" | "PERSISTENCIA" }
> {
    const resolucao = input.resolucao?.trim() ?? null;
    if (resolucao !== null && resolucao.length > 500) {
        return { ok: false, reason: "RESOLUCAO_INVALIDA" };
    }
    const resolucaoFinal = resolucao && resolucao.length > 0 ? resolucao : null;

    const exists = await db.report.findUnique({
        where: { id: input.reportId },
        select: { id: true },
    });
    if (!exists) return { ok: false, reason: "NAO_ENCONTRADA" };

    try {
        await db.report.update({
            where: { id: input.reportId },
            data: {
                status: "DESCARTADA",
                resolucao: resolucaoFinal,
                resolvidaEm: input.now ?? new Date(),
                resolvidaPorUserId: input.adminUserId,
            },
        });
    } catch {
        return { ok: false, reason: "PERSISTENCIA" };
    }
    return { ok: true };
}
