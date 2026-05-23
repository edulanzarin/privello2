import * as React from "react";

/**
 * Largura máxima do conteúdo dentro do {@link PageSurface}.
 *
 * - `"sm"`: `max-w-2xl` (672px). Para páginas focadas em formulário
 *   ou leitura linear (ex.: telas de cadastro detalhadas).
 * - `"md"` (padrão): `max-w-4xl` (896px). Padrão do produto, casa
 *   com o `ProfileHeader` e listas densas.
 * - `"lg"`: `max-w-6xl` (1152px). Para feeds/galerias com grid maior.
 */
export type PageSurfaceWidth = "sm" | "md" | "lg";

/**
 * Alinhamento vertical do conteúdo dentro do {@link PageSurface}.
 *
 * - `"top"` (padrão): conteúdo cola no topo do viewport. Comportamento
 *   default do produto — listas densas, painéis com Tabs, feeds.
 * - `"center"`: conteúdo é centralizado verticalmente entre TopBar e
 *   BottomNav. Útil para páginas curtas de "ação única" como a tela
 *   de Boost ou estados de empty/erro.
 */
export type PageSurfaceVerticalAlign = "top" | "center";

/**
 * Props do {@link PageSurface}.
 *
 * Container branco arredondado que ocupa o miolo da viewport e
 * hospeda todo o conteúdo de uma página autenticada. Substitui o
 * padrão antigo, em que cada seção/card ficava solta sobre o
 * `bg-background` lavanda da shell, dando uma sensação de "elementos
 * boiando".
 *
 * Visual: surface sólida (`bg-surface`) com cantos discretos, sombra
 * suave e padding interno generoso, separada do fundo da shell pelas
 * margens laterais. Quando `texture` é `true` (padrão), aplica uma
 * textura sutil de papel (granulado fino + leve vinheta warm) que
 * dá personalidade ao container sem competir com o conteúdo.
 *
 * Quando `banner` é fornecido, ele é renderizado **bleed total** no
 * topo do surface (sem padding lateral) com cantos superiores
 * arredondados acompanhando o container. O conteúdo `children`
 * segue normalmente abaixo com o padding interno padrão.
 *
 * Em mobile (`< sm`) o surface vai borda a borda — ali o destaque
 * vem da BottomNav e não faz sentido reduzir o conteúdo.
 *
 * Nenhuma prop carrega nomes de entidades de domínio (Property 29).
 */
export interface PageSurfaceProps {
    /** Largura máxima do conteúdo. Padrão: `"md"`. */
    width?: PageSurfaceWidth;
    /**
     * Quando `true`, aplica a textura `.texture-paper` (granulado +
     * vinheta tonal). Padrão: `true`. Use `false` em superfícies
     * onde a textura competiria com o conteúdo (ex.: galerias de
     * mídia que já têm muita imagem).
     */
    texture?: boolean;
    /**
     * Slot opcional renderizado no topo do surface, bleed total
     * (sem padding lateral). Tipicamente um
     * {@link import("./ProfileBanner").ProfileBanner}. Quando
     * presente, o conteúdo `children` ainda recebe o padding
     * interno normal logo abaixo.
     */
    banner?: React.ReactNode;
    /**
     * Alinhamento vertical na viewport. Padrão: `"top"`. Use
     * `"center"` em páginas curtas de ação única (ex.: Boost) para
     * que o conteúdo fique no meio entre TopBar e BottomNav.
     */
    verticalAlign?: PageSurfaceVerticalAlign;
    /** Classes extras aplicadas ao container. */
    className?: string;
    children: React.ReactNode;
}

const WIDTH_CLASSES: Record<PageSurfaceWidth, string> = {
    sm: "max-w-2xl",
    md: "max-w-4xl",
    lg: "max-w-6xl",
};

/**
 * PageSurface — superfície branca contida da página.
 *
 * Estrutura: wrapper externo com padding lateral leve para respirar
 * do fundo lavanda da shell + container `bg-surface` (branco) com
 * borda fina neutra, sombra sutil e cantos arredondados. Os blocos
 * internos (Card.default) ficam em `bg-neutral-50` (cinza muito
 * leve, quase imperceptível) para criar a hierarquia visual sem
 * brigar com a página em si.
 *
 * O conteúdo dentro fica em coluna com `gap-5` por padrão
 * (sobreescrevível via `className`).
 */
export function PageSurface({
    width = "md",
    texture = true,
    banner,
    verticalAlign = "top",
    className,
    children,
}: PageSurfaceProps): React.ReactElement {
    // Quando há banner, removemos o padding superior do container
    // (banner ocupa esse espaço e tem seus próprios cantos
    // arredondados), e usamos `overflow-hidden` para clipar o
    // banner na borda do surface.
    //
    // Para `verticalAlign="center"`, o wrapper externo vira flex em
    // coluna ocupando a altura disponível (descontada de TopBar/
    // BottomNav via `min-h-[calc(100dvh-9rem)]`) e centraliza o
    // surface filho verticalmente. Em mobile a altura virtual via
    // `dvh` respeita a barra de URL retrátil.
    const isCenter = verticalAlign === "center";

    return (
        <div
            className={[
                "mx-auto w-full px-3 py-3 sm:px-6 sm:py-6",
                isCenter
                    ? "flex min-h-[calc(100dvh-9rem)] flex-col justify-center"
                    : "",
            ]
                .filter(Boolean)
                .join(" ")}
        >
            <div
                className={[
                    "mx-auto flex w-full flex-col rounded-xl border border-neutral-200 bg-surface shadow-sm sm:rounded-2xl",
                    banner != null ? "overflow-hidden" : "",
                    texture ? "texture-paper" : "",
                    WIDTH_CLASSES[width],
                    className ?? "",
                ]
                    .filter(Boolean)
                    .join(" ")}
            >
                {banner != null ? <div>{banner}</div> : null}
                <div
                    className={[
                        "flex flex-col gap-5 p-4 sm:p-6",
                    ].join(" ")}
                >
                    {children}
                </div>
            </div>
        </div>
    );
}
