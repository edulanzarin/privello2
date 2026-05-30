"use client";

import * as React from "react";

import {
    AtIcon,
    Card,
    InfoList,
    InfoRow,
    LinkButton,
    MailIcon,
    MapPinIcon,
    PencilIcon,
    PhoneIcon,
    SectionHeader,
    UserIcon,
    useModal,
} from "@/components";

import {
    CORES_OLHOS,
    ESTILOS_CABELO,
    ETNIAS,
    IDIOMAS,
    TAMANHOS_CABELO,
} from "@/domain/aparencia/definitions";
import { ATENDE, PRATICAS } from "@/domain/atendimento";
import {
    DIAS_SEMANA,
    FORMAS_PAGAMENTO,
    formatarValorHora,
} from "@/domain/atendimentoComercial";
import { GENEROS } from "@/domain/genero";

import type { PerfilAcompanhantePainel } from "@/server/acompanhante-profile";

import { EditarLocalizacaoModal } from "./EditarLocalizacaoModal";
import { EditarPerfilModal } from "./EditarPerfilModal";

/**
 * Aba "Perfil" do painel da Acompanhante.
 *
 * Estruturada em 4 seções:
 *
 * 1. **Descrição** — bloco texto + InfoRows básicas (nome, @, email,
 *    telefone). "Editar" abre o {@link EditarPerfilModal} (que tem
 *    abas pra todos os campos editáveis exceto localização).
 * 2. **Localização** — InfoRow específica que abre o
 *    {@link EditarLocalizacaoModal} dedicado.
 * 3. **Atendimento** — gênero (badge), públicos atendidos (chips),
 *    práticas (chips).
 * 4. **Aparência** — medidas, cor/etnia/cabelo (read-only Items),
 *    estilo de vida (Sim/Não), idiomas (chips).
 *
 * Tudo read-only — toda edição mora no modal.
 */
export interface PerfilTabProps {
    perfil: PerfilAcompanhantePainel;
}

export function PerfilTab({ perfil }: PerfilTabProps): React.ReactElement {
    const editar = useModal();
    const editarLoc = useModal();
    const telefone = formatTelefone(perfil.telefone);
    const localizacao = formatLocalizacao(
        perfil.bairroNome,
        perfil.cidadeNome,
        perfil.estadoSigla,
    );

    const generoLabel = labelFor(GENEROS, perfil.genero);
    const atendeLabels = perfil.atendePublicos
        .map((v) => labelFor(ATENDE, v))
        .filter((v): v is string => Boolean(v));
    const praticasLabels = perfil.realizaPraticas
        .map((v) => labelFor(PRATICAS, v))
        .filter((v): v is string => Boolean(v));
    const idiomasLabels = perfil.idiomas
        .map((v) => labelFor(IDIOMAS, v))
        .filter((v): v is string => Boolean(v));

    // Atendimento comercial — valor da hora, formas de pagamento, dias.
    const valorHoraLabel =
        perfil.valorHoraCents !== null && perfil.valorHoraCents > 0
            ? formatarValorHora(perfil.valorHoraCents)
            : "—";
    const formasPagamentoLabels = perfil.formasPagamento
        .map((v) => labelFor(FORMAS_PAGAMENTO, v))
        .filter((v): v is string => Boolean(v));
    const diasAtendeLabels = perfil.diasAtende
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

    return (
        <div className="flex flex-col gap-5">
            {/* Identidade + descrição */}
            <section className="flex flex-col gap-3">
                <SectionHeader
                    title="Dados do perfil"
                    trailing={
                        <LinkButton
                            onClick={editar.open}
                            icon={<PencilIcon size={12} />}
                            aria-label="Editar dados do perfil"
                        >
                            Editar
                        </LinkButton>
                    }
                />

                <Card>
                    {perfil.descricao ? (
                        <p className="whitespace-pre-line text-sm leading-relaxed text-text-primary">
                            {perfil.descricao}
                        </p>
                    ) : (
                        <p className="text-sm text-text-secondary">
                            Sua descrição ainda está vazia. Clique em
                            Editar para preencher.
                        </p>
                    )}
                </Card>

                <InfoList>
                    <InfoRow
                        icon={<UserIcon size={14} />}
                        label="Nome"
                        value={perfil.nome}
                        hideLabel
                    />
                    <InfoRow
                        icon={<AtIcon size={14} />}
                        label="Nome de usuário"
                        value={`@${perfil.identificador}`}
                        hideLabel
                        locked
                        lockedReason="O nome de usuário não pode ser alterado."
                    />
                    <InfoRow
                        icon={<MapPinIcon size={14} />}
                        label="Localização"
                        value={localizacao}
                        hideLabel
                        onEdit={editarLoc.open}
                    />
                    <InfoRow
                        icon={<PhoneIcon size={14} />}
                        label="Telefone"
                        value={telefone}
                        hideLabel
                    />
                    <InfoRow
                        icon={<MailIcon size={14} />}
                        label="Email"
                        value={perfil.email}
                        hideLabel
                        locked
                        lockedReason="O email não pode ser alterado."
                    />
                </InfoList>
            </section>

            {/* Atendimento — gênero + atende + práticas. Grid 2 cols
                em desktop pra não deixar tudo amontoado à esquerda. */}
            <section className="flex flex-col gap-3">
                <SectionHeader title="Atendimento" />
                <Card>
                    <div className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
                        <Item label="Gênero" value={generoLabel ?? "—"} />
                        <ChipList
                            label="Atende"
                            items={atendeLabels}
                            empty="Selecione no botão Editar."
                        />
                        <div className="sm:col-span-2">
                            <ChipList
                                label="Práticas"
                                items={praticasLabels}
                                empty="Selecione no botão Editar."
                            />
                        </div>
                    </div>
                </Card>
            </section>

            {/* Valores e disponibilidade — grid 2 cols pra distribuir
                Valor + Formas de pagamento na primeira linha e Dias
                ocupando a linha inteira embaixo. */}
            <section className="flex flex-col gap-3">
                <SectionHeader title="Valores e disponibilidade" />
                <Card>
                    <div className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
                        <Item label="Valor da hora" value={valorHoraLabel} />
                        <ChipList
                            label="Formas de pagamento"
                            items={formasPagamentoLabels}
                            empty="Selecione no botão Editar."
                        />
                        <div className="sm:col-span-2">
                            <ChipList
                                label="Dias que atende"
                                items={diasAtendeLabels}
                                empty="Selecione no botão Editar."
                            />
                        </div>
                    </div>
                </Card>
            </section>

            {/* Aparência — grid 3 cols pra estatísticas e estilo de
                vida; idiomas como ChipList full-width abaixo. */}
            <section className="flex flex-col gap-3">
                <SectionHeader title="Aparência" />
                <Card>
                    <div className="flex flex-col gap-5">
                        <Grid>
                            <Item
                                label="Peso"
                                value={
                                    perfil.pesoKg !== null
                                        ? `${perfil.pesoKg} kg`
                                        : "—"
                                }
                            />
                            <Item
                                label="Altura"
                                value={
                                    perfil.alturaCm !== null
                                        ? `${perfil.alturaCm} cm`
                                        : "—"
                                }
                            />
                            <Item
                                label="Pé"
                                value={
                                    perfil.tamanhoPe !== null
                                        ? String(perfil.tamanhoPe)
                                        : "—"
                                }
                            />
                            <Item
                                label="Etnia"
                                value={labelFor(ETNIAS, perfil.etnia) ?? "—"}
                            />
                            <Item
                                label="Cor dos olhos"
                                value={
                                    labelFor(CORES_OLHOS, perfil.corOlhos) ??
                                    "—"
                                }
                            />
                            <Item
                                label="Cabelo"
                                value={joinCabelo(
                                    labelFor(
                                        ESTILOS_CABELO,
                                        perfil.estiloCabelo,
                                    ),
                                    labelFor(
                                        TAMANHOS_CABELO,
                                        perfil.tamanhoCabelo,
                                    ),
                                )}
                            />
                        </Grid>

                        {/* Estilo de vida + idiomas — em desktop usa
                            grid 2 cols pra que estilo de vida e
                            idiomas dividam horizontalmente, evitando
                            o "empilhamento socado à esquerda". */}
                        <div className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
                            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                                <Item
                                    label="Silicone"
                                    value={simNao(perfil.temSilicone)}
                                />
                                <Item
                                    label="Tatuagens"
                                    value={simNao(perfil.temTatuagens)}
                                />
                                <Item
                                    label="Piercing"
                                    value={simNao(perfil.temPiercing)}
                                />
                                <Item
                                    label="Fumante"
                                    value={simNao(perfil.fumante)}
                                />
                            </div>
                            <ChipList
                                label="Idiomas"
                                items={idiomasLabels}
                                empty="Selecione no botão Editar."
                            />
                        </div>
                    </div>
                </Card>
            </section>

            <EditarPerfilModal
                open={editar.isOpen}
                onClose={editar.close}
                inicial={{
                    nome: perfil.nome,
                    descricao: perfil.descricao,
                    telefone: perfil.telefone,
                    genero: perfil.genero,
                    atendePublicos: perfil.atendePublicos,
                    realizaPraticas: perfil.realizaPraticas,
                    pesoKg: perfil.pesoKg,
                    alturaCm: perfil.alturaCm,
                    tamanhoPe: perfil.tamanhoPe,
                    etnia: perfil.etnia,
                    corOlhos: perfil.corOlhos,
                    estiloCabelo: perfil.estiloCabelo,
                    tamanhoCabelo: perfil.tamanhoCabelo,
                    temSilicone: perfil.temSilicone,
                    temTatuagens: perfil.temTatuagens,
                    temPiercing: perfil.temPiercing,
                    fumante: perfil.fumante,
                    idiomas: perfil.idiomas,
                    valorHoraCents: perfil.valorHoraCents,
                    formasPagamento: perfil.formasPagamento,
                    diasAtende: perfil.diasAtende,
                }}
            />

            <EditarLocalizacaoModal
                open={editarLoc.isOpen}
                onClose={editarLoc.close}
                inicial={{
                    estadoSigla: perfil.estadoSigla,
                    cidadeNome: perfil.cidadeNome,
                    bairroNome: perfil.bairroNome ?? "",
                }}
            />
        </div>
    );
}

// ---------------------------------------------------------------------------
// Layout helpers locais
// ---------------------------------------------------------------------------

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

function ChipList({
    label,
    items,
    empty,
}: {
    label: string;
    items: ReadonlyArray<string>;
    empty: string;
}): React.ReactElement {
    return (
        <div className="flex flex-col gap-1.5">
            <span className="text-[0.65rem] font-medium uppercase tracking-wider text-text-secondary">
                {label}
            </span>
            {items.length > 0 ? (
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
            ) : (
                <span className="text-xs text-text-secondary">{empty}</span>
            )}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

function formatTelefone(raw: string): string {
    const digits = raw.replace(/\D/g, "");
    if (digits.length === 11) {
        return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    }
    if (digits.length === 10) {
        return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    }
    return raw;
}

function formatLocalizacao(
    bairro: string | null,
    cidade: string,
    uf: string,
): string {
    const partes = [bairro, cidade, uf].filter(
        (x): x is string => typeof x === "string" && x.length > 0,
    );
    return partes.join(", ");
}

function labelFor(
    options: ReadonlyArray<{ value: string; label: string }>,
    value: string | null | undefined,
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

function simNao(value: boolean | null): string {
    if (value === null) return "—";
    return value ? "Sim" : "Não";
}
