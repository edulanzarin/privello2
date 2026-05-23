import * as React from "react";

/**
 * Props do {@link AuthCard}.
 *
 * Wrapper visual padrão das telas de autenticação e cadastro: centraliza o
 * conteúdo na viewport, encapsula o card de superfície sólida (borda
 * neutra fina, cantos discretos, sombra sutil) e oferece slots opcionais
 * para o cabeçalho (título + subtítulo), um bloco "above-card" exibido
 * acima do cartão (útil para indicadores de progresso) e o rodapé
 * (links auxiliares tipo "já tenho conta", "criar conta").
 *
 * Centraliza o layout que estava duplicado entre `/login`,
 * `/cadastro`, `/cadastro/cliente` e o Onboarding_Acompanhante, de modo
 * que mudar a estética do card seja uma alteração local.
 *
 * Nenhuma prop carrega nomes de entidades de domínio (Property 29).
 */
export interface AuthCardProps {
    /** Título principal exibido no topo do card. Opcional. */
    title?: React.ReactNode;
    /** Subtítulo curto exibido logo abaixo do título. Opcional. */
    subtitle?: React.ReactNode;
    /**
     * Bloco renderizado **fora** do cartão, logo acima dele. Pensado
     * para indicadores de progresso (ex.: "Passo 1 de 6" + barra). Não
     * recebe estilos de card, então o conteúdo deve cuidar do próprio
     * espaçamento e tipografia.
     */
    aboveCard?: React.ReactNode;
    /**
     * Conteúdo do rodapé (geralmente um link auxiliar). Renderizado
     * dentro do mesmo card, abaixo do conteúdo principal, com separação
     * visual sutil. Opcional.
     */
    footer?: React.ReactNode;
    /**
     * Largura máxima do card. Padrão `"lg"` para uniformizar todas as
     * telas de autenticação/cadastro com a mesma largura — evita que
     * o usuário sinta o card "encolhendo/crescendo" ao avançar entre
     * steps com quantidades diferentes de campos.
     */
    maxWidth?: "sm" | "md" | "lg";
    /** Conteúdo principal do card. */
    children: React.ReactNode;
}

const MAX_WIDTH_CLASSES: Record<NonNullable<AuthCardProps["maxWidth"]>, string> = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-2xl",
};

/**
 * AuthCard — layout reusável das páginas de autenticação e cadastro.
 *
 * Renderiza:
 *   - `<main>` ocupando toda a viewport com centralização vertical e
 *     horizontal;
 *   - bloco opcional acima do cartão (`aboveCard`), útil para
 *     indicadores de progresso;
 *   - card branco com borda neutra, cantos discretos e sombra leve;
 *   - cabeçalho opcional (título + subtítulo) em texto sólido;
 *   - área de conteúdo;
 *   - rodapé opcional separado por divisor sutil.
 *
 * O componente não tem fundo gradiente nem decoração colorida — a
 * identidade visual fica nos campos, botões e links contidos, que
 * consomem os mesmos tokens da Biblioteca_de_Componentes.
 */
export function AuthCard({
    title,
    subtitle,
    aboveCard,
    footer,
    maxWidth = "lg",
    children,
}: AuthCardProps): React.ReactElement {
    const hasHeader = title != null || subtitle != null;
    const wrapperClass = [
        "w-full animate-fade-in",
        MAX_WIDTH_CLASSES[maxWidth],
    ].join(" ");

    return (
        <main className="flex min-h-screen items-center justify-center px-4 py-12">
            <div className={wrapperClass}>
                {aboveCard != null ? (
                    <div className="mb-5 flex flex-col items-center">
                        {aboveCard}
                    </div>
                ) : null}

                <section className="rounded-xl border border-neutral-200 bg-surface shadow-sm">
                    {hasHeader ? (
                        <header className="px-6 pt-7 pb-2 text-center sm:px-8">
                            {title != null ? (
                                <h1 className="text-lg font-semibold tracking-tight text-text-primary">
                                    {title}
                                </h1>
                            ) : null}
                            {subtitle != null ? (
                                <p className="mt-1 text-xs text-text-secondary">
                                    {subtitle}
                                </p>
                            ) : null}
                        </header>
                    ) : null}

                    <div className="flex flex-col gap-5 px-6 py-6 sm:px-8">
                        {children}
                    </div>

                    {footer != null ? (
                        <footer className="border-t border-neutral-200 bg-neutral-50/40 px-6 py-4 text-center text-xs text-text-secondary sm:px-8">
                            {footer}
                        </footer>
                    ) : null}
                </section>
            </div>
        </main>
    );
}
