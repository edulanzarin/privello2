"use client";

import * as React from "react";
import Link from "next/link";
import { useActionState } from "react";

import {
    BanknoteIcon,
    Button,
    CalendarIcon,
    CashIcon,
    ChipGroup,
    CreditCardIcon,
    Input,
    PixIcon,
} from "@/components";

import {
    DIAS_SEMANA,
    FORMAS_PAGAMENTO,
    VALOR_HORA_CENTS,
    type DiaSemana,
    type FormaPagamento,
} from "@/domain/atendimentoComercial";

import {
    SALVAR_ETAPA_INITIAL,
    type SalvarEtapaState,
} from "../../action-state";
import { salvarEtapaAction } from "../../actions";

/**
 * Step "Valores" do Onboarding_Acompanhante.
 *
 * Coleta os 3 dados de atendimento comercial:
 *
 *   1. **Valor da hora** (input com máscara R$ XX,XX) — convertido
 *      para centavos no submit.
 *   2. **Formas de pagamento** (ChipGroup multi com ícones por
 *      forma) — pelo menos 1 obrigatório.
 *   3. **Dias que atende** (ChipGroup multi com ícone de calendário
 *      no header) — pelo menos 1 obrigatório.
 *
 * Os ícones autorais reforçam o significado de cada chip
 * (dinheiro/PIX/cartão/transferência) sem depender só de texto.
 *
 * Camada server: o handler `salvarEtapaAction` (`actions.ts`)
 * recebe `valorHoraReais` (string formatada) e converte para
 * centavos antes de validar via Zod. Os arrays vêm como
 * `formasPagamento` e `diasAtende`.
 */
export interface ValoresStepProps {
    nextPath: string;
    previousPath: string | null;
    initialValues: {
        valorHoraCents?: number;
        formasPagamento?: ReadonlyArray<FormaPagamento>;
        diasAtende?: ReadonlyArray<DiaSemana>;
    };
}

const FORMA_PAGAMENTO_ICONS: Record<FormaPagamento, React.ReactElement> = {
    DINHEIRO: <CashIcon size={14} />,
    PIX: <PixIcon size={14} />,
    CARTAO_CREDITO: <CreditCardIcon size={14} />,
    CARTAO_DEBITO: <CreditCardIcon size={14} />,
    TRANSFERENCIA: <BanknoteIcon size={14} />,
};

export function ValoresStep({
    nextPath,
    previousPath,
    initialValues,
}: ValoresStepProps): React.ReactElement {
    const [state, formAction, pending] = useActionState<
        SalvarEtapaState,
        FormData
    >(salvarEtapaAction, SALVAR_ETAPA_INITIAL);

    const fieldErrors = state.fieldErrors ?? {};
    const values = state.values ?? {};

    // Estado controlado dos chips. Inicializa com `values` (eco da
    // tentativa anterior) ou `initialValues` (valores já no draft).
    const [formasPagamento, setFormasPagamento] = React.useState<
        ReadonlyArray<string>
    >(() => {
        if (Array.isArray(values.formasPagamento)) {
            return values.formasPagamento as ReadonlyArray<string>;
        }
        return (initialValues.formasPagamento ?? []) as ReadonlyArray<string>;
    });
    const [diasAtende, setDiasAtende] = React.useState<ReadonlyArray<string>>(
        () => {
            if (Array.isArray(values.diasAtende)) {
                return values.diasAtende as ReadonlyArray<string>;
            }
            return (initialValues.diasAtende ?? []) as ReadonlyArray<string>;
        },
    );

    const valorHoraDefault =
        typeof values.valorHoraReais === "string"
            ? values.valorHoraReais
            : initialValues.valorHoraCents !== undefined
                ? formatarReaisInput(initialValues.valorHoraCents)
                : "";

    const [valorHora, setValorHora] = React.useState(valorHoraDefault);

    return (
        <form action={formAction} className="flex flex-col gap-5" noValidate>
            <input type="hidden" name="_step" value="valores" />
            <input type="hidden" name="_next" value={nextPath} />

            {/* Inputs hidden espelham seleções dos chips controlados,
                pra que o formData receba arrays corretos no submit. */}
            {formasPagamento.map((v) => (
                <input
                    key={v}
                    type="hidden"
                    name="formasPagamento"
                    value={v}
                />
            ))}
            {diasAtende.map((v) => (
                <input key={v} type="hidden" name="diasAtende" value={v} />
            ))}

            <Input
                label="Valor da hora"
                name="valorHoraReais"
                type="text"
                inputMode="decimal"
                placeholder="250,00"
                leadingIcon={
                    <span className="text-[0.7rem] font-medium">R$</span>
                }
                value={valorHora}
                onChange={(e) => setValorHora(formatarValorInput(e.target.value))}
                error={Boolean(fieldErrors.valorHoraCents)}
                errorMessage={fieldErrors.valorHoraCents}
                hint={`Entre R$ ${(VALOR_HORA_CENTS.min / 100).toFixed(0)} e R$ ${(VALOR_HORA_CENTS.max / 100).toLocaleString("pt-BR")}.`}
                required
            />

            <ChipGroup
                label="Formas de pagamento"
                hint="Selecione todas as que você aceita."
                options={FORMAS_PAGAMENTO.map((o) => ({
                    value: o.value,
                    label: (
                        <span className="inline-flex items-center gap-1.5">
                            {FORMA_PAGAMENTO_ICONS[o.value]}
                            {o.label}
                        </span>
                    ),
                }))}
                value={formasPagamento}
                onChange={setFormasPagamento}
                error={Boolean(fieldErrors.formasPagamento)}
                errorMessage={fieldErrors.formasPagamento}
            />

            <ChipGroup
                label={
                    <span className="inline-flex items-center gap-1.5">
                        <CalendarIcon size={12} />
                        Dias que atende
                    </span>
                }
                hint="Selecione os dias da semana."
                options={DIAS_SEMANA.map((o) => ({
                    value: o.value,
                    label: o.label,
                }))}
                value={diasAtende}
                onChange={setDiasAtende}
                error={Boolean(fieldErrors.diasAtende)}
                errorMessage={fieldErrors.diasAtende}
            />

            {state.formError ? (
                <p role="alert" className="text-xs text-danger-700">
                    {state.formError}
                </p>
            ) : null}

            <div className="mt-2 flex items-center justify-between gap-3">
                {previousPath !== null ? (
                    <Link
                        href={previousPath}
                        className="text-xs font-medium text-text-secondary hover:text-text-primary"
                    >
                        ← Voltar
                    </Link>
                ) : (
                    <span />
                )}
                <Button type="submit" loading={pending}>
                    {pending ? "Salvando…" : "Continuar"}
                </Button>
            </div>
        </form>
    );
}

/**
 * Formata digitação livre em string "R$ XXX,XX" estável. Aceita só
 * dígitos do input e renderiza com vírgula nos centavos. O caller
 * mantém a string formatada no estado e o servidor extrai os centavos
 * derivando-os.
 */
function formatarValorInput(raw: string): string {
    const digits = raw.replace(/\D/g, "");
    if (digits.length === 0) return "";
    const padded = digits.padStart(3, "0");
    const reais = padded.slice(0, padded.length - 2);
    const centavos = padded.slice(-2);
    const reaisLimpos = reais.replace(/^0+(?=\d)/, "");
    const reaisFormatados = Number(reaisLimpos || "0").toLocaleString("pt-BR");
    return `${reaisFormatados},${centavos}`;
}

/**
 * Inverso: centavos do banco → string "X.XXX,XX" para preencher o
 * input quando o usuário volta ao step.
 */
function formatarReaisInput(cents: number): string {
    if (!Number.isFinite(cents) || cents <= 0) return "";
    const reais = Math.floor(cents / 100);
    const cent = cents % 100;
    return `${reais.toLocaleString("pt-BR")},${cent.toString().padStart(2, "0")}`;
}
