import { Card, EmptyState, PageSurface, UsersIcon } from "@/components";

/**
 * Lista pública de Acompanhantes (`/acompanhantes`).
 *
 * Placeholder até a feature de busca ser construída. A versão final
 * terá filtros por cidade/estado, ordenação por proximidade e
 * paginação por scroll infinito.
 */
export default function AcompanhantesPage() {
    return (
        <PageSurface>
            <header className="flex flex-col gap-1">
                <h1 className="text-2xl font-semibold tracking-tight text-text-primary">
                    Acompanhantes
                </h1>
                <p className="text-sm text-text-secondary">
                    Encontre quem está disponível na sua cidade.
                </p>
            </header>

            <Card padding="none">
                <EmptyState
                    icon={<UsersIcon size={20} />}
                    title="Em breve"
                    description="Lista com filtros por estado, cidade e disponibilidade nas próximas atualizações."
                />
            </Card>
        </PageSurface>
    );
}
