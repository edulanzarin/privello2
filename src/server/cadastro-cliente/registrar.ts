/**
 * Sistema_de_Cadastro_Cliente — operação `registrar`.
 *
 * Implementa o caso de uso descrito em design.md (`Sistema_de_Cadastro_Cliente`)
 * para o Requirement 2 (Cadastro de Cliente):
 *
 *   1. Validação dos campos `nome`, `email`, `identificador`, `senha` e
 *      `fotoPerfil` (opcional) através do {@link cadastroClienteSchema},
 *      que reusa os validadores canônicos de `src/domain/validation/*` e
 *      normaliza `nome` (trim), `email` (lower-case) e `identificador`
 *      (lower-case). A `fotoPerfil` reutiliza o mesmo schema de
 *      Foto_de_Perfil do Onboarding_Acompanhante (mimeType + sizeBytes
 *      + stagedKey) — Property 16 estendida ao Cliente.
 *   2. Verificação **case-insensitive** de unicidade de email e
 *      identificador (Requirements 2.3 e 2.4) — como os schemas Zod já
 *      normalizam para caixa baixa e os campos são persistidos em
 *      lower-case (Requirement 2.5), uma busca por igualdade exata na
 *      forma normalizada já implementa o requisito.
 *   3. Em uma única `prisma.$transaction`:
 *        - hash da senha com argon2id (Requirement 1.4),
 *        - inserção do `User` com `type = CLIENTE` (Requirement 2.2),
 *        - criação do `ClientProfile` correspondente,
 *        - quando há `fotoPerfil`: inserção de `Media(isProfilePhoto=true,
 *          status=COMMITTED)` com `storageKey =
 *          committed/<userId>/profile.<ext>` (mesmo template do
 *          Onboarding_Acompanhante, derivado por
 *          {@link buildProfileKey}) e atualização de
 *          `ClientProfile.fotoPerfilId`,
 *        - criação da `Session` com expiração ≤ 30 dias (Requirement
 *          2.10 + 1.1) usando {@link createSession} com o `tx` da
 *          transação, garantindo atomicidade do passo todo.
 *   4. Pós-commit (fora da transação): quando há `fotoPerfil`, promove
 *      o objeto `staged/<uuid>` para a chave final via
 *      {@link commitProfilePhoto}, com até duas tentativas. Em falha
 *      persistente, marca a `Media` como `PENDING_REPAIR` em
 *      best-effort. Erros aqui **não** falham a operação porque a
 *      transação SQL é a fonte de verdade do estado lógico do cadastro
 *      (espelho do contrato do Onboarding_Acompanhante).
 *   5. Retorno de uma união discriminada
 *      `{ ok: true, userId, sessionId } | { ok: false, reason, ... }`
 *      conforme o tipo {@link CadastroClienteResult} do design.
 *
 * Em qualquer falha de transação que ocorra após o staging em R2 (race
 * de unicidade detectada via `P2002`, `PERSISTENCIA`), o objeto staged
 * é apagado em best-effort por {@link cleanupStaged} (Property 15:
 * "Falha" não deixa nem conta nem `staged/` nem `committed/`).
 */

import { Prisma } from "@prisma/client";

import { hashPassword } from "@/domain/auth/password";
import {
    cadastroClienteSchema,
    type CadastroClienteInput as NormalizedCadastroClienteInput,
} from "@/domain/schemas";
import { db } from "@/lib/db";
import { createSession } from "@/server/auth/sessions";
import {
    buildProfileKey,
    cleanupStaged,
    commitProfilePhoto,
} from "@/server/storage/profileMedia";

// ---------------------------------------------------------------------------
// Public types (mirrored from design.md → CadastroClienteService)
// ---------------------------------------------------------------------------

/**
 * Payload aceito por {@link registrar}. Os campos podem chegar com
 * variações de caixa, espaços nas extremidades de `nome`, etc.; a
 * normalização canônica (trim em `nome`, lower-case em `email` e
 * `identificador`) é aplicada por {@link cadastroClienteSchema}.
 */
export type CadastroClienteInput = {
    /** Nome completo. 2..100 caracteres após `trim`. */
    nome: string;
    /** Email, 5..254 caracteres, formato `parte_local@dominio.tld`. */
    email: string;
    /** Identificador `^[A-Za-z0-9_]{3,30}$`, persistido em caixa baixa. */
    identificador: string;
    /** Senha em texto claro, 8..128 caracteres; transformada em argon2id. */
    senha: string;
    /**
     * Foto_de_Perfil opcional. Quando presente, deve referenciar um
     * objeto previamente carregado em `staged/<uuid>` no Cloudflare R2
     * (rota `POST /api/cadastro/cliente/foto`); a transação atômica
     * promove a chave para `committed/<userId>/profile.<ext>` antes de
     * encerrar.
     */
    fotoPerfil?: {
        /** MIME type validado pelo cliente HTTP no upload. */
        mimeType: string;
        /** Tamanho do arquivo em bytes. */
        sizeBytes: number;
        /** Chave devolvida pelo endpoint de staging. */
        stagedKey: string;
    };
};

/**
 * Razão pela qual `registrar` falhou. Em conjunto com {@link CadastroClienteResult}
 * forma a união discriminada exposta pelo serviço.
 *
 * - `VALIDACAO`: algum campo obrigatório está ausente/ inválido
 *   (Requirement 2.9).
 * - `EMAIL_EM_USO`: o email (em caixa baixa) já existe (Requirement 2.3).
 * - `IDENTIFICADOR_EM_USO`: o identificador (em caixa baixa) já existe
 *   (Requirement 2.4).
 */
export type CadastroClienteFailureReason =
    | "VALIDACAO"
    | "EMAIL_EM_USO"
    | "IDENTIFICADOR_EM_USO";

/** Resultado de {@link registrar}. Veja design.md → CadastroClienteResult. */
export type CadastroClienteResult =
    | { ok: true; userId: string; sessionId: string }
    | {
        ok: false;
        reason: CadastroClienteFailureReason;
        /**
         * Quando `reason === "VALIDACAO"`, mapa de `campo → mensagem`
         * com o(s) erro(s) detectado(s) pelo schema Zod. Útil para a
         * camada de UI exibir mensagens por campo (Requirement 2.9).
         */
        detalhes?: Record<string, string>;
    };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Constrói um mapa `campo → mensagem` a partir de um `ZodError`. Em caso
 * de múltiplos erros para o mesmo campo, prevalece a primeira mensagem.
 */
function buildValidationDetails(
    error: import("zod").ZodError,
): Record<string, string> {
    const details: Record<string, string> = {};
    for (const issue of error.issues) {
        // `path` pode ter múltiplos níveis; usamos apenas o topo.
        const key = issue.path[0];
        const field = typeof key === "string" ? key : "_root";
        if (!(field in details)) {
            details[field] = issue.message;
        }
    }
    return details;
}

/**
 * Verifica unicidade de email e identificador. Lê os dois registros em
 * uma única chamada e retorna o motivo da colisão, se houver.
 *
 * Esta verificação é **case-insensitive por construção**: os valores
 * usados na consulta já passaram pelo schema Zod, que normaliza para
 * caixa baixa, e os campos `users.email`/`users.identificador` também
 * são armazenados em caixa baixa (Requirement 2.5).
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

    // Se algum registro retornado bate no email, o email é o conflito.
    // Verificar email primeiro deixa as mensagens determinísticas em
    // cenários de duplo conflito (mesmo email e identificador já em uso).
    if (conflitantes.some((u) => u.email === emailLower)) {
        return "EMAIL_EM_USO";
    }
    return "IDENTIFICADOR_EM_USO";
}

/**
 * Mapeia um erro de violação de unicidade do Prisma (`P2002`) para o
 * `reason` correspondente. Retorna `null` quando o erro não é uma
 * colisão de email ou identificador (caso em que o chamador deve deixar
 * o erro propagar).
 */
function mapearViolacaoUnicidade(
    error: unknown,
): CadastroClienteFailureReason | null {
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
 * Erro tipado lançado de dentro do `prisma.$transaction` quando o
 * pre-check de unicidade detecta conflito de email ou identificador.
 * O `throw` é necessário porque retornar um valor não rolaria a
 * transação; como nenhum INSERT ainda ocorreu, o efeito é o mesmo de
 * um early-return — espelha o padrão usado em
 * `@/server/onboarding/finalizar`.
 */
class ColisaoError extends Error {
    public readonly reason: "EMAIL_EM_USO" | "IDENTIFICADOR_EM_USO";

    constructor(reason: "EMAIL_EM_USO" | "IDENTIFICADOR_EM_USO") {
        super(reason);
        this.name = "ColisaoError";
        this.reason = reason;
    }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Cadastra uma nova conta de Cliente.
 *
 * Veja o cabeçalho deste arquivo para o fluxo completo. Em caso de
 * sucesso, o chamador (route handler ou Server Action) deve colocar
 * `sessionId` no cookie de sessão usando `signSessionCookie`
 * (Requirement 2.10).
 *
 * @param input Dados crus do formulário; serão validados e normalizados.
 * @returns União discriminada com sucesso (`userId`, `sessionId`) ou
 *          falha com `reason` e, para validação, `detalhes` por campo.
 */
export async function registrar(
    input: CadastroClienteInput,
): Promise<CadastroClienteResult> {
    // 1) Validação + normalização canônica.
    const parsed = cadastroClienteSchema.safeParse(input);
    if (!parsed.success) {
        return {
            ok: false,
            reason: "VALIDACAO",
            detalhes: buildValidationDetails(parsed.error),
        };
    }
    const normalized: NormalizedCadastroClienteInput = parsed.data;

    // 2) Hash da senha **antes** da transação. argon2id é caro (memória/
    //    CPU) e não deve manter uma transação aberta enquanto roda; o
    //    valor já normalizado das outras chaves não muda.
    const passwordHash = await hashPassword(normalized.senha);

    // 3) Transação: unicidade → User → ClientProfile → (Media + foto link
    //    se houver foto) → Session.
    let txResult: {
        userId: string;
        sessionId: string;
        // Quando `fotoPerfil` está presente, levamos `mediaId` e
        // `finalKey` para o pós-commit em R2.
        commit?: { stagedKey: string; finalKey: string; mediaId: string };
    } | null = null;

    try {
        txResult = await db.$transaction(async (tx) => {
            const colisao = await detectarColisao(
                tx,
                normalized.email,
                normalized.identificador,
            );
            if (colisao !== null) {
                throw new ColisaoError(colisao);
            }

            const user = await tx.user.create({
                data: {
                    email: normalized.email,
                    identificador: normalized.identificador,
                    nome: normalized.nome,
                    passwordHash,
                    type: "CLIENTE",
                    client: { create: {} },
                },
                select: { id: true, type: true },
            });

            let commit:
                | { stagedKey: string; finalKey: string; mediaId: string }
                | undefined;

            if (normalized.fotoPerfil) {
                const finalKey = buildProfileKey(
                    user.id,
                    normalized.fotoPerfil.mimeType,
                );
                const media = await tx.media.create({
                    data: {
                        ownerId: user.id,
                        storageKey: finalKey,
                        mimeType: normalized.fotoPerfil.mimeType,
                        sizeBytes: normalized.fotoPerfil.sizeBytes,
                        status: "COMMITTED",
                        role: "PROFILE",
                        isProfilePhoto: true,
                    },
                    select: { id: true },
                });
                await tx.clientProfile.update({
                    where: { userId: user.id },
                    data: { fotoPerfilId: media.id },
                });
                commit = {
                    stagedKey: normalized.fotoPerfil.stagedKey,
                    finalKey,
                    mediaId: media.id,
                };
            }

            const session = await createSession(user.id, user.type, {
                client: tx,
            });

            return {
                userId: user.id,
                sessionId: session.id,
                commit,
            };
        });
    } catch (error) {
        // Cleanup do staged em best-effort para qualquer falha de tx —
        // simétrico ao Onboarding_Acompanhante (Property 15: "Falha" não
        // deixa staged/ órfão).
        if (input.fotoPerfil?.stagedKey) {
            await cleanupStaged(input.fotoPerfil.stagedKey);
        }
        if (error instanceof ColisaoError) {
            return { ok: false, reason: error.reason };
        }
        const reason = mapearViolacaoUnicidade(error);
        if (reason !== null) {
            return { ok: false, reason };
        }
        throw error;
    }

    // 4) Pós-commit em R2 (best-effort) quando há foto. Erros aqui não
    //    falham a operação porque a transação SQL já é a fonte de
    //    verdade do estado lógico do cadastro.
    if (txResult.commit) {
        await commitProfilePhoto(txResult.commit);
    }

    return {
        ok: true,
        userId: txResult.userId,
        sessionId: txResult.sessionId,
    };
}
