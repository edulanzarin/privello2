"use client";

import * as React from "react";

/**
 * Props do {@link Tabs}.
 *
 * Composto que segue a API "headless" de Radix/Reach: o `Tabs`
 * provê o contexto, e os subcomponentes ({@link TabList},
 * {@link TabTrigger}, {@link TabPanel}) renderizam os elementos
 * controlados. Mantém estado interno por padrão; pode ser controlado
 * de fora passando `value` + `onChange`.
 *
 * Quando `urlHash` for `true`, sincroniza o tab ativo com o hash da
 * URL (ex.: `#midias`). Útil para que o usuário possa compartilhar um
 * link direto para um tab específico ou para que o botão "Voltar" do
 * navegador percorra os tabs visitados.
 *
 * Nenhuma prop carrega nomes de entidades de domínio (Property 29).
 */
export interface TabsProps {
    /** Valor inicial do tab ativo (modo não controlado). */
    defaultValue: string;
    /** Tab ativo (modo controlado). */
    value?: string;
    /** Callback chamado quando o tab ativo muda. */
    onChange?: (value: string) => void;
    /**
     * Quando `true`, sincroniza o estado com `window.location.hash`.
     * Padrão: `false`.
     */
    urlHash?: boolean;
    /** Classes extras aplicadas ao container. */
    className?: string;
    children: React.ReactNode;
}

interface TabsContextValue {
    value: string;
    setValue: (value: string) => void;
    /**
     * Identificador único da instância de `Tabs`, usado para compor IDs
     * de `TabTrigger` e `TabPanel` que seguem o padrão WAI-ARIA Authoring
     * Practices (`aria-controls` aponta para o id do `TabPanel` e
     * `aria-labelledby` no `TabPanel` aponta para o id do `TabTrigger`).
     */
    id: string;
}

const TabsContext = React.createContext<TabsContextValue | null>(null);

function useTabsContext(): TabsContextValue {
    const ctx = React.useContext(TabsContext);
    if (ctx === null) {
        throw new Error(
            "Subcomponentes de Tabs (TabList, TabTrigger, TabPanel) devem ser usados dentro de <Tabs>.",
        );
    }
    return ctx;
}

export function Tabs({
    defaultValue,
    value: valueProp,
    onChange,
    urlHash = false,
    className,
    children,
}: TabsProps): React.ReactElement {
    const generatedId = React.useId();
    const [internalValue, setInternalValue] = React.useState<string>(
        defaultValue,
    );

    // Hidrata o valor inicial do hash quando aplicável. Roda apenas no
    // cliente, então uma comparação SSR-safe é suficiente.
    React.useEffect(() => {
        if (!urlHash || valueProp !== undefined) return;
        const hash = window.location.hash.replace(/^#/, "");
        if (hash.length > 0 && hash !== internalValue) {
            setInternalValue(hash);
        }
    }, [urlHash, valueProp, internalValue]);

    const isControlled = valueProp !== undefined;
    const value = isControlled ? valueProp : internalValue;

    const setValue = React.useCallback(
        (next: string) => {
            if (!isControlled) {
                setInternalValue(next);
            }
            if (urlHash && typeof window !== "undefined") {
                if (window.location.hash !== `#${next}`) {
                    window.history.replaceState(null, "", `#${next}`);
                }
            }
            onChange?.(next);
        },
        [isControlled, urlHash, onChange],
    );

    const ctxValue = React.useMemo<TabsContextValue>(
        () => ({ value, setValue, id: generatedId }),
        [value, setValue, generatedId],
    );

    return (
        <TabsContext.Provider value={ctxValue}>
            <div className={className}>{children}</div>
        </TabsContext.Provider>
    );
}

export interface TabListProps {
    /** Rótulo acessível da lista de tabs. */
    "aria-label": string;
    children: React.ReactNode;
    className?: string;
}

/**
 * TabList — container `role="tablist"` que distribui os triggers em
 * linha. Acompanha a navegação por teclado (←/→) por padrão.
 */
export function TabList({
    "aria-label": ariaLabel,
    children,
    className,
}: TabListProps): React.ReactElement {
    const composed = [
        // `overflow-x-auto` permite rolar abas em mobile.
        // `overflow-y-hidden` evita que o sublinhado do trigger ativo
        // empurre 1px e o Windows desenhe uma barra vertical fantasma.
        // `scrollbar-none` esconde a scrollbar horizontal nativa em
        // Windows (que aparece com setinhas e polui o layout) sem
        // prejudicar o scroll por wheel/swipe.
        "flex items-center gap-1 overflow-x-auto overflow-y-hidden scrollbar-none border-b border-[color:var(--hairline)]",
        className ?? "",
    ]
        .filter(Boolean)
        .join(" ");

    return (
        <div role="tablist" aria-label={ariaLabel} className={composed}>
            {children}
        </div>
    );
}

export interface TabTriggerProps {
    /** Identificador do tab. Deve casar com o `value` de um `TabPanel`. */
    value: string;
    children: React.ReactNode;
    className?: string;
}

/**
 * TabTrigger — botão que ativa o tab correspondente. Quando ativo,
 * recebe `aria-selected="true"` e estilo de "selecionado". Cores
 * vinculadas ao token `primary` para herdar a paleta global.
 */
export function TabTrigger({
    value,
    children,
    className,
}: TabTriggerProps): React.ReactElement {
    const ctx = useTabsContext();
    const isActive = ctx.value === value;
    const triggerId = `${ctx.id}-trigger-${value}`;
    const panelId = `${ctx.id}-panel-${value}`;

    const composed = [
        "relative inline-flex items-center gap-1.5 whitespace-nowrap px-4 py-3 text-sm font-medium tracking-tight transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/40",
        isActive
            ? "text-[color:var(--accent-deep)]"
            : "text-text-secondary hover:text-text-primary",
        className ?? "",
    ]
        .filter(Boolean)
        .join(" ");

    return (
        <button
            type="button"
            role="tab"
            id={triggerId}
            aria-controls={panelId}
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => ctx.setValue(value)}
            className={composed}
        >
            {children}
            {isActive ? (
                <span
                    aria-hidden="true"
                    className="absolute inset-x-3 bottom-0 h-[3px] rounded-t-full bg-[color:var(--accent)]"
                />
            ) : null}
        </button>
    );
}

export interface TabPanelProps {
    /** Identificador do tab. Deve casar com o `value` de um `TabTrigger`. */
    value: string;
    children: React.ReactNode;
    className?: string;
}

/**
 * TabPanel — bloco de conteúdo associado a um trigger. Renderiza `null`
 * quando não está ativo (não esconde via CSS) para evitar que campos
 * ocultos disputem foco com leitores de tela.
 */
export function TabPanel({
    value,
    children,
    className,
}: TabPanelProps): React.ReactElement | null {
    const ctx = useTabsContext();
    if (ctx.value !== value) return null;
    const triggerId = `${ctx.id}-trigger-${value}`;
    const panelId = `${ctx.id}-panel-${value}`;

    return (
        <div
            role="tabpanel"
            id={panelId}
            aria-labelledby={triggerId}
            tabIndex={0}
            className={className}
        >
            {children}
        </div>
    );
}
