/**
 * Sistema de Perguntas e Respostas (Q&A) no perfil da Acompanhante.
 *
 * Modelo:
 *
 *   - Cliente Fan envia uma pergunta a uma Acompanhante.
 *   - Acompanhante responde no painel privado (uma resposta por
 *     pergunta — UPDATE substitui).
 *   - Q&A é público para Cliente Fan e Acompanhante. Cliente
 *     Grátis e anônimo veem apenas o bloco bloqueado.
 *
 * Diferente das avaliações, Q&A:
 *   - **Não tem unique** por par `(target, author)`: Cliente pode
 *     fazer várias perguntas.
 *   - Cada pergunta tem 0 ou 1 resposta (campo na própria linha).
 *   - Comprimento: pergunta 1..500, resposta 1..2000.
 *
 * Visibilidade na ordenação: respondidas primeiro, depois pendentes.
 * O caller pode escolher por `incluirPendentes`.
 */

import { db } from "@/lib/db";

/**
 * Pergunta retornada pra UI pública (com ou sem resposta).
 */
export interface QuestionPublica {
    id: string;
    question: string;
    answer: string | null;
    answeredAt: Date | null;
    createdAt: Date;
    /** Autor (Cliente). */
    authorIdentificador: string;
    authorNome: string;
    authorFotoUrl: string | null;
    /** Quando o viewer é o autor, pode excluir a pergunta. */
    isMine: boolean;
}

// ---------------------------------------------------------------------------
// Criar pergunta
// ---------------------------------------------------------------------------

export type CriarPerguntaResult =
    | { ok: true; questionId: string }
    | { ok: false; reason: "AUTO_PERGUNTA" }
    | { ok: false; reason: "TARGET_NAO_E_ACOMPANHANTE" }
    | { ok: false; reason: "PERGUNTA_INVALIDA" };

export interface CriarPerguntaInput {
    targetUserId: string;
    authorUserId: string;
    question: string;
}

/**
 * Cria uma nova pergunta. Cliente Fan pode mandar várias por
 * Acompanhante.
 */
export async function criarPergunta(
    input: CriarPerguntaInput,
): Promise<CriarPerguntaResult> {
    if (input.authorUserId === input.targetUserId) {
        return { ok: false, reason: "AUTO_PERGUNTA" };
    }
    const trimmed = input.question.trim();
    if (trimmed.length === 0 || trimmed.length > 500) {
        return { ok: false, reason: "PERGUNTA_INVALIDA" };
    }

    const target = await db.user.findUnique({
        where: { id: input.targetUserId },
        select: { type: true },
    });
    if (!target || target.type !== "ACOMPANHANTE") {
        return { ok: false, reason: "TARGET_NAO_E_ACOMPANHANTE" };
    }

    const created = await db.acompanhanteQuestion.create({
        data: {
            targetUserId: input.targetUserId,
            authorUserId: input.authorUserId,
            question: trimmed,
        },
        select: { id: true },
    });
    return { ok: true, questionId: created.id };
}

// ---------------------------------------------------------------------------
// Responder
// ---------------------------------------------------------------------------

export type ResponderResult =
    | { ok: true }
    | { ok: false; reason: "PERGUNTA_NAO_ENCONTRADA" }
    | { ok: false; reason: "NAO_E_DESTINATARIO" }
    | { ok: false; reason: "RESPOSTA_INVALIDA" };

/**
 * Acompanhante responde uma pergunta. UPDATE — sobrescreve resposta
 * anterior se houver. `answeredAt` é gravado na primeira resposta e
 * mantido em edições subsequentes (idempotente).
 */
export async function responderPergunta(input: {
    questionId: string;
    targetUserId: string;
    answer: string;
}): Promise<ResponderResult> {
    const trimmed = input.answer.trim();
    if (trimmed.length === 0 || trimmed.length > 2000) {
        return { ok: false, reason: "RESPOSTA_INVALIDA" };
    }

    const row = await db.acompanhanteQuestion.findUnique({
        where: { id: input.questionId },
        select: { targetUserId: true, answeredAt: true },
    });
    if (!row) {
        return { ok: false, reason: "PERGUNTA_NAO_ENCONTRADA" };
    }
    if (row.targetUserId !== input.targetUserId) {
        return { ok: false, reason: "NAO_E_DESTINATARIO" };
    }

    await db.acompanhanteQuestion.update({
        where: { id: input.questionId },
        data: {
            answer: trimmed,
            // Preserva o timestamp original quando editando.
            answeredAt: row.answeredAt ?? new Date(),
        },
    });

    return { ok: true };
}

// ---------------------------------------------------------------------------
// Excluir pergunta (autor) ou resposta (Acompanhante)
// ---------------------------------------------------------------------------

export type ExcluirPerguntaResult =
    | { ok: true }
    | { ok: false; reason: "NAO_ENCONTRADA" }
    | { ok: false; reason: "NAO_E_AUTOR" };

/**
 * Cliente exclui sua própria pergunta. Resposta (se houver) é
 * apagada junto.
 */
export async function excluirPergunta(
    questionId: string,
    authorUserId: string,
): Promise<ExcluirPerguntaResult> {
    const row = await db.acompanhanteQuestion.findUnique({
        where: { id: questionId },
        select: { authorUserId: true },
    });
    if (!row) {
        return { ok: false, reason: "NAO_ENCONTRADA" };
    }
    if (row.authorUserId !== authorUserId) {
        return { ok: false, reason: "NAO_E_AUTOR" };
    }

    await db.acompanhanteQuestion.delete({
        where: { id: questionId },
    });
    return { ok: true };
}

/**
 * Acompanhante remove uma resposta sua (mantém a pergunta).
 */
export async function removerResposta(input: {
    questionId: string;
    targetUserId: string;
}): Promise<ResponderResult> {
    const row = await db.acompanhanteQuestion.findUnique({
        where: { id: input.questionId },
        select: { targetUserId: true },
    });
    if (!row) {
        return { ok: false, reason: "PERGUNTA_NAO_ENCONTRADA" };
    }
    if (row.targetUserId !== input.targetUserId) {
        return { ok: false, reason: "NAO_E_DESTINATARIO" };
    }

    await db.acompanhanteQuestion.update({
        where: { id: input.questionId },
        data: { answer: null, answeredAt: null },
    });
    return { ok: true };
}

// ---------------------------------------------------------------------------
// Listar
// ---------------------------------------------------------------------------

export interface ListarQuestionsOptions {
    limit?: number;
    /**
     * Quando `false`, retorna apenas perguntas com resposta. Padrão:
     * `true` (mostra pendentes também — útil pro painel da
     * Acompanhante e pra UI pública mostrar perguntas em aberto).
     */
    incluirPendentes?: boolean;
    /** ID do viewer pra marcar `isMine`. `null` = anônimo. */
    viewerUserId?: string | null;
}

/**
 * Lista perguntas públicas de um perfil. Ordena: respondidas
 * primeiro (por data de resposta desc), depois pendentes (por
 * createdAt desc).
 */
export async function listarPerguntasPublicas(
    targetUserId: string,
    options: ListarQuestionsOptions = {},
): Promise<ReadonlyArray<QuestionPublica>> {
    const limit = Math.max(1, Math.min(100, options.limit ?? 50));
    const incluirPendentes = options.incluirPendentes ?? true;
    const viewerUserId = options.viewerUserId ?? null;

    const where = incluirPendentes
        ? { targetUserId }
        : { targetUserId, answeredAt: { not: null } };

    const rows = await db.acompanhanteQuestion.findMany({
        where,
        // Respondidas primeiro (answeredAt desc, nulls last), depois
        // pendentes pelo createdAt desc.
        orderBy: [
            { answeredAt: { sort: "desc", nulls: "last" } },
            { createdAt: "desc" },
        ],
        take: limit,
        select: {
            id: true,
            question: true,
            answer: true,
            answeredAt: true,
            createdAt: true,
            authorUserId: true,
            author: {
                select: {
                    nome: true,
                    identificador: true,
                    client: {
                        select: {
                            fotoPerfil: { select: { storageKey: true } },
                        },
                    },
                },
            },
        },
    });

    return rows.map((row) => ({
        id: row.id,
        question: row.question,
        answer: row.answer,
        answeredAt: row.answeredAt,
        createdAt: row.createdAt,
        authorNome: row.author.nome,
        authorIdentificador: row.author.identificador,
        authorFotoUrl:
            row.author.client?.fotoPerfil
                ? `/api/storage/${row.author.client.fotoPerfil.storageKey}`
                : null,
        isMine: row.authorUserId === viewerUserId,
    }));
}

/**
 * Conta perguntas pendentes (sem resposta) de uma Acompanhante.
 * Usado pelo painel para mostrar badge "X perguntas para
 * responder".
 */
export async function contarPerguntasPendentes(
    targetUserId: string,
): Promise<number> {
    return db.acompanhanteQuestion.count({
        where: { targetUserId, answeredAt: null },
    });
}

/**
 * Lista perguntas que um Cliente fez (sua atividade). Filtra
 * Acompanhantes com plano vigente.
 */
export interface QuestionDoCliente {
    id: string;
    question: string;
    answer: string | null;
    answeredAt: Date | null;
    createdAt: Date;
    targetIdentificador: string;
    targetNome: string;
    targetFotoUrl: string | null;
}

export async function listarPerguntasDoCliente(
    authorUserId: string,
    options: { limit?: number } = {},
): Promise<ReadonlyArray<QuestionDoCliente>> {
    const limit = Math.max(1, Math.min(200, options.limit ?? 100));

    const rows = await db.acompanhanteQuestion.findMany({
        where: {
            authorUserId,
            target: {
                acompanhante: {
                    planoVigente: { not: null },
                },
            },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        select: {
            id: true,
            question: true,
            answer: true,
            answeredAt: true,
            createdAt: true,
            target: {
                select: {
                    nome: true,
                    identificador: true,
                    acompanhante: {
                        select: {
                            fotoPerfil: { select: { storageKey: true } },
                        },
                    },
                },
            },
        },
    });

    return rows.map((row) => ({
        id: row.id,
        question: row.question,
        answer: row.answer,
        answeredAt: row.answeredAt,
        createdAt: row.createdAt,
        targetNome: row.target.nome,
        targetIdentificador: row.target.identificador,
        targetFotoUrl:
            row.target.acompanhante?.fotoPerfil
                ? `/api/storage/${row.target.acompanhante.fotoPerfil.storageKey}`
                : null,
    }));
}
