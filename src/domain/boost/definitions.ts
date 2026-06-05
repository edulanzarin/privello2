/**
 * Definições canônicas do Boost.
 *
 * Boost é uma promoção paga de 24 horas que dá:
 *   - Prioridade total nas buscas (ranking acima de Premium e Básico).
 *   - Destaque na home pública (carrossel de "boostadas agora").
 *
 * Disponível para qualquer Acompanhante com plano vigente
 * (`Básico` ou `Premium`), independente do tier. O preço é fixo em
 * R$ 9,90 por janela de 24h. Múltiplas compras estendem a janela
 * cumulativamente (cada compra adiciona 24h ao `boostUntil` atual,
 * se já houver, ou começa contando a partir de NOW se não houver).
 *
 * Esta é a única fonte de verdade para preço e duração — código de
 * UI, server e cobrança consomem daqui.
 */

/**
 * Preço do boost em centavos (BRL). Mantido como inteiro para
 * evitar imprecisão de ponto flutuante. Stripe aceita
 * valores em centavos diretamente na API.
 *
 * R$ 9,90 = 990 centavos.
 */
export const BOOST_PRICE_CENTS = 990 as const;

/** Moeda canônica. ISO 4217. */
export const BOOST_CURRENCY = "BRL" as const;

/**
 * Duração da janela em milissegundos (24h). Usada quando o webhook
 * aprova o pagamento e estende o `boostUntil` da Acompanhante.
 */
export const BOOST_DURATION_MS = 24 * 60 * 60 * 1000;

/**
 * Formata o preço em string amigável BRL ("R$ 9,90").
 */
export function formatarPrecoBoost(): string {
    const reais = Math.floor(BOOST_PRICE_CENTS / 100);
    const centavos = BOOST_PRICE_CENTS % 100;
    const centavosStr = centavos.toString().padStart(2, "0");
    return `R$ ${reais},${centavosStr}`;
}

/**
 * Verifica se uma data de expiração ainda está no futuro.
 *
 * Convenção: `null` significa "nunca teve boost" e devolve `false`.
 * Datas exatamente iguais a `now` são consideradas expiradas
 * (estritamente maior que agora).
 */
export function isBoostAtivo(
    boostUntil: Date | null,
    now: Date = new Date(),
): boolean {
    if (boostUntil === null) return false;
    return boostUntil.getTime() > now.getTime();
}

/**
 * Calcula a próxima `boostUntil` ao processar um pagamento aprovado.
 *
 * Regra: cada compra adiciona 24h.
 * - Se ainda há boost ativo (`current > now`), a nova janela
 *   começa a contar a partir do fim atual: `current + 24h`.
 * - Se não há boost ativo (ou já expirou), começa a contar de
 *   `now`: `now + 24h`.
 *
 * Isso permite que a Acompanhante compre boost durante uma janela
 * já ativa para "estender" sem perder horas.
 */
export function calcularNovoBoostUntil(
    current: Date | null,
    now: Date = new Date(),
): Date {
    const base =
        current !== null && current.getTime() > now.getTime()
            ? current
            : now;
    return new Date(base.getTime() + BOOST_DURATION_MS);
}

/**
 * Janela máxima (em ms) de antecedência pra agendar um Boost.
 * Limita o `startAt` a no máximo 30 dias no futuro — agendar pra
 * data muito distante não faz sentido pro produto e evita registros
 * "fantasma" parados por meses.
 */
export const BOOST_AGENDAMENTO_MAX_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Folga mínima (em ms) pra considerar um `startAt` como "futuro"
 * de fato. Abaixo disso (ex.: agendar pra daqui a 30s), tratamos
 * como "começar agora" — não vale a pena criar um agendamento que
 * o cron ativaria quase imediatamente.
 */
export const BOOST_AGENDAMENTO_MIN_MS = 5 * 60 * 1000;

/**
 * Resultado da normalização de um `startAt` informado pelo usuário.
 *
 * - `{ kind: "imediato" }`: ativa assim que o pagamento aprovar.
 * - `{ kind: "agendado", startAt }`: ativa no `startAt` via cron.
 * - `{ kind: "invalido", reason }`: data malformada ou fora dos
 *   limites aceitos.
 */
export type BoostStartAtNormalizado =
    | { kind: "imediato" }
    | { kind: "agendado"; startAt: Date }
    | { kind: "invalido"; reason: "DATA_INVALIDA" | "FORA_DA_JANELA" };

/**
 * Normaliza o `startAt` informado no checkout.
 *
 * - `null`/`undefined` → imediato.
 * - Data inválida (não-parseável) → inválido `DATA_INVALIDA`.
 * - Data no passado ou a menos de {@link BOOST_AGENDAMENTO_MIN_MS}
 *   no futuro → imediato (não compensa agendar).
 * - Data a mais de {@link BOOST_AGENDAMENTO_MAX_MS} no futuro →
 *   inválido `FORA_DA_JANELA`.
 * - Caso contrário → agendado.
 */
export function normalizarBoostStartAt(
    raw: string | Date | null | undefined,
    now: Date = new Date(),
): BoostStartAtNormalizado {
    if (raw === null || raw === undefined || raw === "") {
        return { kind: "imediato" };
    }
    const date = raw instanceof Date ? raw : new Date(raw);
    if (Number.isNaN(date.getTime())) {
        return { kind: "invalido", reason: "DATA_INVALIDA" };
    }
    const delta = date.getTime() - now.getTime();
    if (delta < BOOST_AGENDAMENTO_MIN_MS) {
        // Passado ou quase-agora: trata como imediato.
        return { kind: "imediato" };
    }
    if (delta > BOOST_AGENDAMENTO_MAX_MS) {
        return { kind: "invalido", reason: "FORA_DA_JANELA" };
    }
    return { kind: "agendado", startAt: date };
}
