/**
 * Sistema_de_Onboarding — operação `finalizar`.
 *
 * Implementa o fechamento atômico do Onboarding_Acompanhante descrito em
 * `design.md` e detalhado pelos Requirements 3.1, 3.5, 3.6, 3.7, 3.11,
 * 3.12 e 4.3.
 *
 * Fluxo (seções "Sistema_de_Onboarding" e "Atomicidade do Onboarding"
 * em `design.md`):
 *
 *   1. Recarrega o draft ativo via {@link obter}. Quando o draft não
 *      existe ou expirou (`obter` retorna `null`), nada é gravado e a
 *      operação retorna `{ ok: false, reason: "VALIDACAO" }` com
 *      `detalhes.onboardingId` indicando o motivo.
 *   2. Revalida **todos** os campos com {@link onboardingDataSchema} —
 *      reusando as regras canônicas de email, identificador, senha,
 *      nome, telefone, descrição e Foto_de_Perfil (Property 16). O
 *      `stagedKey` da Foto_de_Perfil é tomado da coluna
 *      `OnboardingDraft.stagedKey` (gravada por `uploadFoto`) e mesclado
 *      ao `fotoPerfil` do payload antes da validação.
 *   3. Revalida o par `(estadoSigla, cidadeNome)` contra o
 *      {@link defaultLocalidadesService} para garantir que o município
 *      pertence ao estado escolhido (Requirement 4.3).
 *   4. Faz o hash da senha **fora** da transação, pois argon2id é caro
 *      (CPU/memória) e não deve manter uma conexão Postgres aberta.
 *   5. Em uma única `prisma.$transaction`:
 *        - INSERT `User(type=ACOMPANHANTE)` com email/identificador já
 *          normalizados em caixa baixa e o hash de senha argon2id;
 *        - INSERT `AcompanhanteProfile` (telefone só-dígitos, estado,
 *          cidade, descrição) através de nested write;
 *        - INSERT `Media(isProfilePhoto=true, status=COMMITTED)` com
 *          `storageKey = committed/<userId>/profile.<ext>`, onde `ext`
 *          é derivado do MIME validado da Foto_de_Perfil;
 *        - UPDATE `AcompanhanteProfile.fotoPerfilId = media.id` para
 *          fechar o ciclo `Media ↔ AcompanhanteProfile`;
 *        - DELETE do `OnboardingDraft`;
 *        - cria a `Session` reusando {@link createSession} com o `tx`,
 *          satisfazendo o Requirement 3.11 (encaminha para
 *          `/selecao-plano` autenticada).
 *      Conflitos de unicidade (email/identificador) são detectados por
 *      um pre-check (`findMany`) e, em corrida, mapeados a partir de
 *      `P2002`. Em ambos os casos o resultado é
 *      `{ ok: false, reason: "EMAIL_EM_USO" | "IDENTIFICADOR_EM_USO" }`
 *      e o objeto staged é apagado pelo `finally` (Requirement 3.6).
 *   6. Após o commit ter sucesso, fora da transação, copia o objeto
 *      `staged/<uuid>` para `committed/<userId>/profile.<ext>` via
 *      `r2.commit` e em seguida apaga o staged (defesa redundante).
 *      Em falha pós-commit, tenta o ciclo mais uma vez; se ainda
 *      falhar, atualiza `Media.status = PENDING_REPAIR` em best-effort
 *      e ignora qualquer erro adicional. O usuário **ainda** recebe
 *      `{ ok: true }` porque a transação SQL é a fonte de verdade do
 *      estado lógico (vide "Atomicidade do Onboarding (detalhe)" no
 *      `design.md`).
 *   7. Em qualquer falha de transação (validação interna, conflito,
 *      erro de banco), o bloco `finally` apaga o objeto staged em R2
 *      em best-effort (Property 15: nada de `staged/` ou `committed/`
 *      sobra para esse onboarding). O `OnboardingDraft` permanece
 *      consultável para retentativa até expirar.
 *
 * Validates: Requirements 3.1, 3.5, 3.6, 3.7, 3.11, 3.12, 4.3.
 */

import { Prisma } from "@prisma/client";
import type { ZodError } from "zod";

import { hashPassword } from "@/domain/auth/password";
import {
    onboardingDataSchema,
    type OnboardingData,
} from "@/domain/schemas";
import { db } from "@/lib/db";
import { createSession } from "@/server/auth/sessions";
import { defaultLocalidadesService } from "@/server/localidades";
import {
    buildProfileKey,
    cleanupStaged,
    commitProfilePhoto,
    __setR2ClientForTests as __setProfileMediaR2,
} from "@/server/storage/profileMedia";

import { obter } from "./drafts";

// ---------------------------------------------------------------------------
// Test seam
// ---------------------------------------------------------------------------

/**
 * Test-only seam que substitui o `R2Client` usado pelos helpers de
 * mídia de perfil (compartilhados entre `finalizar` e o
 * `Sistema_de_Cadastro_Cliente`). Mantido aqui por compatibilidade
 * com os testes existentes que importam de `@/server/onboarding/finalizar`.
 * Passe `null` para forçar a próxima chamada a reconstruir o cliente a
 * partir de `process.env`. Código de produção NÃO deve invocar isto.
 */
export function __setR2ClientForTests(
    client: import("@/lib/storage/r2").R2Client | null,
): void {
    __setProfileMediaR2(client);
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Mapeamento determinístico entre o `mimeType` da Foto_de_Perfil e a
 * extensão usada na chave final em R2 vivem em `@/server/storage/profileMedia`
 * (compartilhado com `Sistema_de_Cadastro_Cliente`). Os MIME aceitos vêm
 * do schema (`MIME_TYPES_PERMITIDOS`) e são exatamente os três do
 * Requirement 3.10.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Razão pela qual {@link finalizar} falhou:
 *
 * - `VALIDACAO`: draft ausente/expirado, algum campo inválido pelo
 *   {@link onboardingDataSchema}, ou `(estadoSigla, cidadeNome)`
 *   rejeitado pelo `Sistema_de_Localidades` (Requirements 3.1, 3.7,
 *   3.12, 4.3).
 * - `EMAIL_EM_USO`: email (em caixa baixa) já existe (Requirement 2.3
 *   reusado pelo onboarding).
 * - `IDENTIFICADOR_EM_USO`: identificador (em caixa baixa) já existe
 *   (Requirement 2.4 reusado pelo onboarding).
 * - `PERSISTENCIA`: a transação atômica no Postgres falhou (qualquer
 *   erro fora dos casos acima); o draft permanece, o objeto staged é
 *   apagado em best-effort (Requirement 3.6).
 */
export type FinalizarFailureReason =
    | "VALIDACAO"
    | "EMAIL_EM_USO"
    | "IDENTIFICADOR_EM_USO"
    | "PERSISTENCIA";

/**
 * Resultado de {@link finalizar}. Em sucesso, o `sessionId` deve ser
 * colocado no cookie de sessão pelo handler/Server Action que chamou
 * (Requirement 3.11).
 */
export type FinalizarResult =
    | { ok: true; userId: string; sessionId: string }
    | {
        ok: false;
        reason: FinalizarFailureReason;
        /**
         * Para `VALIDACAO`, mapa `campo → mensagem` com o(s) erro(s)
         * detectado(s) (campos do schema, `onboardingId` quando o draft
         * não existe, ou `estadoSigla`/`cidadeNome` quando o IBGE
         * rejeita o par).
         */
        detalhes?: Record<string, string>;
    };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Constrói um mapa `campo → mensagem` a partir de um `ZodError`. Em
 * caso de múltiplos erros para o mesmo campo, a primeira mensagem
 * prevalece.
 */
function buildValidationDetails(error: ZodError): Record<string, string> {
    const details: Record<string, string> = {};
    for (const issue of error.issues) {
        const key = issue.path[0];
        const field = typeof key === "string" ? key : "_root";
        if (!(field in details)) {
            details[field] = issue.message;
        }
    }
    return details;
}

/**
 * Erro tipado lançado de dentro do `prisma.$transaction` quando o
 * pre-check de unicidade detecta conflito de email ou identificador.
 * O `throw` é necessário porque retornar um valor não rolaria a
 * transação; como nenhum INSERT ainda ocorreu, o efeito é o mesmo de
 * um early-return.
 */
class ColisaoError extends Error {
    public readonly reason: "EMAIL_EM_USO" | "IDENTIFICADOR_EM_USO";

    constructor(reason: "EMAIL_EM_USO" | "IDENTIFICADOR_EM_USO") {
        super(reason);
        this.name = "ColisaoError";
        this.reason = reason;
    }
}

/**
 * Mapeia um erro de violação de unicidade do Prisma (`P2002`) para o
 * `reason` correspondente. Retorna `null` quando o erro não é uma
 * colisão de email ou identificador (caso em que o chamador deve deixar
 * o erro propagar para `PERSISTENCIA`).
 *
 * Backstop para condições de corrida: o pre-check pode perder uma
 * inserção concorrente, mas o índice único em `users.email` /
 * `users.identificador` ainda gera `P2002` que cai aqui.
 */
function mapearViolacaoUnicidade(
    error: unknown,
): "EMAIL_EM_USO" | "IDENTIFICADOR_EM_USO" | null {
    if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== "P2002"
    ) {
        return null;
    }
    const target = error.meta?.target;
    const targets: string[] = Array.isArray(target)
        ? target.map((t) => String(t))
        : typeof target === "string"
            ? [target]
            : [];

    if (targets.some((t) => t.includes("email"))) {
        return "EMAIL_EM_USO";
    }
    if (targets.some((t) => t.includes("identificador"))) {
        return "IDENTIFICADOR_EM_USO";
    }
    return null;
}

/**
 * Pre-check determinístico de unicidade dentro da transação. Lê email e
 * identificador (ambos já em caixa baixa por força do schema) em uma
 * única consulta e retorna o motivo do conflito, se houver. Quando os
 * dois conflitam ao mesmo tempo, prioriza o email para mensagens
 * estáveis.
 */
async function detectarColisao(
    client: Prisma.TransactionClient,
    emailLower: string,
    identificadorLower: string,
): Promise<"EMAIL_EM_USO" | "IDENTIFICADOR_EM_USO" | null> {
    const conflitantes = await client.user.findMany({
        where: {
            OR: [
                { email: emailLower },
                { identificador: identificadorLower },
            ],
        },
        select: { email: true, identificador: true },
        take: 2,
    });

    if (conflitantes.length === 0) {
        return null;
    }
    if (conflitantes.some((u) => u.email === emailLower)) {
        return "EMAIL_EM_USO";
    }
    return "IDENTIFICADOR_EM_USO";
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Conclui o Onboarding_Acompanhante de forma atômica.
 *
 * Veja o cabeçalho deste arquivo para o fluxo completo. Em caso de
 * sucesso, o chamador deve assinar `sessionId` com `signSessionCookie`
 * (`src/server/auth/sessions.ts`) e enviá-lo ao navegador (Requirement
 * 3.11). O draft já foi apagado dentro da transação, então não é
 * necessário invocar `descartar`.
 *
 * @param onboardingId Identificador opaco do `OnboardingDraft` ativo.
 * @returns União discriminada com sucesso (`userId`, `sessionId`) ou
 *          falha com `reason` e, quando aplicável, `detalhes` por campo.
 */
export async function finalizar(
    onboardingId: string,
): Promise<FinalizarResult> {
    // -------------------------------------------------------------------
    // 1) Recarrega o draft. `obter` apaga drafts expirados de forma
    //    preguiçosa (Requirement 3.4) e retorna `null` quando o id é
    //    desconhecido — em ambos os casos respondemos como VALIDACAO.
    // -------------------------------------------------------------------
    const draft = await obter(onboardingId);
    if (draft === null) {
        return {
            ok: false,
            reason: "VALIDACAO",
            detalhes: { onboardingId: "Draft não encontrado ou expirado." },
        };
    }

    // -------------------------------------------------------------------
    // 2) Monta o candidato injetando o `stagedKey` da coluna do row no
    //    `fotoPerfil` antes da validação. Isso casa o formato persistido
    //    em `OnboardingDraft` com o tipo `OnboardingData` que o schema
    //    espera (mimeType + sizeBytes vêm do payload, stagedKey vem do
    //    row gravado por `uploadFoto`).
    // -------------------------------------------------------------------
    const candidate: Record<string, unknown> = { ...draft.data };
    const fotoFromPayload = isPlainObject(draft.data.fotoPerfil)
        ? draft.data.fotoPerfil
        : {};
    const fotoMerged: Record<string, unknown> = { ...fotoFromPayload };
    if (draft.stagedKey !== null) {
        fotoMerged.stagedKey = draft.stagedKey;
    }
    candidate.fotoPerfil = fotoMerged;

    const parsed = onboardingDataSchema.safeParse(candidate);
    if (!parsed.success) {
        return {
            ok: false,
            reason: "VALIDACAO",
            detalhes: buildValidationDetails(parsed.error),
        };
    }
    const data: OnboardingData = parsed.data;

    // -------------------------------------------------------------------
    // 3) Revalida (estadoSigla, cidadeNome) contra o produto cartesiano
    //    oficial do IBGE (Requirement 4.3 / Property 19).
    // -------------------------------------------------------------------
    const localidadeOk = await defaultLocalidadesService.validar(
        data.estadoSigla,
        data.cidadeNome,
    );
    if (!localidadeOk) {
        return {
            ok: false,
            reason: "VALIDACAO",
            detalhes: {
                estadoSigla: data.estadoSigla,
                cidadeNome: data.cidadeNome,
            },
        };
    }

    // -------------------------------------------------------------------
    // 4) Hash da senha antes da transação (argon2id é CPU-bound e caro).
    // -------------------------------------------------------------------
    const passwordHash = await hashPassword(data.senha);
    const stagedKey = data.fotoPerfil.stagedKey;

    // -------------------------------------------------------------------
    // 5) Transação atômica + cleanup do staged em caso de falha.
    //
    //    Se a transação tiver sucesso, `txResult` carrega o que
    //    precisamos para o pós-commit. Se falhar, o `finally` apaga o
    //    objeto staged em best-effort (Property 15: "Falha" não deixa
    //    nem conta nem `staged/` nem `committed/`).
    // -------------------------------------------------------------------
    let txResult:
        | { userId: string; sessionId: string; mediaId: string; finalKey: string }
        | null = null;

    try {
        txResult = await db.$transaction(async (tx) => {
            const colisao = await detectarColisao(
                tx,
                data.email,
                data.identificador,
            );
            if (colisao !== null) {
                throw new ColisaoError(colisao);
            }

            const user = await tx.user.create({
                data: {
                    email: data.email,
                    identificador: data.identificador,
                    nome: data.nome,
                    passwordHash,
                    type: "ACOMPANHANTE",
                    acompanhante: {
                        create: {
                            telefone: data.telefone,
                            estadoSigla: data.estadoSigla,
                            cidadeNome: data.cidadeNome,
                            bairroNome: data.bairroNome ?? null,
                            descricao: data.descricao,
                            // Recém-cadastradas começam ocultas para
                            // que terminem de configurar mídias,
                            // áudio e detalhes do perfil antes de
                            // aparecer nas buscas. O painel mostra um
                            // banner persistente com CTA de ativar
                            // (PerfilOcultoBanner) e o switch dedicado
                            // em Configurações faz a mesma operação.
                            perfilVisivel: false,
                            // Atributos de aparência (todos opcionais).
                            // Os tipos inferidos do `onboardingDataSchema`
                            // já são uniões literais (`Etnia`,
                            // `CorOlhos`, etc.), portanto o Prisma aceita
                            // a atribuição direta. `?? null` mantém o
                            // contrato de "não informado" explícito.
                            pesoKg: data.pesoKg ?? null,
                            alturaCm: data.alturaCm ?? null,
                            tamanhoPe: data.tamanhoPe ?? null,
                            etnia: data.etnia ?? null,
                            corOlhos: data.corOlhos ?? null,
                            estiloCabelo: data.estiloCabelo ?? null,
                            tamanhoCabelo: data.tamanhoCabelo ?? null,
                            temSilicone: data.temSilicone ?? null,
                            temTatuagens: data.temTatuagens ?? null,
                            temPiercing: data.temPiercing ?? null,
                            fumante: data.fumante ?? null,
                            idiomas: data.idiomas ?? [],
                            genero: data.genero,
                            atendePublicos: data.atendePublicos ?? [],
                            realizaPraticas: data.realizaPraticas ?? [],
                            valorHoraCents: data.valorHoraCents,
                            formasPagamento: data.formasPagamento ?? [],
                            diasAtende: data.diasAtende ?? [],
                        },
                    },
                },
                select: { id: true, type: true },
            });

            const finalKey = buildProfileKey(user.id, data.fotoPerfil.mimeType);

            const media = await tx.media.create({
                data: {
                    ownerId: user.id,
                    storageKey: finalKey,
                    mimeType: data.fotoPerfil.mimeType,
                    sizeBytes: data.fotoPerfil.sizeBytes,
                    status: "COMMITTED",
                    role: "PROFILE",
                    isProfilePhoto: true,
                },
                select: { id: true },
            });

            await tx.acompanhanteProfile.update({
                where: { userId: user.id },
                data: { fotoPerfilId: media.id },
            });

            await tx.onboardingDraft.delete({
                where: { id: onboardingId },
            });

            const session = await createSession(user.id, user.type, {
                client: tx,
            });

            return {
                userId: user.id,
                sessionId: session.id,
                mediaId: media.id,
                finalKey,
            };
        });
    } catch (error) {
        // Cleanup do staged em best-effort para qualquer falha de tx
        // (Property 15: "Falha" não deixa `staged/` nem `committed/`).
        await cleanupStaged(stagedKey);

        if (error instanceof ColisaoError) {
            return { ok: false, reason: error.reason };
        }
        const reason = mapearViolacaoUnicidade(error);
        if (reason !== null) {
            return { ok: false, reason };
        }
        return { ok: false, reason: "PERSISTENCIA" };
    }

    // -------------------------------------------------------------------
    // 6) Pós-commit: promove o objeto staged para a chave final em R2.
    //    Em falha persistente, `commitProfilePhoto` marca a `Media`
    //    como `PENDING_REPAIR` em best-effort. Erros aqui NÃO falham a
    //    operação porque a transação SQL já é a fonte de verdade do
    //    estado lógico do cadastro.
    // -------------------------------------------------------------------
    await commitProfilePhoto({
        stagedKey,
        finalKey: txResult.finalKey,
        mediaId: txResult.mediaId,
    });

    return {
        ok: true,
        userId: txResult.userId,
        sessionId: txResult.sessionId,
    };
}
