"use client";

import * as React from "react";

import { MapPinIcon } from "../icons";

import { ComboboxDropdown } from "./ComboboxDropdown";
import { ComboboxOption } from "./ComboboxOption";
import { Input } from "./Input";

/**
 * Props do {@link LocalidadePicker}.
 *
 * Composto controlado: cidade (autocomplete sobre IBGE) + bairro
 * (autocomplete sobre Overpass via Nominatim, lista da API). O
 * consumidor mantém os 3 campos `(estadoSigla, cidadeNome,
 * bairroNome)` e recebe atualizações via `onChange`.
 *
 * O bairro fica visível desde o início, mas `disabled` até uma
 * cidade ser escolhida — assim não há salto de layout. A entrada do
 * bairro é restrita à lista da API: o texto digitado serve só de
 * filtro visual; sem seleção, o `bairroNome` no estado fica vazio.
 *
 * Endpoints consumidos:
 *   - `GET /api/localidades/estados`
 *   - `GET /api/localidades/cidades?uf=`
 *   - `GET /api/localidades/bairros?uf=&cidade=`
 *
 * Nenhuma prop carrega nomes de entidades de domínio (Property 29).
 */
export interface LocalidadePickerValue {
    estadoSigla: string;
    cidadeNome: string;
    bairroNome: string;
}

export interface LocalidadePickerProps {
    value: LocalidadePickerValue;
    onChange: (next: LocalidadePickerValue) => void;
    /** Quando `true`, desabilita ambos os campos. */
    disabled?: boolean;
    /** Erro exibido no campo de cidade (mensagem do servidor). */
    cidadeError?: string;
    /** Erro exibido no campo de bairro. */
    bairroError?: string;
    /** Classes extras aplicadas ao container. */
    className?: string;
}

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

/**
 * LocalidadePicker — cidade + bairro com autocomplete.
 *
 * Primitivo controlado, reusável tanto no onboarding (envolvido em
 * `<form action>`) quanto em modais de edição (com submit
 * customizado).
 */
export function LocalidadePicker({
    value,
    onChange,
    disabled = false,
    cidadeError,
    bairroError,
    className,
}: LocalidadePickerProps): React.ReactElement {
    // -----------------------------------------------------------------
    // Cidade
    // -----------------------------------------------------------------
    const [cidadeQuery, setCidadeQuery] = React.useState(
        value.cidadeNome && value.estadoSigla
            ? `${value.cidadeNome}, ${value.estadoSigla}`
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
                        "Não foi possível carregar as cidades. Tente recarregar.",
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
            // Cliques dentro do dropdown portalizado não fecham.
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
            cidade.nome !== value.cidadeNome ||
            cidade.estadoSigla !== value.estadoSigla;
        setCidadeQuery(cidade.label);
        setShowCidadeSuggestions(false);
        // Trocar de cidade invalida bairro anterior.
        onChange({
            estadoSigla: cidade.estadoSigla,
            cidadeNome: cidade.nome,
            bairroNome: trocou ? "" : value.bairroNome,
        });
        if (trocou) {
            setBairroQuery("");
        }
    }

    function handleCidadeChange(
        e: React.ChangeEvent<HTMLInputElement>,
    ): void {
        setCidadeQuery(e.target.value);
        setShowCidadeSuggestions(true);
        onChange({
            estadoSigla: "",
            cidadeNome: "",
            bairroNome: "",
        });
    }

    // -----------------------------------------------------------------
    // Bairro
    // -----------------------------------------------------------------
    const [bairroQuery, setBairroQuery] = React.useState(value.bairroNome);
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
        if (!value.cidadeNome || !value.estadoSigla) {
            setBairros([]);
            setBairrosCidadeAtual(null);
            return;
        }
        const key = `${value.estadoSigla}|${value.cidadeNome}`;
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
                    value.estadoSigla,
                )}&cidade=${encodeURIComponent(value.cidadeNome)}`;
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
    }, [value.cidadeNome, value.estadoSigla, bairrosCidadeAtual]);

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
        setShowBairros(true);
        onChange({ ...value, bairroNome: "" });
    }

    function handleSelectBairro(bairro: BairroSugestao): void {
        setBairroQuery(bairro.nome);
        setShowBairros(false);
        onChange({ ...value, bairroNome: bairro.nome });
    }

    const cidadeSelecionada = Boolean(value.cidadeNome && value.estadoSigla);
    const bairroDisponivel = bairros.length > 0;
    const bairroDisabled =
        disabled ||
        !cidadeSelecionada ||
        bairrosLoading ||
        !bairroDisponivel;

    function bairroHint(): string {
        if (!cidadeSelecionada) return "Escolha primeiro a cidade.";
        if (bairrosLoading) return "Buscando bairros disponíveis.";
        if (!bairroDisponivel)
            return "Sem bairros disponíveis para esta cidade.";
        return "Selecione um bairro da lista.";
    }

    function bairroPlaceholder(): string {
        if (!cidadeSelecionada) return "Bairro";
        if (bairrosLoading) return "Carregando.";
        if (!bairroDisponivel) return "Indisponível";
        return "Buscar bairro";
    }

    const hasCidadeError = Boolean(cidadeError) || Boolean(cidadesError);
    const cidadeErrorMsg = cidadeError ?? cidadesError ?? undefined;

    return (
        <div className={["flex flex-col gap-4", className ?? ""].filter(Boolean).join(" ")}>
            {/* Cidade */}
            <div ref={cidadeRef} className="relative">
                <Input
                    label="Cidade"
                    name="_cidade_search"
                    type="text"
                    autoComplete="off"
                    placeholder={
                        cidadesLoading ? "Carregando." : "Buscar cidade"
                    }
                    value={cidadeQuery}
                    onChange={handleCidadeChange}
                    onFocus={() => {
                        if (cidadeQuery.length >= MIN_CHARS)
                            setShowCidadeSuggestions(true);
                    }}
                    disabled={disabled || cidadesLoading}
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

            {/* Bairro */}
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
                    error={Boolean(bairroError)}
                    errorMessage={bairroError}
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
        </div>
    );
}
