"use client";

import * as React from "react";
import Link from "next/link";
import { useActionState } from "react";

import { Button, ComboboxDropdown, ComboboxOption, Input, MapPinIcon } from "@/components";

import {
    SALVAR_ETAPA_INITIAL,
    type SalvarEtapaState,
} from "../../action-state";
import { salvarEtapaAction } from "../../actions";

/**
 * Step 3 do Onboarding_Acompanhante: Localidade.
 *
 * Coleta dois campos:
 *
 * 1. Cidade (obrigatória). Autocomplete que carrega o produto
 *    cartesiano de UFs e municípios via `/api/localidades/estados` +
 *    `/api/localidades/cidades?uf=`. A filtragem é client-side; o
 *    submit envia hidden inputs com `estadoSigla` e `cidadeNome`.
 *
 * 2. Bairro (opcional). Autocomplete dependente da cidade. Os
 *    valores vêm de `/api/localidades/bairros?uf=&cidade=` (Overpass +
 *    cache). Diferente da cidade, **a entrada é restrita à lista da
 *    API**: o usuário só pode confirmar um bairro selecionando uma
 *    sugestão. Se a cidade não tem bairros mapeados no OSM, o campo
 *    informa explicitamente "sem bairros disponíveis para esta
 *    cidade" e fica em estado bloqueado, sem opção de digitar livre.
 *
 * O campo de bairro é renderizado desde o início (junto com a cidade)
 * e fica `disabled` até uma cidade ser escolhida, evitando o pulo de
 * layout quando a cidade é selecionada.
 */

interface CidadeComEstado {
    nome: string;
    estadoSigla: string;
    label: string;
}

interface BairroSugestao {
    nome: string;
}

const MAX_SUGGESTIONS = 8;
const MIN_CHARS = 2;

export interface LocalidadeStepProps {
    nextPath: string;
    previousPath: string | null;
    initialEstado: string;
    initialCidade: string;
    initialBairro: string;
}

export function LocalidadeStep({
    nextPath,
    previousPath,
    initialEstado,
    initialCidade,
    initialBairro,
}: LocalidadeStepProps): React.ReactElement {
    const [state, formAction, pending] = useActionState<
        SalvarEtapaState,
        FormData
    >(salvarEtapaAction, SALVAR_ETAPA_INITIAL);

    const fieldErrors = state.fieldErrors ?? {};

    // -----------------------------------------------------------------
    // Cidade
    // -----------------------------------------------------------------

    const [selectedCidade, setSelectedCidade] = React.useState(initialCidade);
    const [selectedEstado, setSelectedEstado] = React.useState(initialEstado);

    const [cidadeQuery, setCidadeQuery] = React.useState(
        initialCidade && initialEstado
            ? `${initialCidade}, ${initialEstado}`
            : "",
    );

    const [allCidades, setAllCidades] = React.useState<CidadeComEstado[]>([]);
    const [cidadesLoading, setCidadesLoading] = React.useState(true);
    const [cidadesError, setCidadesError] = React.useState<string | null>(null);

    const [showCidadeSuggestions, setShowCidadeSuggestions] =
        React.useState(false);
    const cidadeRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        let cancelled = false;
        async function loadAll(): Promise<void> {
            try {
                const estadosRes = await fetch("/api/localidades/estados");
                if (!estadosRes.ok)
                    throw new Error("Falha ao carregar estados");
                const { estados } = (await estadosRes.json()) as {
                    estados: Array<{ sigla: string; nome: string }>;
                };

                const cidadesPromises = estados.map(async (e) => {
                    const res = await fetch(
                        `/api/localidades/cidades?uf=${e.sigla}`,
                    );
                    if (!res.ok) return [];
                    const { cidades } = (await res.json()) as {
                        cidades: Array<{ nome: string; estadoSigla: string }>;
                    };
                    return cidades.map((c) => ({
                        nome: c.nome,
                        estadoSigla: c.estadoSigla ?? e.sigla,
                        label: `${c.nome}, ${c.estadoSigla ?? e.sigla}`,
                    }));
                });

                const results = await Promise.all(cidadesPromises);
                if (!cancelled) {
                    setAllCidades(results.flat());
                    setCidadesLoading(false);
                }
            } catch {
                if (!cancelled) {
                    setCidadesError(
                        "Não foi possível carregar as cidades. Tente recarregar a página.",
                    );
                    setCidadesLoading(false);
                }
            }
        }
        loadAll();
        return () => {
            cancelled = true;
        };
    }, []);

    const cidadeSuggestions = React.useMemo(() => {
        if (cidadeQuery.length < MIN_CHARS) return [];
        const lower = cidadeQuery.toLowerCase();
        return allCidades
            .filter((c) => c.nome.toLowerCase().includes(lower))
            .slice(0, MAX_SUGGESTIONS);
    }, [cidadeQuery, allCidades]);

    React.useEffect(() => {
        function handleClickOutside(e: MouseEvent): void {
            const target = e.target as HTMLElement | null;
            if (target?.closest('[data-combobox-dropdown="true"]')) return;
            if (
                cidadeRef.current &&
                !cidadeRef.current.contains(e.target as Node)
            ) {
                setShowCidadeSuggestions(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () =>
            document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    function handleSelectCidade(cidade: CidadeComEstado): void {
        const trocou =
            cidade.nome !== selectedCidade ||
            cidade.estadoSigla !== selectedEstado;
        setSelectedCidade(cidade.nome);
        setSelectedEstado(cidade.estadoSigla);
        setCidadeQuery(cidade.label);
        setShowCidadeSuggestions(false);

        // Trocar de cidade invalida a seleção de bairro anterior.
        if (trocou) {
            setBairroSelecionado("");
            setBairroQuery("");
        }
    }

    function handleCidadeChange(
        e: React.ChangeEvent<HTMLInputElement>,
    ): void {
        setCidadeQuery(e.target.value);
        setSelectedCidade("");
        setSelectedEstado("");
        setShowCidadeSuggestions(true);
    }

    // -----------------------------------------------------------------
    // Bairro
    //
    // O bairro é renderizado desde o início, mas fica disabled até
    // a cidade ser selecionada. A entrada não aceita texto livre: o
    // valor submetido é apenas o que foi escolhido na lista da API.
    // -----------------------------------------------------------------

    const [bairroSelecionado, setBairroSelecionado] =
        React.useState(initialBairro);
    const [bairroQuery, setBairroQuery] = React.useState(initialBairro);
    const [bairros, setBairros] = React.useState<BairroSugestao[]>([]);
    const [bairrosLoading, setBairrosLoading] = React.useState(false);
    const [bairrosCidadeAtual, setBairrosCidadeAtual] = React.useState<
        string | null
    >(null);
    const [showBairros, setShowBairros] = React.useState(false);
    const bairroRef = React.useRef<HTMLDivElement>(null);
    const bairroCacheRef = React.useRef<Map<string, BairroSugestao[]>>(
        new Map(),
    );

    React.useEffect(() => {
        if (!selectedCidade || !selectedEstado) {
            setBairros([]);
            setBairrosCidadeAtual(null);
            return;
        }
        const key = `${selectedEstado}|${selectedCidade}`;
        if (bairrosCidadeAtual === key) return;

        const cached = bairroCacheRef.current.get(key);
        if (cached) {
            setBairros(cached);
            setBairrosCidadeAtual(key);
            return;
        }

        let cancelled = false;
        setBairrosLoading(true);
        (async () => {
            try {
                const url = `/api/localidades/bairros?uf=${encodeURIComponent(
                    selectedEstado,
                )}&cidade=${encodeURIComponent(selectedCidade)}`;
                const res = await fetch(url);
                if (!res.ok) {
                    if (!cancelled) {
                        setBairros([]);
                        setBairrosCidadeAtual(key);
                    }
                    return;
                }
                const { bairros: list } = (await res.json()) as {
                    bairros: Array<{ nome: string }>;
                };
                if (!cancelled) {
                    bairroCacheRef.current.set(key, list);
                    setBairros(list);
                    setBairrosCidadeAtual(key);
                }
            } catch {
                if (!cancelled) {
                    setBairros([]);
                    setBairrosCidadeAtual(key);
                }
            } finally {
                if (!cancelled) {
                    setBairrosLoading(false);
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [selectedCidade, selectedEstado, bairrosCidadeAtual]);

    React.useEffect(() => {
        function handleClickOutside(e: MouseEvent): void {
            const target = e.target as HTMLElement | null;
            if (target?.closest('[data-combobox-dropdown="true"]')) return;
            if (
                bairroRef.current &&
                !bairroRef.current.contains(e.target as Node)
            ) {
                setShowBairros(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () =>
            document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    /**
     * Filtra os bairros da API conforme o usuário digita. Lista
     * completa quando vazio; substring (case-insensitive) caso
     * contrário. Como a entrada é restrita à seleção, o texto
     * digitado serve apenas como filtro visual.
     */
    const bairroSuggestions = React.useMemo(() => {
        const q = bairroQuery.trim().toLowerCase();
        if (q.length === 0) {
            return bairros.slice(0, MAX_SUGGESTIONS);
        }
        return bairros
            .filter((b) => b.nome.toLowerCase().includes(q))
            .slice(0, MAX_SUGGESTIONS);
    }, [bairros, bairroQuery]);

    function handleBairroChange(
        e: React.ChangeEvent<HTMLInputElement>,
    ): void {
        setBairroQuery(e.target.value);
        // Texto digitado invalida a seleção atual (até o usuário
        // clicar em uma sugestão da API).
        setBairroSelecionado("");
        setShowBairros(true);
    }

    function handleSelectBairro(bairro: BairroSugestao): void {
        setBairroSelecionado(bairro.nome);
        setBairroQuery(bairro.nome);
        setShowBairros(false);
    }

    const cidadeSelecionada = Boolean(selectedCidade && selectedEstado);
    const bairroDisponivel = bairros.length > 0;
    const bairroDisabled =
        !cidadeSelecionada || bairrosLoading || !bairroDisponivel;

    /**
     * Texto auxiliar do campo de bairro de acordo com o estado:
     * cidade não escolhida, carregando, lista vazia da API, ou pronto.
     */
    function bairroHint(): string {
        if (!cidadeSelecionada) {
            return "Escolha primeiro a cidade.";
        }
        if (bairrosLoading) {
            return "Buscando bairros disponíveis.";
        }
        if (!bairroDisponivel) {
            return "Sem bairros disponíveis para esta cidade.";
        }
        return "Selecione um bairro da lista.";
    }

    /**
     * Placeholder do campo de bairro. Mensagens diretas, sem texto de
     * fallback ambíguo.
     */
    function bairroPlaceholder(): string {
        if (!cidadeSelecionada) return "Bairro";
        if (bairrosLoading) return "Carregando.";
        if (!bairroDisponivel) return "Indisponível";
        return "Buscar bairro";
    }

    // -----------------------------------------------------------------
    // Erros / submit
    // -----------------------------------------------------------------

    const hasCidadeError =
        Boolean(fieldErrors.estadoSigla) ||
        Boolean(fieldErrors.cidadeNome) ||
        Boolean(cidadesError);
    const cidadeErrorMsg =
        fieldErrors.cidadeNome ??
        fieldErrors.estadoSigla ??
        cidadesError ??
        undefined;

    return (
        <form action={formAction} className="flex flex-col gap-4" noValidate>
            <input type="hidden" name="_step" value="localidade" />
            <input type="hidden" name="_next" value={nextPath} />
            <input type="hidden" name="estadoSigla" value={selectedEstado} />
            <input type="hidden" name="cidadeNome" value={selectedCidade} />
            <input type="hidden" name="bairroNome" value={bairroSelecionado} />

            {/* Cidade */}
            <div ref={cidadeRef} className="relative">
                <Input
                    label="Cidade"
                    name="_cidade_search"
                    type="text"
                    autoComplete="off"
                    placeholder={
                        cidadesLoading
                            ? "Carregando."
                            : "Buscar cidade"
                    }
                    value={cidadeQuery}
                    onChange={handleCidadeChange}
                    onFocus={() => {
                        if (cidadeQuery.length >= MIN_CHARS)
                            setShowCidadeSuggestions(true);
                    }}
                    disabled={cidadesLoading}
                    error={hasCidadeError}
                    errorMessage={cidadeErrorMsg}
                    leadingIcon={<MapPinIcon size={16} />}
                    required
                />

                {showCidadeSuggestions && cidadeSuggestions.length > 0 ? (
                    <ComboboxDropdown anchor={cidadeRef}>
                        {cidadeSuggestions.map((cidade, idx) => (
                            <ComboboxOption
                                key={`${cidade.nome}-${cidade.estadoSigla}`}
                                onClick={() => handleSelectCidade(cidade)}
                                active={idx === 0}
                                leading={<MapPinIcon size={14} />}
                            >
                                {cidade.nome}
                                <span className="ml-1 text-text-secondary">
                                    {cidade.estadoSigla}
                                </span>
                            </ComboboxOption>
                        ))}
                    </ComboboxDropdown>
                ) : null}

                {showCidadeSuggestions &&
                    cidadeQuery.length >= MIN_CHARS &&
                    cidadeSuggestions.length === 0 &&
                    !cidadesLoading ? (
                    <div className="absolute left-0 right-0 top-full z-10 mt-1 rounded-md border border-neutral-200 bg-surface px-3 py-2 text-xs text-text-secondary shadow-md">
                        Nenhuma cidade encontrada para &quot;{cidadeQuery}&quot;.
                    </div>
                ) : null}
            </div>

            {/* Bairro: visível desde o início, bloqueado até cidade. */}
            <div ref={bairroRef} className="relative">
                <Input
                    label="Bairro (opcional)"
                    type="text"
                    autoComplete="off"
                    placeholder={bairroPlaceholder()}
                    value={bairroQuery}
                    onChange={handleBairroChange}
                    onFocus={() => {
                        if (!bairroDisabled) setShowBairros(true);
                    }}
                    disabled={bairroDisabled}
                    hint={bairroHint()}
                    error={Boolean(fieldErrors.bairroNome)}
                    errorMessage={fieldErrors.bairroNome}
                    leadingIcon={<MapPinIcon size={16} />}
                />

                {showBairros && bairroSuggestions.length > 0 ? (
                    <ComboboxDropdown anchor={bairroRef}>
                        {bairroSuggestions.map((bairro) => (
                            <ComboboxOption
                                key={bairro.nome}
                                onClick={() => handleSelectBairro(bairro)}
                                leading={<MapPinIcon size={14} />}
                            >
                                {bairro.nome}
                            </ComboboxOption>
                        ))}
                    </ComboboxDropdown>
                ) : null}
            </div>

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
                        Voltar
                    </Link>
                ) : (
                    <span />
                )}
                <Button
                    type="submit"
                    loading={pending}
                    disabled={!selectedCidade || !selectedEstado}
                >
                    {pending ? "Salvando." : "Continuar"}
                </Button>
            </div>
        </form>
    );
}
