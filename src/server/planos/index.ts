/**
 * Sistema_de_Planos — serviço de Selecao_de_Plano.
 *
 * Implementa o trecho do design (`Sistema_de_Planos`) responsável por
 * registrar e ler o Plano vigente de uma Acompanhante. As regras dos
 * planos (limites, Stories, prioridade em busca) vivem na constante
 * imutável `PLANO_DEFINITIONS` em `src/domain/plano/definitions.ts` —
 * este módulo apenas coordena a persistência, sem duplicar essas regras.
 *
 * Garantias mantidas por este módulo (Requirements 5.4, 5.6, 5.8, 5.9 e
 * Properties 23, 24, 25):
 *
 * - {@link selecionar} rejeita qualquer string fora de
 *   `{ "BASICO", "PREMIUM" }` com `{ ok: false, reason: "INVALIDO" }` e
 *   não toca no banco de dados.
 * - {@link selecionar} é idempotente: quando o plano vigente da
 *   Acompanhante já é igual ao solicitado, retorna `{ ok: true }` sem
 *   reescrever `planoVigente`/`planoSelecionadoEm`. Combinado com a
 *   persistência atômica do `update`, isso satisfaz a Property 25
 *   (retentativas seguras).
 * - Falhas de I/O do banco são contidas em `try/catch` e traduzidas
 *   para `{ ok: false, reason: "PERSISTENCIA" }`. Como `selecionar`
 *   só escreve em uma única linha (ou não escreve, no caso idempotente),
 *   o estado anterior — incluindo `planoVigente = null` — é preservado.
 * - {@link obterVigente} devolve a definição imutável do plano (ou
 *   `null` se a Acompanhante ainda não escolheu / não existe). Erros
 *   de banco são propagados para que o chamador trate explicitamente,
 *   evitando confundir "sem plano" com "leitura falhou".
 */

import {
    PLANO_DEFINITIONS,
    isPlanoTipo,
    podeAlterarPlano,
    type PlanoDefinition,
    type PlanoTipo,
} from "@/domain/plano/definitions";
import { db } from "@/lib/db";

// ---------------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------------

/**
 * Resultado de {@link selecionar}.
 *
 * - `INVALIDO`: a string submetida não corresponde a `BASICO` nem a
 *   `PREMIUM` (Requirement 5.8).
 * - `DOWNGRADE_NAO_PERMITIDO`: o usuário tentou trocar para um plano
 *   de tier inferior ao atual. Downgrade ativo é proibido — só
 *   acontece passivamente quando o plano expira.
 * - `PERSISTENCIA`: falha no banco impediu a gravação (Requirement 5.9).
 *   Quando a Acompanhante ainda não tinha plano, ela permanece sem
 *   plano vigente e pode tentar novamente sem refazer o onboarding.
 */
export type SelecionarPlanoResult =
    | { ok: true }
    | {
        ok: false;
        reason: "INVALIDO" | "DOWNGRADE_NAO_PERMITIDO" | "PERSISTENCIA";
    };

/** Opções injetáveis (relógio); úteis em testes determinísticos. */
export type SelecionarPlanoOptions = {
    /** Override do relógio. Default: `new Date()`. */
    now?: Date;
};

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

/**
 * Lista os planos disponíveis para a Selecao_de_Plano.
 *
 * Retorna referências aos objetos congelados de
 * {@link PLANO_DEFINITIONS}; consumidores não devem mutá-los.
 */
export function listar(): readonly PlanoDefinition[] {
    return [PLANO_DEFINITIONS.BASICO, PLANO_DEFINITIONS.PREMIUM] as const;
}

/**
 * Registra `tipo` como plano vigente de `acompanhanteId`.
 *
 * Comportamento:
 *
 * 1. Se `tipo` não for exatamente `"BASICO"` nem `"PREMIUM"`, retorna
 *    `{ ok: false, reason: "INVALIDO" }` sem tocar no banco.
 * 2. Lê o plano atual; se já for igual ao solicitado, retorna
 *    `{ ok: true }` sem reescrever (idempotência — Property 25 e seção
 *    "Concorrência e Retentativas" do design).
 * 3. Caso contrário, atualiza `planoVigente` e `planoSelecionadoEm`.
 * 4. Qualquer erro vindo do Prisma — incluindo Acompanhante inexistente
 *    — é capturado e traduzido para `{ ok: false, reason: "PERSISTENCIA" }`.
 *    Como nenhuma escrita é confirmada nesse caso, o estado anterior
 *    (`planoVigente`) é preservado.
 *
 * @param acompanhanteId Identificador (User.id) da Acompanhante.
 * @param tipo           Valor submetido pela usuária (string crua).
 * @param opts           Opções injetáveis (relógio).
 */
export async function selecionar(
    acompanhanteId: string,
    tipo: string,
    opts: SelecionarPlanoOptions = {},
): Promise<SelecionarPlanoResult> {
    if (!isPlanoTipo(tipo)) {
        return { ok: false, reason: "INVALIDO" };
    }

    const now = opts.now ?? new Date();

    try {
        const current = await db.acompanhanteProfile.findUnique({
            where: { userId: acompanhanteId },
            select: { planoVigente: true },
        });

        if (current === null) {
            // Sem perfil de Acompanhante para esse id: tratamos como
            // falha de persistência. O caller pode tentar novamente
            // ou redirecionar; o estado "sem plano" continua.
            return { ok: false, reason: "PERSISTENCIA" };
        }

        if (current.planoVigente === tipo) {
            // Idempotência: nada a fazer. Não reescrevemos
            // `planoSelecionadoEm` para manter o instante original da
            // primeira escolha.
            return { ok: true };
        }

        // Bloqueia downgrade ativo (`tier(novo) < tier(atual)`).
        // Quem já tem o Premium não pode "voltar" pro Básico
        // pagando — o downgrade só acontece passivamente quando o
        // plano expira (em ciclo futuro de pagamentos).
        if (!podeAlterarPlano(current.planoVigente, tipo)) {
            return { ok: false, reason: "DOWNGRADE_NAO_PERMITIDO" };
        }

        await db.acompanhanteProfile.update({
            where: { userId: acompanhanteId },
            data: {
                planoVigente: tipo satisfies PlanoTipo,
                planoSelecionadoEm: now,
            },
            select: { userId: true },
        });

        return { ok: true };
    } catch {
        return { ok: false, reason: "PERSISTENCIA" };
    }
}

/**
 * Lê o plano vigente de `acompanhanteId`.
 *
 * Retorna a `PlanoDefinition` imutável correspondente quando existe um
 * plano gravado, ou `null` quando a Acompanhante ainda não escolheu /
 * não tem perfil. Erros do Prisma são propagados para que o chamador
 * possa distinguir explicitamente "sem plano" de "leitura falhou".
 */
export async function obterVigente(
    acompanhanteId: string,
): Promise<PlanoDefinition | null> {
    const profile = await db.acompanhanteProfile.findUnique({
        where: { userId: acompanhanteId },
        select: { planoVigente: true },
    });

    if (!profile || profile.planoVigente === null) {
        return null;
    }

    return PLANO_DEFINITIONS[profile.planoVigente];
}
