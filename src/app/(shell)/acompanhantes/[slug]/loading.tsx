import { Card, PageSurface, Skeleton } from "@/components";

/**
 * Loading state do perfil público de Acompanhante. Renderiza
 * enquanto o RSC resolve perfil + galeria + reviews + perguntas
 * + stories. Mantém estrutura próxima do layout final pra que
 * a transição não pule.
 */
export default function Loading() {
    return (
        <PageSurface
            banner={<Skeleton variant="card" className="!rounded-none h-44 w-full" />}
        >
            <div className="flex flex-col gap-6">
                {/* Identidade */}
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 sm:gap-4">
                        <Skeleton variant="avatar" width={72} height={72} />
                        <div className="flex flex-col gap-2">
                            <Skeleton height={22} width={180} />
                            <Skeleton height={14} width={120} variant="text" />
                        </div>
                    </div>
                    <Skeleton height={28} width={80} />
                </div>

                {/* Meta-row */}
                <div className="flex gap-3">
                    <Skeleton height={14} width={120} variant="text" />
                    <Skeleton height={14} width={100} variant="text" />
                </div>

                {/* CTA WhatsApp */}
                <Skeleton height={48} className="w-full" />

                {/* Stat cards lado a lado */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Card>
                        <div className="flex flex-col gap-2">
                            <Skeleton height={14} width={80} variant="text" />
                            <Skeleton height={28} width={140} />
                        </div>
                    </Card>
                    <Card>
                        <div className="flex flex-col gap-2">
                            <Skeleton height={14} width={100} variant="text" />
                            <Skeleton height={28} width={160} />
                        </div>
                    </Card>
                </div>

                {/* Sobre mim */}
                <div className="flex flex-col gap-3">
                    <Skeleton height={20} width={100} />
                    <Card>
                        <div className="flex flex-col gap-2">
                            <Skeleton height={14} className="w-full" variant="text" />
                            <Skeleton height={14} className="w-5/6" variant="text" />
                            <Skeleton height={14} className="w-3/4" variant="text" />
                        </div>
                    </Card>
                </div>

                {/* Galeria — grid */}
                <div className="flex flex-col gap-3">
                    <Skeleton height={20} width={80} />
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
                        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                            <Skeleton
                                key={i}
                                variant="card"
                                className="aspect-[3/4] w-full"
                            />
                        ))}
                    </div>
                </div>
            </div>
        </PageSurface>
    );
}
