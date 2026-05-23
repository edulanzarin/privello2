import { Card, EmptyState, PageSurface, SparklesIcon } from "@/components";

/**
 * Home (`/`).
 *
 * Página pública de entrada da Privello. Atualmente um placeholder
 * — a versão final terá hero de busca, destaques de Acompanhantes
 * próximas e blocos de descoberta. A navegação (TopBar + BottomNav)
 * é fornecida pelo {@link import("./layout").default} via
 * {@link import("@/components").AppShell}.
 */
export default function HomePage() {
    return (
        <PageSurface width="sm">
            <section className="flex flex-col gap-2 text-center">
                <h1 className="text-2xl font-semibold tracking-tight text-text-primary sm:text-3xl">
                    Encontre Acompanhantes próximas a você
                </h1>
                <p className="text-sm text-text-secondary">
                    Use a aba <span className="font-medium">Acompanhantes</span>{" "}
                    para começar sua busca.
                </p>
            </section>

            <Card padding="none">
                <EmptyState
                    icon={<SparklesIcon size={20} />}
                    title="Em breve"
                    description="Busca por cidade, destaques e Reels chegam nas próximas atualizações."
                />
            </Card>
        </PageSurface>
    );
}
