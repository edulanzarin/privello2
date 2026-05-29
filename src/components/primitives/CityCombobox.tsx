"use client";

import * as React from "react";

import { MapPinIcon, ArrowRightIcon } from "../icons";

import { ComboboxDropdown } from "./ComboboxDropdown";
import { ComboboxOption } from "./ComboboxOption";

/**
 * Valor controlado do {@link CityCombobox}.
 *
 * Quando o usuário ainda está digitando sem ter selecionado,
 * `name`/`uf` ficam vazias e `query` traz o texto bruto. Quando
 * uma sugestão é selecionada, `name` e `uf` ficam preenchidos
 * (`query` é sincronizado com `"<name>, <uf>"`).
 */
export interface CityComboboxValue {
    /** Texto digitado livremente. */
    query: string;
    /** Nome da cidade resolvida via seleção. Vazio quando não há. */
    name: string;
    /** UF (sigla) da cidade resolvida via seleção. Vazia quando não há. */
    uf: string;
}

/**
 * Props do {@link CityCombobox}.
 *
 * Autocomplete de cidades brasileiras (IBGE) sem dependência de
 * bairro. Voltado pra uso em barras de busca centrais (home,
 * filtros), onde só interessa o par `(cidade, UF)`.
 *
 * Endpoint consumido:
 *   - `GET /api/localidades/estados`
 *   - `GET /api/localidades/cidades?uf=<sigla>`
 *
 * Nenhuma prop carrega nomes de entidades de domínio (Property 29).
 */
export interface CityComboboxProps {
    value: CityComboboxValue;
    onChange: (next: CityComboboxValue) => void;
    /**
     * Disparado quando o usuário "submete" (Enter ou click no botão
     * de seta). Recebe o valor atual. O consumidor decide se valida
     * (exigir resolução) ou aceita o texto livre.
     */
    onSubmit?: (value: CityComboboxValue) => void;
    /** Placeholder do input. Padrão: `"Buscar cidade"`. */
    placeholder?: string;
    /** Quando `true`, desabilita o campo. */
    disabled?: boolean;
    /** Classes extras aplicadas ao container externo. */
    className?: string;
}

interface CitySuggestion {
    name: string;
    uf: string;
    label: string;
}

const MAX_SUGGESTIONS = 8;
const MIN_CHARS = 2;

/**
 * CityCombobox — input central de busca por cidade com autocomplete.
 *
 * Pré-carrega todas as cidades por UF na montagem (mesma estratégia
 * do `LocalidadePicker`) e filtra em memória. Usa
 * {@link ComboboxDropdown} portalizado pra escapar de `overflow-
 * hidden` ancestrais.
 */
export function CityCombobox({
    value,
    onChange,
    onSubmit,
    placeholder = "Buscar cidade",
    disabled = false,
    className,
}: CityComboboxProps): React.ReactElement {
    const wrapperRef = React.useRef<HTMLDivElement>(null);
    const inputRef = React.useRef<HTMLInputElement>(null);
    const [allCities, setAllCities] = React.useState<CitySuggestion[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [showSuggestions, setShowSuggestions] = React.useState(false);

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
                        name: c.nome,
                        uf: c.estadoSigla ?? e.sigla,
                        label: `${c.nome}, ${c.estadoSigla ?? e.sigla}`,
                    }));
                });

                const results = await Promise.all(cidadesPromises);
                if (!cancelled) {
                    setAllCities(results.flat());
                    setLoading(false);
                }
            } catch {
                if (!cancelled) setLoading(false);
            }
        }
        loadAll();
        return () => {
            cancelled = true;
        };
    }, []);

    const suggestions = React.useMemo(() => {
        const q = value.query.trim().toLowerCase();
        if (q.length < MIN_CHARS) return [];
        return allCities
            .filter((c) => c.name.toLowerCase().includes(q))
            .slice(0, MAX_SUGGESTIONS);
    }, [value.query, allCities]);

    React.useEffect(() => {
        function handleClickOutside(e: MouseEvent): void {
            const target = e.target as HTMLElement | null;
            if (target?.closest('[data-combobox-dropdown="true"]')) return;
            if (
                wrapperRef.current &&
                !wrapperRef.current.contains(e.target as Node)
            ) {
                setShowSuggestions(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () =>
            document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    function handleSelect(c: CitySuggestion): void {
        const next: CityComboboxValue = {
            query: c.label,
            name: c.name,
            uf: c.uf,
        };
        setShowSuggestions(false);
        onChange(next);
        onSubmit?.(next);
    }

    function handleChange(e: React.ChangeEvent<HTMLInputElement>): void {
        const text = e.target.value;
        onChange({ query: text, name: "", uf: "" });
        setShowSuggestions(true);
    }

    function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
        if (e.key === "Enter") {
            e.preventDefault();
            // Se há sugestão visível, seleciona a primeira; senão
            // submete com texto livre.
            if (suggestions.length > 0) {
                handleSelect(suggestions[0]);
                return;
            }
            onSubmit?.(value);
        }
    }

    function handleSubmitClick(): void {
        if (suggestions.length > 0) {
            handleSelect(suggestions[0]);
            return;
        }
        onSubmit?.(value);
    }

    return (
        <div
            ref={wrapperRef}
            className={["relative", className ?? ""].filter(Boolean).join(" ")}
        >
            <div
                className={[
                    "flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 transition-all duration-200",
                    "focus-within:border-[#ec7b5b]/50 focus-within:ring-2 focus-within:ring-[#ec7b5b]/20",
                    disabled ? "opacity-60 pointer-events-none" : "",
                ]
                    .filter(Boolean)
                    .join(" ")}
            >
                <span
                    aria-hidden="true"
                    className="flex h-5 w-5 flex-none items-center justify-center text-text-secondary"
                >
                    <MapPinIcon size={16} />
                </span>
                <input
                    ref={inputRef}
                    type="text"
                    inputMode="search"
                    autoComplete="off"
                    aria-label="Cidade"
                    placeholder={loading ? "Carregando cidades." : placeholder}
                    disabled={disabled || loading}
                    value={value.query}
                    onChange={handleChange}
                    onFocus={() => {
                        if (value.query.trim().length >= MIN_CHARS) {
                            setShowSuggestions(true);
                        }
                    }}
                    onKeyDown={handleKeyDown}
                    className="min-w-0 flex-1 bg-transparent text-base text-text-primary placeholder:text-text-disabled focus:outline-none"
                />
                <button
                    type="button"
                    onClick={handleSubmitClick}
                    disabled={disabled || loading}
                    aria-label="Buscar"
                    className="inline-flex h-9 w-9 flex-none items-center justify-center rounded-full bg-gradient-to-br from-[color:var(--accent)] to-[color:var(--accent-deep)] text-white shadow-[0_4px_12px_-4px_rgba(197,82,58,0.45)] transition-transform hover:scale-105 disabled:bg-neutral-300 disabled:from-neutral-300 disabled:to-neutral-300 disabled:shadow-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ec7b5b]/40"
                >
                    <ArrowRightIcon size={16} />
                </button>
            </div>

            {showSuggestions && suggestions.length > 0 ? (
                <ComboboxDropdown anchor={wrapperRef}>
                    {suggestions.map((c, idx) => (
                        <ComboboxOption
                            key={`${c.name}-${c.uf}`}
                            onClick={() => handleSelect(c)}
                            active={idx === 0}
                            leading={<MapPinIcon size={14} />}
                        >
                            {c.name}
                            <span className="ml-1 text-text-secondary">
                                {c.uf}
                            </span>
                        </ComboboxOption>
                    ))}
                </ComboboxDropdown>
            ) : null}

            {showSuggestions &&
                value.query.trim().length >= MIN_CHARS &&
                suggestions.length === 0 &&
                !loading ? (
                <div className="absolute left-0 right-0 top-full z-10 mt-1 rounded-2xl border border-border bg-surface px-3 py-2 text-xs text-text-secondary shadow-md">
                    Nenhuma cidade encontrada para &quot;{value.query.trim()}&quot;.
                </div>
            ) : null}
        </div>
    );
}
