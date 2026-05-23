"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import {
    BanknoteIcon,
    Button,
    CalendarIcon,
    CashIcon,
    ChipGroup,
    CreditCardIcon,
    Input,
    Modal,
    PhoneIcon,
    PixIcon,
    Select,
    Switch,
    TabList,
    TabPanel,
    TabTrigger,
    Tabs,
    UserIcon,
} from "@/components";

import {
    ALTURA_CM,
    CORES_OLHOS,
    ESTILOS_CABELO,
    ETNIAS,
    IDIOMAS,
    PESO_KG,
    TAMANHOS_CABELO,
    TAMANHO_PE,
    type CorOlhos,
    type EstiloCabelo,
    type Etnia,
    type Idioma,
    type TamanhoCabelo,
} from "@/domain/aparencia/definitions";
import {
    ATENDE,
    PRATICAS,
    type Atende,
    type Pratica,
} from "@/domain/atendimento";
import {
    DIAS_SEMANA,
    FORMAS_PAGAMENTO,
    VALOR_HORA_CENTS,
    type DiaSemana,
    type FormaPagamento,
} from "@/domain/atendimentoComercial";
import { GENEROS, type Genero } from "@/domain/genero";

/**
 * Modal de edição de perfil da Acompanhante.
 *
 * Concentra **todos** os campos editáveis em um único formulário
 * dividido em 3 abas — evita modais separados pra cada categoria e
 * dá ao usuário visão clara do que pode mudar:
 *
 * 1. **Geral**: nome, telefone, descrição.
 * 2. **Aparência**: medidas (peso/altura/pé), aparência (etnia, cor
 *    de olhos, estilo e tamanho de cabelo), estilo de vida (silicone/
 *    tatuagens/piercing/fumante), idiomas.
 * 3. **Atendimento**: gênero (single), públicos atendidos (multi),
 *    práticas (multi).
 *
 * Localização tem fluxo dedicado em
 * {@link import("./EditarLocalizacaoModal").EditarLocalizacaoModal}
 * por reusar o `LocalidadePicker` com cache IBGE/Overpass.
 *
 * Faz `POST /api/conta/perfil` com o patch parcial completo (todos os
 * campos das 3 abas em um único request) e dispara `router.refresh()`
 * no sucesso.
 */
export interface EditarPerfilModalProps {
    open: boolean;
    onClose: () => void;
    inicial: {
        nome: string;
        descricao: string;
        telefone: string;
        // Atendimento
        genero: Genero | null;
        atendePublicos: ReadonlyArray<Atende>;
        realizaPraticas: ReadonlyArray<Pratica>;
        // Aparência
        pesoKg: number | null;
        alturaCm: number | null;
        tamanhoPe: number | null;
        etnia: Etnia | null;
        corOlhos: CorOlhos | null;
        estiloCabelo: EstiloCabelo | null;
        tamanhoCabelo: TamanhoCabelo | null;
        temSilicone: boolean | null;
        temTatuagens: boolean | null;
        temPiercing: boolean | null;
        fumante: boolean | null;
        idiomas: ReadonlyArray<Idioma>;
        // Atendimento comercial
        valorHoraCents: number | null;
        formasPagamento: ReadonlyArray<FormaPagamento>;
        diasAtende: ReadonlyArray<DiaSemana>;
    };
}

const MAX_DESC = 1000;

const FORMA_PAGAMENTO_ICONS: Record<FormaPagamento, React.ReactElement> = {
    DINHEIRO: <CashIcon size={14} />,
    PIX: <PixIcon size={14} />,
    CARTAO_CREDITO: <CreditCardIcon size={14} />,
    CARTAO_DEBITO: <CreditCardIcon size={14} />,
    TRANSFERENCIA: <BanknoteIcon size={14} />,
};

export function EditarPerfilModal({
    open,
    onClose,
    inicial,
}: EditarPerfilModalProps): React.ReactElement {
    const router = useRouter();

    // Estado completo do formulário. Cada `useState` é independente
    // — o submit consolida tudo num único patch.
    const [nome, setNome] = React.useState(inicial.nome);
    const [descricao, setDescricao] = React.useState(inicial.descricao);
    const [telefone, setTelefone] = React.useState(
        formatPhone(inicial.telefone),
    );

    const [genero, setGenero] = React.useState<string>(inicial.genero ?? "");
    const [atende, setAtende] = React.useState<ReadonlyArray<string>>(
        inicial.atendePublicos,
    );
    const [praticas, setPraticas] = React.useState<ReadonlyArray<string>>(
        inicial.realizaPraticas,
    );

    const [pesoKg, setPesoKg] = React.useState<string>(
        inicial.pesoKg !== null ? String(inicial.pesoKg) : "",
    );
    const [alturaCm, setAlturaCm] = React.useState<string>(
        inicial.alturaCm !== null ? String(inicial.alturaCm) : "",
    );
    const [tamanhoPe, setTamanhoPe] = React.useState<string>(
        inicial.tamanhoPe !== null ? String(inicial.tamanhoPe) : "",
    );
    const [etnia, setEtnia] = React.useState<string>(inicial.etnia ?? "");
    const [corOlhos, setCorOlhos] = React.useState<string>(
        inicial.corOlhos ?? "",
    );
    const [estiloCabelo, setEstiloCabelo] = React.useState<string>(
        inicial.estiloCabelo ?? "",
    );
    const [tamanhoCabelo, setTamanhoCabelo] = React.useState<string>(
        inicial.tamanhoCabelo ?? "",
    );
    // Booleans tratados como tristate: `null` = não preenchido,
    // `true`/`false` = decidido. O Switch só liga/desliga uma vez
    // que o usuário interage. `null` no patch sai como `null` (não
    // sobrescreve no servidor), evitando o bug de transformar "—"
    // em "Não" silenciosamente.
    const [temSilicone, setTemSilicone] = React.useState<boolean | null>(
        inicial.temSilicone,
    );
    const [temTatuagens, setTemTatuagens] = React.useState<boolean | null>(
        inicial.temTatuagens,
    );
    const [temPiercing, setTemPiercing] = React.useState<boolean | null>(
        inicial.temPiercing,
    );
    const [fumante, setFumante] = React.useState<boolean | null>(
        inicial.fumante,
    );
    const [idiomas, setIdiomas] = React.useState<ReadonlyArray<string>>(
        inicial.idiomas,
    );

    // -- Atendimento comercial -----------------------------------------
    const [valorHora, setValorHora] = React.useState<string>(
        inicial.valorHoraCents !== null && inicial.valorHoraCents > 0
            ? formatarReaisInput(inicial.valorHoraCents)
            : "",
    );
    const [formasPagamento, setFormasPagamento] = React.useState<
        ReadonlyArray<string>
    >(inicial.formasPagamento);
    const [diasAtende, setDiasAtende] = React.useState<ReadonlyArray<string>>(
        inicial.diasAtende,
    );

    const [submitting, setSubmitting] = React.useState(false);
    const [errors, setErrors] = React.useState<Record<string, string>>({});
    const [formError, setFormError] = React.useState<string | null>(null);

    const descricaoOverflow = descricao.length > MAX_DESC;
    const canSubmit = !submitting && !descricaoOverflow;

    // Reseta tudo ao abrir/fechar para que dados antigos não vazem
    // entre aberturas.
    React.useEffect(() => {
        if (!open) {
            setNome(inicial.nome);
            setDescricao(inicial.descricao);
            setTelefone(formatPhone(inicial.telefone));
            setGenero(inicial.genero ?? "");
            setAtende(inicial.atendePublicos);
            setPraticas(inicial.realizaPraticas);
            setPesoKg(inicial.pesoKg !== null ? String(inicial.pesoKg) : "");
            setAlturaCm(
                inicial.alturaCm !== null ? String(inicial.alturaCm) : "",
            );
            setTamanhoPe(
                inicial.tamanhoPe !== null ? String(inicial.tamanhoPe) : "",
            );
            setEtnia(inicial.etnia ?? "");
            setCorOlhos(inicial.corOlhos ?? "");
            setEstiloCabelo(inicial.estiloCabelo ?? "");
            setTamanhoCabelo(inicial.tamanhoCabelo ?? "");
            setTemSilicone(inicial.temSilicone);
            setTemTatuagens(inicial.temTatuagens);
            setTemPiercing(inicial.temPiercing);
            setFumante(inicial.fumante);
            setIdiomas(inicial.idiomas);
            setValorHora(
                inicial.valorHoraCents !== null && inicial.valorHoraCents > 0
                    ? formatarReaisInput(inicial.valorHoraCents)
                    : "",
            );
            setFormasPagamento(inicial.formasPagamento);
            setDiasAtende(inicial.diasAtende);
            setErrors({});
            setFormError(null);
            setSubmitting(false);
        }
    }, [open, inicial]);

    function buildPatch(): Record<string, unknown> {
        const valorHoraDigits = valorHora.replace(/\D/g, "");
        const valorHoraCents =
            valorHoraDigits.length === 0
                ? null
                : Number.parseInt(valorHoraDigits, 10);

        const patch: Record<string, unknown> = {
            nome,
            telefone,
            descricao,
            genero: genero === "" ? null : genero,
            atendePublicos: atende,
            realizaPraticas: praticas,
            pesoKg: pesoKg === "" ? null : Number(pesoKg),
            alturaCm: alturaCm === "" ? null : Number(alturaCm),
            tamanhoPe: tamanhoPe === "" ? null : Number(tamanhoPe),
            etnia: etnia === "" ? null : etnia,
            corOlhos: corOlhos === "" ? null : corOlhos,
            estiloCabelo: estiloCabelo === "" ? null : estiloCabelo,
            tamanhoCabelo: tamanhoCabelo === "" ? null : tamanhoCabelo,
            temSilicone,
            temTatuagens,
            temPiercing,
            fumante,
            idiomas,
            valorHoraCents,
            formasPagamento,
            diasAtende,
        };
        return patch;
    }

    async function handleSubmit(): Promise<void> {
        setSubmitting(true);
        setErrors({});
        setFormError(null);
        try {
            const res = await fetch("/api/conta/perfil", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(buildPatch()),
            });
            const payload = (await res.json().catch(() => null)) as
                | {
                    ok?: boolean;
                    reason?: string;
                    detalhes?: Record<string, string>;
                }
                | null;

            if (!res.ok || !payload?.ok) {
                if (payload?.detalhes) setErrors(payload.detalhes);
                else setFormError("Não foi possível salvar. Tente novamente.");
                return;
            }

            onClose();
            router.refresh();
        } catch {
            setFormError("Falha de rede. Tente novamente.");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <Modal
            open={open}
            onClose={submitting ? () => undefined : onClose}
            title="Editar perfil"
            subtitle={
                formError ?? "Atualize os dados que aparecem para os Clientes."
            }
            size="lg"
            dismissOnBackdrop={!submitting}
            dismissOnEsc={!submitting}
        >
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    void handleSubmit();
                }}
                className="flex flex-col gap-3 px-5 py-4"
            >
                <Tabs defaultValue="geral" className="flex flex-col gap-4">
                    <TabList aria-label="Categorias do perfil">
                        <TabTrigger value="geral">Geral</TabTrigger>
                        <TabTrigger value="aparencia">Aparência</TabTrigger>
                        <TabTrigger value="atendimento">Atendimento</TabTrigger>
                        <TabTrigger value="valores">Valores</TabTrigger>
                    </TabList>

                    {/* Aba Geral */}
                    <TabPanel value="geral">
                        <div className="flex flex-col gap-3">
                            <Input
                                label="Nome"
                                name="nome"
                                autoComplete="name"
                                value={nome}
                                onChange={(e) => setNome(e.target.value)}
                                disabled={submitting}
                                leadingIcon={<UserIcon size={16} />}
                                error={Boolean(errors.nome)}
                                errorMessage={errors.nome}
                                required
                            />
                            <Input
                                label="Telefone"
                                name="telefone"
                                type="tel"
                                autoComplete="tel"
                                inputMode="tel"
                                value={telefone}
                                onChange={(e) =>
                                    setTelefone(formatPhone(e.target.value))
                                }
                                disabled={submitting}
                                leadingIcon={<PhoneIcon size={16} />}
                                error={Boolean(errors.telefone)}
                                errorMessage={errors.telefone}
                                required
                            />
                            <div className="flex flex-col gap-1.5">
                                <label
                                    htmlFor="editar-descricao"
                                    className="flex items-center justify-between text-xs font-medium text-text-secondary"
                                >
                                    <span>Descrição</span>
                                    <span
                                        className={
                                            descricao.length > MAX_DESC
                                                ? "text-danger-700"
                                                : "text-text-disabled"
                                        }
                                    >
                                        {descricao.length}/{MAX_DESC}
                                    </span>
                                </label>
                                <textarea
                                    id="editar-descricao"
                                    rows={4}
                                    value={descricao}
                                    onChange={(e) =>
                                        setDescricao(e.target.value)
                                    }
                                    disabled={submitting}
                                    className={[
                                        "block w-full resize-none rounded-md border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-disabled shadow-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-text-disabled",
                                        errors.descricao ||
                                            descricao.length > MAX_DESC
                                            ? "border-danger-400 focus-visible:ring-danger-500/30 focus-visible:border-danger-500"
                                            : "border-neutral-200 focus-visible:ring-primary-500/30 focus-visible:border-primary-400",
                                    ].join(" ")}
                                />
                                {errors.descricao ? (
                                    <p
                                        role="alert"
                                        className="text-xs text-danger-700 animate-fade-in-soft"
                                    >
                                        {errors.descricao}
                                    </p>
                                ) : null}
                            </div>
                        </div>
                    </TabPanel>

                    {/* Aba Aparência */}
                    <TabPanel value="aparencia">
                        <div className="flex flex-col gap-5">
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                <Input
                                    label="Peso"
                                    type="number"
                                    inputMode="numeric"
                                    min={PESO_KG.min}
                                    max={PESO_KG.max}
                                    value={pesoKg}
                                    onChange={(e) => setPesoKg(e.target.value)}
                                    disabled={submitting}
                                    error={Boolean(errors.pesoKg)}
                                    errorMessage={errors.pesoKg}
                                    trailingIcon={
                                        <span className="text-[0.7rem]">
                                            kg
                                        </span>
                                    }
                                />
                                <Input
                                    label="Altura"
                                    type="number"
                                    inputMode="numeric"
                                    min={ALTURA_CM.min}
                                    max={ALTURA_CM.max}
                                    value={alturaCm}
                                    onChange={(e) =>
                                        setAlturaCm(e.target.value)
                                    }
                                    disabled={submitting}
                                    error={Boolean(errors.alturaCm)}
                                    errorMessage={errors.alturaCm}
                                    trailingIcon={
                                        <span className="text-[0.7rem]">
                                            cm
                                        </span>
                                    }
                                />
                                <Input
                                    label="Pé"
                                    type="number"
                                    inputMode="numeric"
                                    min={TAMANHO_PE.min}
                                    max={TAMANHO_PE.max}
                                    value={tamanhoPe}
                                    onChange={(e) =>
                                        setTamanhoPe(e.target.value)
                                    }
                                    disabled={submitting}
                                    error={Boolean(errors.tamanhoPe)}
                                    errorMessage={errors.tamanhoPe}
                                />
                            </div>

                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <Select
                                    label="Etnia"
                                    value={etnia}
                                    onChange={setEtnia}
                                    disabled={submitting}
                                    error={Boolean(errors.etnia)}
                                    errorMessage={errors.etnia}
                                    options={ETNIAS.map((o) => ({
                                        value: o.value,
                                        label: o.label,
                                    }))}
                                />
                                <Select
                                    label="Cor dos olhos"
                                    value={corOlhos}
                                    onChange={setCorOlhos}
                                    disabled={submitting}
                                    error={Boolean(errors.corOlhos)}
                                    errorMessage={errors.corOlhos}
                                    options={CORES_OLHOS.map((o) => ({
                                        value: o.value,
                                        label: o.label,
                                    }))}
                                />
                                <Select
                                    label="Estilo do cabelo"
                                    value={estiloCabelo}
                                    onChange={setEstiloCabelo}
                                    disabled={submitting}
                                    error={Boolean(errors.estiloCabelo)}
                                    errorMessage={errors.estiloCabelo}
                                    options={ESTILOS_CABELO.map((o) => ({
                                        value: o.value,
                                        label: o.label,
                                    }))}
                                />
                                <Select
                                    label="Tamanho do cabelo"
                                    value={tamanhoCabelo}
                                    onChange={setTamanhoCabelo}
                                    disabled={submitting}
                                    error={Boolean(errors.tamanhoCabelo)}
                                    errorMessage={errors.tamanhoCabelo}
                                    options={TAMANHOS_CABELO.map((o) => ({
                                        value: o.value,
                                        label: o.label,
                                    }))}
                                />
                            </div>

                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <Switch
                                    label="Silicone"
                                    description="Possui silicone"
                                    checked={temSilicone === true}
                                    onChange={setTemSilicone}
                                />
                                <Switch
                                    label="Tatuagens"
                                    description="Possui tatuagens"
                                    checked={temTatuagens === true}
                                    onChange={setTemTatuagens}
                                />
                                <Switch
                                    label="Piercing"
                                    description="Possui piercing"
                                    checked={temPiercing === true}
                                    onChange={setTemPiercing}
                                />
                                <Switch
                                    label="Fumante"
                                    description="Fuma cigarro ou similar"
                                    checked={fumante === true}
                                    onChange={setFumante}
                                />
                            </div>

                            <ChipGroup
                                label="Idiomas que fala"
                                hint="Selecione todos que se aplicam."
                                options={IDIOMAS.map((o) => ({
                                    value: o.value,
                                    label: o.label,
                                }))}
                                value={idiomas}
                                onChange={setIdiomas}
                                error={Boolean(errors.idiomas)}
                                errorMessage={errors.idiomas}
                            />
                        </div>
                    </TabPanel>

                    {/* Aba Atendimento */}
                    <TabPanel value="atendimento">
                        <div className="flex flex-col gap-5">
                            <Select
                                label="Gênero"
                                value={genero}
                                onChange={setGenero}
                                disabled={submitting}
                                error={Boolean(errors.genero)}
                                errorMessage={errors.genero}
                                options={GENEROS.map((o) => ({
                                    value: o.value,
                                    label: o.label,
                                }))}
                                required
                            />
                            <ChipGroup
                                label="Quem você atende"
                                hint="Você pode atender qualquer público."
                                options={ATENDE.map((o) => ({
                                    value: o.value,
                                    label: o.label,
                                }))}
                                value={atende}
                                onChange={setAtende}
                                error={Boolean(errors.atendePublicos)}
                                errorMessage={errors.atendePublicos}
                            />
                            <ChipGroup
                                label="O que você realiza"
                                hint="O item Fetiche sinaliza abertura para cenários específicos."
                                options={PRATICAS.map((o) => ({
                                    value: o.value,
                                    label: o.label,
                                }))}
                                value={praticas}
                                onChange={setPraticas}
                                error={Boolean(errors.realizaPraticas)}
                                errorMessage={errors.realizaPraticas}
                            />
                        </div>
                    </TabPanel>

                    {/* Aba Valores */}
                    <TabPanel value="valores">
                        <div className="flex flex-col gap-5">
                            <Input
                                label="Valor da hora"
                                name="valorHoraReais"
                                type="text"
                                inputMode="decimal"
                                placeholder="250,00"
                                leadingIcon={
                                    <span className="text-[0.7rem] font-medium">
                                        R$
                                    </span>
                                }
                                value={valorHora}
                                onChange={(e) =>
                                    setValorHora(
                                        formatarValorInput(e.target.value),
                                    )
                                }
                                disabled={submitting}
                                error={Boolean(errors.valorHoraCents)}
                                errorMessage={errors.valorHoraCents}
                                hint={`Entre R$ ${(VALOR_HORA_CENTS.min / 100).toFixed(0)} e R$ ${(VALOR_HORA_CENTS.max / 100).toLocaleString("pt-BR")}.`}
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
                                error={Boolean(errors.formasPagamento)}
                                errorMessage={errors.formasPagamento}
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
                                error={Boolean(errors.diasAtende)}
                                errorMessage={errors.diasAtende}
                            />
                        </div>
                    </TabPanel>
                </Tabs>

                <footer className="flex items-center justify-end gap-2 pt-2">
                    <Button
                        type="button"
                        variant="ghost"
                        size="md"
                        onClick={onClose}
                        disabled={submitting}
                    >
                        Cancelar
                    </Button>
                    <Button
                        type="submit"
                        variant="primary"
                        size="md"
                        loading={submitting}
                        disabled={!canSubmit}
                    >
                        {submitting ? "Salvando…" : "Salvar"}
                    </Button>
                </footer>
            </form>
        </Modal>
    );
}

function formatPhone(raw: string): string {
    const digits = raw.replace(/\D/g, "").slice(0, 11);
    if (digits.length === 0) return "";
    if (digits.length <= 2) return `(${digits}`;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

/**
 * Mantém o input do valor da hora estável: extrai só dígitos e
 * renderiza como "X.XXX,XX" (vírgula nos centavos). Mesma estratégia
 * do `ValoresStep` do Onboarding — duplicação tolerada porque o
 * formato é local ao input e não vale promover a primitivo só por isso.
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
 * Inverso: centavos persistidos → string formatada para preencher o
 * input quando a Acompanhante reabre o modal.
 */
function formatarReaisInput(cents: number): string {
    if (!Number.isFinite(cents) || cents <= 0) return "";
    const reais = Math.floor(cents / 100);
    const cent = cents % 100;
    return `${reais.toLocaleString("pt-BR")},${cent.toString().padStart(2, "0")}`;
}
