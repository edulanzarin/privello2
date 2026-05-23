/**
 * Sistema_de_Planos_Cliente — serviço de seleção de plano de Cliente.
 *
 * Espelha o desenho do `Sistema_de_Planos` da Acompanhante
 * (`@/server/planos`), mas:
 *
 * - Lê e escreve em `client_profiles` (não `acompanhante_profiles`).
 * - Aceita apenas `GRATIS` e `FAN` (não `BASICO`/`PREMIUM`).
 * - **Não bloqueia acesso à plataforma** quando `planoVigente` é
 *   `null`. Um Cliente recém-cadastrado vê a tela de seleção logo
 *   após criar a conta, mas pode optar por adiar (e a home não trava).
 *
 * Garantias mantidas:
 *
 * - {@link selecionar} rejeita strings fora de `{GRATIS, FAN}` com
 *   `{ ok: false, reason: "INVALIDO" }` sem tocar no banco.
 * - {@link selecionar} é idempotente: quando o plano vigente já é
 *   igual ao solicitado, retorna `{ ok: true }` sem reescrever.
 * - Falhas de I/O viram `{ ok: false, reason: "PERSISTENCIA" }`. O
 *   estado anterior (incluindo `null`) é preservado.
 * - {@link obterVigente} retorna `null` quando o Cliente ainda não
 *   escolheu plano ou não existe.
 */

import {
    PLANO_CLIENTE_DEFINITIONS,
    isPlanoClienteTipo,
    podeAlterarPlanoCliente,
    type PlanoClienteDefinition,
    type PlanoClienteTipo,
} from "@/domain/plano-cliente/definitions";
import { db } from "@/lib/db";

// ---------------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------------

/**
 * Resultado de {@link selecionar}.
 *
 * - `INVALIDO`: a string submetida não corresponde a `GRATIS` nem a `FAN`.
 * - `DOWNGRADE_NAO_PERMITIDO`: tentativa de trocar para um plano de
 *   tier inferior. Downgrade ativo é proibido (ex.: `FAN → GRATIS`).
 * - `PERSISTENCIA`: falha no banco impediu a gravação. O Cliente
 *   permanece sem plano vigente e pode tentar de novo.
 */
export type SelecionarPlanoClienteResult =
    | { ok: true }
    | {
        ok: false;
        reason: "INVALIDO" | "DOWNGRADE_NAO_PERMITIDO" | "PERSISTENCIA";
    };

/** Opções injetáveis para testes determinísticos. */
export type SelecionarPlanoClienteOptions = {
    /** Override do relógio. Default: `new Date()`. */
    now?: Date;
};

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

/**
 * Lista os planos de Cliente disponíveis para a tela de seleção.
 *
 * Retorna referências aos objetos congelados de
 * {@link PLANO_CLIENTE_DEFINITIONS}.
 */
export function listar(): readonly PlanoClienteDefinition[] {
    return [
        PLANO_CLIENTE_DEFINITIONS.GRATIS,
        PLANO_CLIENTE_DEFINITIONS.FAN,
    ] as const;
}

/**
 * Registra `tipo` como plano vigente de `clienteId`.
 *
 * Se a string não for um `PlanoClienteTipo` válido, retorna
 * `INVALIDO` sem tocar no banco. Se já estiver no plano solicitado,
 * é no-op idempotente. Em caso de falha de I/O, retorna `PERSISTENCIA`
 * e o estado anterior é mantido.
 */
export async function selecionar(
    clienteId: string,
    tipo: string,
    opts: SelecionarPlanoClienteOptions = {},
): Promise<SelecionarPlanoClienteResult> {
    if (!isPlanoClienteTipo(tipo)) {
        return { ok: false, reason: "INVALIDO" };
    }

    const now = opts.now ?? new Date();

    try {
        const current = await db.clientProfile.findUnique({
            where: { userId: clienteId },
            select: { planoVigente: true },
        });

        if (current === null) {
            // Sem perfil de Cliente para esse id: tratamos como falha
            // de persistência. O caller pode tentar novamente.
            return { ok: false, reason: "PERSISTENCIA" };
        }

        if (current.planoVigente === tipo) {
            // Idempotência: nada a fazer. Não reescrevemos
            // `planoSelecionadoEm` para preservar o instante original.
            return { ok: true };
        }

        // Bloqueia downgrade ativo (`FAN → GRATIS`). Downgrade só
        // ocorre passivamente quando a assinatura expira.
        if (!podeAlterarPlanoCliente(current.planoVigente, tipo)) {
            return { ok: false, reason: "DOWNGRADE_NAO_PERMITIDO" };
        }

        await db.clientProfile.update({
            where: { userId: clienteId },
            data: {
                planoVigente: tipo satisfies PlanoClienteTipo,
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
 * Lê o plano vigente de `clienteId`.
 *
 * Retorna a `PlanoClienteDefinition` imutável correspondente quando
 * existe um plano gravado, ou `null` quando o Cliente ainda não
 * escolheu / não tem perfil.
 */
export async function obterVigente(
    clienteId: string,
): Promise<PlanoClienteDefinition | null> {
    const profile = await db.clientProfile.findUnique({
        where: { userId: clienteId },
        select: { planoVigente: true },
    });

    if (!profile || profile.planoVigente === null) {
        return null;
    }

    return PLANO_CLIENTE_DEFINITIONS[profile.planoVigente];
}
