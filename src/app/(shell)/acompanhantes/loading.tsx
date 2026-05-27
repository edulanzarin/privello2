import { Card, PageSurface, Skeleton } from "@/components";

/**
 * Loading state da listagem de Acompanhantes (`/acompanhantes`).
 * Renderiza enquanto a busca rebuilda os resultados. Mantém o
 * cabeçalho + sidebar de filtros + grid 3 colunas em desktop.
 */
export default function Loading() {
    return (
        <PageSurface width="lg">
            <div className="flex flex-col gap-6">
                {/* Cabeçalho */}
                <header className="flex flex-col gap-4">
                    <Skeleton height={36} width={220} />
                    <Skeleton height={20} width={280} variant="text" />
                    <Skeleton height={56} className="w-full" />
                    <div className="flex items-center justify-between">
                        <Skeleton height={32} width={100} className="lg:hidden" />
                        <Skeleton height={32} width={180} className="ml-auto" />
                    </div>
                </header>

                {/* Grid: sidebar + resultados */}
                <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
                    <aside className="hidden lg:block">
                        <Card className="!p-5">
                            <div className="flex flex-col gap-5">
                                {[1, 2, 3, 4].map((i) => (
                                    <div key={i} className="flex flex-col gap-2">
                                        <Skeleton
                                            height={12}
                                            width={80}
                                            variant="text"
                                        />
                                        <Skeleton height={36} className="w-full" />
                                    </div>
                                ))}
                            </div>
                        </Card>
                    </aside>

                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
                            <Card key={i} className="!p-0 overflow-hidden">
                                <Skeleton
                                    variant="card"
                                    className="!rounded-none aspect-[3/4] w-full"
                                />
                                <div className="flex flex-col gap-2 p-4">
                                    <Skeleton height={20} className="w-2/3" />
                                    <Skeleton
                                        height={14}
                                        className="w-1/2"
                                        variant="text"
                                    />
                                    <Skeleton
                                        height={14}
                                        className="w-full"
                                        variant="text"
                                    />
                                </div>
                            </Card>
                        ))}
                    </div>
                </div>
            </div>
        </PageSurface>
    );
}
