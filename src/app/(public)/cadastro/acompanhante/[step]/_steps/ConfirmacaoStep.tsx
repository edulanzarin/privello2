"use client";

import * as React from "react";
import Link from "next/link";
import { useActionState } from "react";

import {
    Avatar,
    Button,
    MailIcon,
    MapPinIcon,
    PhoneIcon,
} from "@/components";
import {
    CORES_OLHOS,
    ESTILOS_CABELO,
    ETNIAS,
    IDIOMAS,
    TAMANHOS_CABELO,
} from "@/domain/aparencia/definitions";
import { GENEROS } from "@/domain/genero";
import { ATENDE, PRATICAS } from "@/domain/atendimento";
import {
    DIAS_SEMANA,
    FORMAS_PAGAMENTO,
    formatarValorHora,
} from "@/domain/atendimentoComercial";

import {
    FINALIZAR_INITIAL,
    type FinalizarState,
} from "../../action-state";
import { finalizarAction } from "../../actions";

/**
 * Step 7 — Confirmação (Requirement 3.11).
 *
 * Resumo final dos dados antes de chamar `finalizar`. Renderiza:
 *
 * - Avatar grande + nome + @identificador, com badge tipográfico.
 * - Bloco "Contato" (email, telefone, cidade/UF, bairro se houver).
 * - Bloco "Aparência" (peso, altura, pé, etnia, olhos, cabelos).
 * - Bloco "Estilo de vida" (silicone/tatuagens/piercing/fumante via
 *   chips Sim/Não) e idiomas falados.
 * - Descrição.
 *
 * Os mapas `value → label` são consumidos diretamente das listas
 * canônicas em `@/domain/aparencia/definitions` para evitar duplicação
 * de cópia pt-BR.
 */

export interface ConfirmacaoStepProps {
    previousPath: string | null;
    draftData: Record<string, unknown>;
    stagedKey: string | null;
}

export function ConfirmacaoStep({
    previousPath,
    draftData,
    stagedKey,
}: ConfirmacaoStepProps): React.ReactElement {
    const [state, formAction, pending] = useActionState<
        FinalizarState,
        FormData
    >(finalizarAction, FINALIZAR_INITIAL);

    const nome = pickStr(draftData, "nome") ?? "—";
    const email = pickStr(draftData, "email") ?? "—";
    const identificador = pickStr(draftData, "identificador");
    const telefoneRaw = pickStr(draftData, "telefone");
    const telefone = telefoneRaw ? formatPhone(telefoneRaw) : "—";
    const cidade = formatCidade(draftData);
    const bairro = pickStr(draftData, "bairroNome");
    const descricao = pickStr(draftData, "descricao") ?? "";

    const pesoKg = pickNum(draftData, "pesoKg");
    const alturaCm = pickNum(draftData, "alturaCm");
    const tamanhoPe = pickNum(draftData, "tamanhoPe");
    const etnia = labelFor(ETNIAS, pickStr(draftData, "etnia"));
    const corOlhos = labelFor(CORES_OLHOS, pickStr(draftData, "corOlhos"));
    const estiloCabelo = labelFor(
        ESTILOS_CABELO,
        pickStr(draftData, "estiloCabelo"),
    );
    const tamanhoCabelo = labelFor(
        TAMANHOS_CABELO,
        pickStr(draftData, "tamanhoCabelo"),
    );
    const temSilicone = pickBool(draftData, "temSilicone") ?? false;
    const temTatuagens = pickBool(draftData, "temTatuagens") ?? false;
    const temPiercing = pickBool(draftData, "temPiercing") ?? false;
    const fumante = pickBool(draftData, "fumante") ?? false;
    const idiomasValues = pickStrArr(draftData, "idiomas");
    const idiomas = idiomasValues
        .map((v) => labelFor(IDIOMAS, v))
        .filter((v): v is string => Boolean(v));

    const genero = labelFor(GENEROS, pickStr(draftData, "genero"));
    const atendeValues = pickStrArr(draftData, "atendePublicos");
    const atende = atendeValues
        .map((v) => labelFor(ATENDE, v))
        .filter((v): v is string => Boolean(v));
    const praticasValues = pickStrArr(draftData, "realizaPraticas");
    const praticas = praticasValues
        .map((v) => labelFor(PRATICAS, v))
        .filter((v): v is string => Boolean(v));

    // Atendimento comercial — valor da hora, formas de pagamento, dias.
    const valorHoraCents = pickNum(draftData, "valorHoraCents");
    const valorHora =
        valorHoraCents !== undefined && valorHoraCents > 0
            ? formatarValorHora(valorHoraCents)
            : "—";
    const formasPagamentoValues = pickStrArr(draftData, "formasPagamento");
    const formasPagamentoLabels = formasPagamentoValues
        .map((v) => labelFor(FORMAS_PAGAMENTO, v))
        .filter((v): v is string => Boolean(v));
    const diasAtendeValues = pickStrArr(draftData, "diasAtende");
    const diasAtendeLabels = diasAtendeValues
        .map((v) =>
            labelFor(
                DIAS_SEMANA.map((d) => ({
                    value: d.value,
                    label: d.longLabel,
                })),
                v,
            ),
        )
        .filter((v): v is string => Boolean(v));

    // Em dev, a foto staged é servida via /api/storage/staged/<uuid>.
    const avatarUrl = stagedKey ? `/api/storage/${stagedKey}` : null;

    return (
        <div className="flex flex-col gap-5">
            {/* Identidade: avatar grande + nome + @ */}
            <div className="flex flex-col items-center gap-3 rounded-md border border-neutral-200 bg-neutral-50 p-6">
                <Avatar src={avatarUrl} name={nome} size="xl" />
                <div className="flex flex-col items-center gap-0.5 text-center">
                    <span className="text-base font-semibold text-text-primary">
                        {nome}
                    </span>
                    {identificador ? (
                        <span className="text-xs text-text-secondary">
                            @{identificador}
                        </span>
                    ) : null}
                </div>
            </div>

            {/* Contato + localização */}
            <Section title="Contato">
                <Linha icon={<MailIcon size={14} />} value={email} />
                <Linha icon={<PhoneIcon size={14} />} value={telefone} />
                <Linha
                    icon={<MapPinIcon size={14} />}
                    value={
                        bairro && cidade !== "—"
                            ? `${bairro} · ${cidade}`
                            : cidade
                    }
                />
            </Section>

            {/* Aparência */}
            <Section title="Aparência">
                <Grid>
                    <Item label="Peso" value={pesoKg ? `${pesoKg} kg` : "—"} />
                    <Item label="Altura" value={alturaCm ? `${alturaCm} cm` : "—"} />
                    <Item
                        label="Tamanho do pé"
                        value={tamanhoPe ? String(tamanhoPe) : "—"}
                    />
                    <Item label="Etnia" value={etnia ?? "—"} />
                    <Item label="Cor dos olhos" value={corOlhos ?? "—"} />
                    <Item label="Cabelo" value={joinCabelo(estiloCabelo, tamanhoCabelo)} />
                </Grid>
            </Section>

            {/* Estilo de vida */}
            <Section title="Estilo de vida">
                <Grid>
                    <Item label="Silicone" value={simNao(temSilicone)} />
                    <Item label="Tatuagens" value={simNao(temTatuagens)} />
                    <Item label="Piercing" value={simNao(temPiercing)} />
                    <Item label="Fumante" value={simNao(fumante)} />
                </Grid>
                {idiomas.length > 0 ? (
                    <div className="mt-3 flex flex-col gap-1">
                        <span className="text-[0.7rem] font-medium uppercase tracking-wider text-text-secondary">
                            Idiomas
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                            {idiomas.map((label) => (
                                <span
                                    key={label}
                                    className="inline-flex items-center rounded-full border border-neutral-200 bg-surface px-2.5 py-0.5 text-xs text-text-primary"
                                >
                                    {label}
                                </span>
                            ))}
                        </div>
                    </div>
                ) : null}
            </Section>

            {/* Identidade + público que atende */}
            <Section title="Identidade e atendimento">
                <Grid>
                    <Item label="Gênero" value={genero ?? "—"} />
                </Grid>
                {atende.length > 0 ? (
                    <ChipList label="Atende" items={atende} />
                ) : null}
            </Section>

            {/* Práticas */}
            {praticas.length > 0 ? (
                <Section title="Práticas">
                    <ChipList label="Realiza" items={praticas} />
                </Section>
            ) : null}

            {/* Atendimento comercial */}
            <Section title="Atendimento">
                <Grid>
                    <Item label="Valor da hora" value={valorHora} />
                </Grid>
                {formasPagamentoLabels.length > 0 ? (
                    <ChipList
                        label="Formas de pagamento"
                        items={formasPagamentoLabels}
                    />
                ) : null}
                {diasAtendeLabels.length > 0 ? (
                    <ChipList label="Dias que atende" items={diasAtendeLabels} />
                ) : null}
            </Section>

            {/* Descrição */}
            {descricao ? (
                <Section title="Descrição">
                    <p className="whitespace-pre-line text-sm leading-relaxed text-text-primary">
                        {descricao}
                    </p>
                </Section>
            ) : null}

            {state.error ? (
                <p role="alert" className="text-xs text-danger-700">
                    {state.error}
                </p>
            ) : null}

            <form action={formAction} className="flex flex-col gap-3">
                <Button type="submit" loading={pending} className="w-full">
                    {pending ? "Concluindo." : "Concluir cadastro"}
                </Button>
                {previousPath !== null ? (
                    <Link
                        href={previousPath}
                        className="text-center text-xs font-medium text-text-secondary hover:text-text-primary"
                    >
                        Voltar e editar
                    </Link>
                ) : null}
            </form>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Layout helpers locais
// ---------------------------------------------------------------------------

/**
 * Bloco com título uppercase + conteúdo. Mantido local porque é
 * deliberadamente acoplado ao layout deste passo (legend pequeno +
 * card branco + borda fina). Quando outros passos quiserem o mesmo
 * padrão de "ficha" no painel da Acompanhante, promovemos pra primitivo.
 */
function Section({
    title,
    children,
}: {
    title: string;
    children: React.ReactNode;
}): React.ReactElement {
    return (
        <section className="flex flex-col gap-3 rounded-md border border-neutral-200 bg-surface p-4">
            <h2 className="text-[0.7rem] font-semibold uppercase tracking-wider text-text-secondary">
                {title}
            </h2>
            <div className="flex flex-col gap-2">{children}</div>
        </section>
    );
}

function Grid({ children }: { children: React.ReactNode }): React.ReactElement {
    return (
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
            {children}
        </div>
    );
}

function Item({
    label,
    value,
}: {
    label: string;
    value: string;
}): React.ReactElement {
    return (
        <div className="flex flex-col gap-0.5">
            <span className="text-[0.65rem] font-medium uppercase tracking-wider text-text-secondary">
                {label}
            </span>
            <span className="text-sm text-text-primary">{value}</span>
        </div>
    );
}

function Linha({
    icon,
    value,
}: {
    icon: React.ReactNode;
    value: string;
}): React.ReactElement {
    return (
        <div className="flex items-center gap-2 text-sm text-text-primary">
            <span aria-hidden="true" className="text-text-disabled">
                {icon}
            </span>
            <span className="truncate">{value}</span>
        </div>
    );
}

/**
 * Lista de chips read-only com label uppercase. Usada para idiomas,
 * atende, práticas e fetiches no resumo. Mantida local porque o
 * estilo é deliberadamente acoplado ao layout deste passo (chips
 * estáticos, sem interação).
 */
function ChipList({
    label,
    items,
}: {
    label: string;
    items: ReadonlyArray<string>;
}): React.ReactElement {
    return (
        <div className="mt-1 flex flex-col gap-1">
            <span className="text-[0.7rem] font-medium uppercase tracking-wider text-text-secondary">
                {label}
            </span>
            <div className="flex flex-wrap gap-1.5">
                {items.map((label) => (
                    <span
                        key={label}
                        className="inline-flex items-center rounded-full border border-neutral-200 bg-surface px-2.5 py-0.5 text-xs text-text-primary"
                    >
                        {label}
                    </span>
                ))}
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Pickers e formatters
// ---------------------------------------------------------------------------

function pickStr(
    payload: Record<string, unknown>,
    key: string,
): string | undefined {
    const v = payload[key];
    return typeof v === "string" && v.length > 0 ? v : undefined;
}

function pickNum(
    payload: Record<string, unknown>,
    key: string,
): number | undefined {
    const v = payload[key];
    return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

function pickBool(
    payload: Record<string, unknown>,
    key: string,
): boolean | undefined {
    const v = payload[key];
    return typeof v === "boolean" ? v : undefined;
}

function pickStrArr(
    payload: Record<string, unknown>,
    key: string,
): string[] {
    const v = payload[key];
    if (!Array.isArray(v)) return [];
    return (v as unknown[]).filter((x): x is string => typeof x === "string");
}

function labelFor(
    options: ReadonlyArray<{ value: string; label: string }>,
    value: string | undefined,
): string | undefined {
    if (!value) return undefined;
    return options.find((o) => o.value === value)?.label;
}

function joinCabelo(
    estilo: string | undefined,
    tamanho: string | undefined,
): string {
    const partes = [estilo, tamanho].filter(
        (v): v is string => typeof v === "string" && v.length > 0,
    );
    return partes.length > 0 ? partes.join(", ") : "—";
}

function simNao(value: boolean): string {
    return value ? "Sim" : "Não";
}

function formatCidade(payload: Record<string, unknown>): string {
    const cidade = pickStr(payload, "cidadeNome");
    const uf = pickStr(payload, "estadoSigla");
    if (cidade && uf) return `${cidade}, ${uf}`;
    return "—";
}

function formatPhone(raw: string): string {
    const digits = raw.replace(/\D/g, "");
    if (digits.length === 11) {
        return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    }
    if (digits.length === 10) {
        return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    }
    return raw;
}
