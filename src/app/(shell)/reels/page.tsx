import { Card, EmptyState, PageSurface, PlayCircleIcon } from "@/components";

/**
 * Reels (`/reels`).
 *
 * Placeholder do feed vertical de mídias curtas. A implementação final
 * dependerá do `Sistema_de_Midias` (limites por Plano,
 * `permiteStories`/`permiteAudio`) e fica fora do escopo do MVP atual.
 */
export default function ReelsPage() {
    return (
        <PageSurface>
            <header className="flex flex-col gap-1">
                <h1 className="text-2xl font-semibold tracking-tight text-text-primary">
                    Reels
                </h1>
                <p className="text-sm text-text-secondary">
                    Vídeos curtos de Acompanhantes recomendadas.
                </p>
            </header>

            <Card padding="none">
                <EmptyState
                    icon={<PlayCircleIcon size={20} />}
                    title="Em breve"
                    description="Feed vertical de vídeos curtos chega na próxima atualização."
                />
            </Card>
        </PageSurface>
    );
}
