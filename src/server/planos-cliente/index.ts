/**
 * Sistema_de_Planos_Cliente — serviço de seleção e renovação de
 * plano de Cliente.
 *
 * O plano `FAN` agora tem duração comprável (24h, 7 dias, 30 dias).
 * O `selecionar` aceita a chave de duração e calcula
 * `planoExpiraEm = now + duracaoMs`. Se o Cliente já tem `FAN`
 * ativo, comprar nova duração **estende** a janela existente
 * (cumulativo) — comprar 24h em cima de 5 dias restantes vira
 * "6 dias restantes".
 *
 * Garantias mantidas:
 *
 * - Strings inválidas viram `INVALIDO` sem tocar no banco.
 * - Falhas de I/O viram `PERSISTENCIA`.
 * - Downgrade ativo (`FAN → GRATIS` enquanto `planoExpiraEm > now`)
 *   é proibido.
 *
 * Quando o `planoExpiraEm` expira, leitura via {@link obterVigente}
 * retorna `GRATIS` automaticamente — o backend nunca trata um
 * Cliente expirado como `FAN`. O downgrade físico no banco
 * (`planoVigente: GRATIS`) é feito por GC noturno (não bloqueante).
 */

import {
    PLANO_CLIENTE_DEFINITIONS,
    PLANO_CLIENTE_DURACOES,
    isPlanoClienteTipo,
    podeAlterarPlanoCliente,
    type PlanoClienteDefinition,
    type PlanoClienteDuracao,
    type PlanoClienteTipo,
} from "@/domain/plano-cliente/definitions";
import { db } from "@/lib/db";

// ---------------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------------

/**
 * Resultado de {@link selecionar} (mudança gratuita: `GRATIS` ou
 * idempotente).
 */
export type SelecionarPlanoClienteResult =
    | { ok: true }
    | {
        ok: false;
        reason:
            | "INVALIDO"
            | "DOWNGRADE_NAO_PERMITIDO"
            | "PERSISTENCIA";
    };

/**
 * Resultado de {@link comprarFan}.
 *
 * - `ok`: a compra foi aplicada. `expiraEm` é a nova data de fim.
 *   Se já havia plano ativo, foi estendida.
 * - `INVALIDO`: chave de duração desconhecida.
 * - `PERSISTENCIA`: falha de I/O. Estado anterior preservado.
 */
export type ComprarFanResult =
    | { ok: true; expiraEm: Date }
    | { ok: false; reason: "INVALIDO" | "PERSISTENCIA" };

/** Opções injetáveis para testes determinísticos. */
export type SelecionarPlanoClienteOptions = {
    /** Override do relógio. Default: `new Date()`. */
    now?: Date;
};

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

/**
 * Lista os planos disponíveis pra escolha. `GRATIS` é grátis (sem
 * duração); `FAN` aparece em 3 versões (24h, 7d, 30d) — caller
 * usa {@link PLANO_CLIENTE_DURACOES} pra montar as 3 opções de
 * compra.
 */
export function listar(): readonly PlanoClienteDefinition[] {
    return [
        PLANO_CLIENTE_DEFINITIONS.GRATIS,
        PLANO_CLIENTE_DEFINITIONS.FAN,
    ] as const;
}

/**
 * Registra `tipo` como plano vigente de `clienteId` — usado apenas
 * pra trocar pra `GRATIS` ou idempotência. Compras de `FAN`
 * (com duração) passam por {@link comprarFan}.
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
            select: { planoVigente: true, planoExpiraEm: true },
        });

        if (current === null) {
            return { ok: false, reason: "PERSISTENCIA" };
        }

        // Para FAN, este path só serve se a tela de seleção quiser
        // gravar `FAN` sem comprar (ex.: ambiente de dev/seed). Em
        // produção sempre passa por `comprarFan`. Mantemos suporte
        // sem expiração — caller é responsável.
        if (current.planoVigente === tipo) {
            return { ok: true };
        }

        if (!podeAlterarPlanoCliente(current.planoVigente, tipo)) {
            // FAN → GRATIS bloqueado enquanto o FAN não expirou.
            const aindaAtivo =
                current.planoExpiraEm !== null &&
                current.planoExpiraEm.getTime() > now.getTime();
            if (aindaAtivo) {
                return { ok: false, reason: "DOWNGRADE_NAO_PERMITIDO" };
            }
        }

        await db.clientProfile.update({
            where: { userId: clienteId },
            data: {
                planoVigente: tipo as PlanoClienteTipo,
                planoSelecionadoEm: now,
                // Trocar pra GRATIS limpa expiração; ir pra FAN
                // sem comprar (caso do seed) também limpa.
                planoExpiraEm: null,
            },
            select: { userId: true },
        });

        return { ok: true };
    } catch {
        return { ok: false, reason: "PERSISTENCIA" };
    }
}

/**
 * Aplica a compra de uma duração de Fan para `clienteId`.
 *
 * Computa `expiraEm`:
 *   - Se já tem Fan ativo (`planoExpiraEm > now`), **estende**:
 *     `expiraEm = planoExpiraEm + duracaoMs`. Permite cumular várias
 *     compras (ex.: 5 dias + 24h = 6 dias).
 *   - Senão, `expiraEm = now + duracaoMs`.
 *
 * Idempotência: cada chamada produz uma nova janela. Caller
 * (webhook MP, fluxo de checkout) é responsável por garantir que
 * a função só roda após pagamento confirmado.
 */
export async function comprarFan(
    clienteId: string,
    duracaoChave: string,
    opts: SelecionarPlanoClienteOptions = {},
): Promise<ComprarFanResult> {
    if (
        duracaoChave !== "FAN_24H" &&
        duracaoChave !== "FAN_7D" &&
        duracaoChave !== "FAN_30D"
    ) {
        return { ok: false, reason: "INVALIDO" };
    }

    const now = opts.now ?? new Date();
    const duracao = PLANO_CLIENTE_DURACOES[duracaoChave as PlanoClienteDuracao];

    try {
        const current = await db.clientProfile.findUnique({
            where: { userId: clienteId },
            select: { planoVigente: true, planoExpiraEm: true },
        });

        if (current === null) {
            return { ok: false, reason: "PERSISTENCIA" };
        }

        // Base de cálculo: maior entre `now` e `planoExpiraEm`
        // existente. Estende em vez de sobrescrever.
        const baseMs = Math.max(
            now.getTime(),
            current.planoExpiraEm?.getTime() ?? 0,
        );
        const expiraEm = new Date(baseMs + duracao.duracaoMs);

        await db.clientProfile.update({
            where: { userId: clienteId },
            data: {
                planoVigente: "FAN",
                planoSelecionadoEm: now,
                planoExpiraEm: expiraEm,
            },
            select: { userId: true },
        });

        return { ok: true, expiraEm };
    } catch {
        return { ok: false, reason: "PERSISTENCIA" };
    }
}

/**
 * Lê o plano vigente de `clienteId` aplicando expiração lazy.
 *
 * Quando `planoVigente === "FAN"` mas `planoExpiraEm <= now`, o
 * retorno é `GRATIS` (downgrade lazy). O banco não é tocado aqui —
 * a normalização física fica pro GC noturno. Garantia importante:
 * mesmo que o GC esteja fora do ar, a aplicação trata o Cliente
 * como `GRATIS` corretamente.
 */
export async function obterVigente(
    clienteId: string,
    opts: SelecionarPlanoClienteOptions = {},
): Promise<PlanoClienteDefinition | null> {
    const now = opts.now ?? new Date();

    const profile = await db.clientProfile.findUnique({
        where: { userId: clienteId },
        select: { planoVigente: true, planoExpiraEm: true },
    });

    if (!profile || profile.planoVigente === null) {
        return null;
    }

    if (
        profile.planoVigente === "FAN" &&
        profile.planoExpiraEm !== null &&
        profile.planoExpiraEm.getTime() <= now.getTime()
    ) {
        return PLANO_CLIENTE_DEFINITIONS.GRATIS;
    }

    return PLANO_CLIENTE_DEFINITIONS[profile.planoVigente];
}
