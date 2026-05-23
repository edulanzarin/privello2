"use client";

import * as React from "react";
import { createPortal } from "react-dom";

/**
 * Props do {@link ComboboxDropdown}.
 *
 * Painel posicionado abaixo de um input/gatilho de combobox. Define
 * a estética visual canônica (borda, sombra, scroll, max-height) num
 * único lugar para que `Select`, autocomplete de cidade, autocomplete
 * de bairro e qualquer menu suspenso compartilhem o mesmo visual.
 *
 * # Anchor obrigatório
 *
 * O dropdown é renderizado via React portal no `<body>` para que ele
 * "fure" qualquer `overflow-hidden` ancestral (modais, cards
 * roláveis, carrosséis). A posição é calculada via
 * `getBoundingClientRect` do `anchor`, recalculada em `resize` e
 * `scroll`.
 *
 * Quando `anchor` é omitido (legado), cai no posicionamento absoluto
 * antigo — mantido para compatibilidade. Novos call-sites devem
 * sempre passar a ref do gatilho.
 *
 * Nenhuma prop carrega nomes de entidades de domínio (Property 29).
 */
export interface ComboboxDropdownProps {
    /** Identificador exposto via `id`, usado por `aria-controls`. */
    id?: string;
    /** Rótulo acessível (`aria-labelledby` aponta para este elemento). */
    "aria-labelledby"?: string;
    /**
     * Ref do elemento que o dropdown deve seguir em posição. Quando
     * fornecido, o dropdown é portalizado no `<body>` com `position:
     * fixed` calculada via `getBoundingClientRect`.
     */
    anchor?: React.RefObject<HTMLElement | null>;
    /** Conteúdo, tipicamente uma sequência de {@link ComboboxOption}. */
    children: React.ReactNode;
}

interface AnchorRect {
    top: number;
    left: number;
    width: number;
    height: number;
}

function readAnchorRect(el: HTMLElement | null): AnchorRect | null {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { top: r.top, left: r.left, width: r.width, height: r.height };
}

/**
 * ComboboxDropdown — painel `<ul role="listbox">` reusado por todos os
 * comboboxes/selects da plataforma.
 *
 * Modo `anchor` (recomendado): portal no `<body>` com posição
 * `fixed` calculada do anchor, sobrevive a `overflow-hidden` de
 * ancestrais. Recalcula em `resize`, `scroll` (capture) e quando o
 * conteúdo muda.
 *
 * Modo legado: `position: absolute` dentro do anchor relativo do
 * consumidor. Mantido só para compat retroativa de call-sites
 * antigos.
 */
export const ComboboxDropdown = React.forwardRef<
    HTMLUListElement,
    ComboboxDropdownProps
>(function ComboboxDropdown(
    { id, "aria-labelledby": ariaLabelledBy, anchor, children },
    ref,
): React.ReactElement {
    const baseClass =
        "z-50 max-h-60 overflow-y-auto rounded-md border border-neutral-200 bg-surface py-1 shadow-md";

    if (anchor === undefined) {
        // Modo legado: absoluto dentro do wrapper relativo.
        return (
            <ul
                ref={ref}
                id={id}
                role="listbox"
                aria-labelledby={ariaLabelledBy}
                data-combobox-dropdown="true"
                className={`absolute left-0 right-0 top-full mt-1 ${baseClass}`}
            >
                {children}
            </ul>
        );
    }

    return (
        <PortalDropdown
            anchor={anchor}
            id={id}
            ariaLabelledBy={ariaLabelledBy}
            className={`fixed ${baseClass}`}
            forwardedRef={ref}
        >
            {children}
        </PortalDropdown>
    );
});

interface PortalDropdownProps {
    anchor: React.RefObject<HTMLElement | null>;
    id?: string;
    ariaLabelledBy?: string;
    className: string;
    children: React.ReactNode;
    forwardedRef: React.ForwardedRef<HTMLUListElement>;
}

function PortalDropdown({
    anchor,
    id,
    ariaLabelledBy,
    className,
    children,
    forwardedRef,
}: PortalDropdownProps): React.ReactElement | null {
    const [rect, setRect] = React.useState<AnchorRect | null>(() =>
        readAnchorRect(anchor.current),
    );
    const [mounted, setMounted] = React.useState(false);

    React.useEffect(() => {
        setMounted(true);
    }, []);

    React.useEffect(() => {
        function update(): void {
            setRect(readAnchorRect(anchor.current));
        }
        update();
        // `scroll` em capture pega scroll de qualquer ancestral
        // (Modal/Card rolável). Resize cobre redimensionamento.
        window.addEventListener("resize", update);
        window.addEventListener("scroll", update, true);
        // Re-checa periodicamente em casos extremos (animações,
        // transições de altura no formulário pai). 60Hz é overkill
        // mas é barato e elimina edge cases.
        const interval = window.setInterval(update, 60);
        return () => {
            window.removeEventListener("resize", update);
            window.removeEventListener("scroll", update, true);
            window.clearInterval(interval);
        };
    }, [anchor]);

    if (!mounted || rect === null) return null;

    const style: React.CSSProperties = {
        top: rect.top + rect.height + 4,
        left: rect.left,
        width: rect.width,
    };

    return createPortal(
        <ul
            ref={forwardedRef}
            id={id}
            role="listbox"
            aria-labelledby={ariaLabelledBy}
            data-combobox-dropdown="true"
            className={className}
            style={style}
        >
            {children}
        </ul>,
        document.body,
    );
}
