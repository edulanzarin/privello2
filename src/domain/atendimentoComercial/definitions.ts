/**
 * Definições canônicas do atendimento comercial da Acompanhante.
 *
 * Três blocos:
 *
 *   1. {@link FormaPagamento} — formas de pagamento aceitas.
 *   2. {@link DiaSemana} — dias em que ela atende.
 *   3. {@link VALOR_HORA_CENTS} — range válido do valor da hora,
 *      armazenado em **centavos** (BRL) para evitar imprecisão de
 *      ponto flutuante.
 *
 * As listas exportadas alimentam:
 *   - o step `Valores` do Onboarding_Acompanhante (ChipGroups + Input);
 *   - schemas Zod do servidor (validação per-valor);
 *   - o painel `EditarPerfilModal` para edição;
 *   - filtros futuros da busca pública.
 */

// ---------------------------------------------------------------------------
// FormaPagamento
// ---------------------------------------------------------------------------

export type FormaPagamento =
    | "DINHEIRO"
    | "PIX"
    | "CARTAO_CREDITO"
    | "CARTAO_DEBITO"
    | "TRANSFERENCIA";

export type OpcaoFormaPagamento = {
    value: FormaPagamento;
    label: string;
};

export const FORMAS_PAGAMENTO = [
    { value: "DINHEIRO", label: "Dinheiro" },
    { value: "PIX", label: "PIX" },
    { value: "CARTAO_CREDITO", label: "Crédito" },
    { value: "CARTAO_DEBITO", label: "Débito" },
    { value: "TRANSFERENCIA", label: "Transferência" },
] as const satisfies readonly OpcaoFormaPagamento[];

export function isFormaPagamento(value: unknown): value is FormaPagamento {
    return FORMAS_PAGAMENTO.some((o) => o.value === value);
}

// ---------------------------------------------------------------------------
// DiaSemana
// ---------------------------------------------------------------------------

export type DiaSemana = "SEG" | "TER" | "QUA" | "QUI" | "SEX" | "SAB" | "DOM";

export type OpcaoDiaSemana = {
    value: DiaSemana;
    /** Rótulo curto exibido em chips/badges ("Seg", "Ter"...). */
    label: string;
    /** Rótulo longo exibido no painel ("Segunda", "Terça"...). */
    longLabel: string;
};

export const DIAS_SEMANA = [
    { value: "SEG", label: "Seg", longLabel: "Segunda" },
    { value: "TER", label: "Ter", longLabel: "Terça" },
    { value: "QUA", label: "Qua", longLabel: "Quarta" },
    { value: "QUI", label: "Qui", longLabel: "Quinta" },
    { value: "SEX", label: "Sex", longLabel: "Sexta" },
    { value: "SAB", label: "Sáb", longLabel: "Sábado" },
    { value: "DOM", label: "Dom", longLabel: "Domingo" },
] as const satisfies readonly OpcaoDiaSemana[];

export function isDiaSemana(value: unknown): value is DiaSemana {
    return DIAS_SEMANA.some((o) => o.value === value);
}

// ---------------------------------------------------------------------------
// Valor da hora
// ---------------------------------------------------------------------------

/**
 * Range válido do valor da hora em centavos (BRL).
 *
 * Mínimo: 50,00 BRL (5000 centavos) — abaixo disso provavelmente é
 * digitação errada.
 * Máximo: 5.000,00 BRL (500000 centavos) — teto generoso pra cobrir
 * tarifas premium sem deixar o campo virar livre demais.
 */
export const VALOR_HORA_CENTS = { min: 5_000, max: 500_000 } as const;

/**
 * Formata valor em centavos como string BRL "R$ 350,00".
 */
export function formatarValorHora(cents: number): string {
    if (!Number.isFinite(cents) || cents < 0) return "—";
    const reais = Math.floor(cents / 100);
    const cent = cents % 100;
    return `R$ ${reais.toLocaleString("pt-BR")},${cent.toString().padStart(2, "0")}`;
}
