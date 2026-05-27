import { Card, PageSurface, Skeleton } from "@/components";

/**
 * Loading state da home pública. Renderiza enquanto o RSC busca
 * `listarFeedHome` + `obterStatsHome`. Reproduz o esqueleto do
 * hero + 2 grids de cards pra que a transição não pareça "vazia".
 */
export default function Loading() {
    return (
        <PageSurface width="lg">
            <div className="flex flex-col gap-12">
                {/* Hero — headline + StatList aside */}
                <section className="flex flex-col gap-10">
                    <div className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-end lg:gap-16">
                        <div className="flex flex-col gap-6">
                            <Skeleton width={120} height={24} variant="text" />
                            <Skeleton height={56} className="w-full max-w-xl" />
                            <Skeleton height={24} className="w-3/4 max-w-md" />
                            <Skeleton height={20} className="w-2/3 max-w-md" />
                        </div>
                        <Card className="!p-6">
                            <div className="flex flex-col gap-4">
                                {[1, 2, 3, 4].map((i) => (
                                    <div
                                        key={i}
                                        className="flex items-center justify-between"
                                    >
                                        <Skeleton width={100} height={14} variant="text" />
                                        <Skeleton width={50} height={22} />
                                    </div>
                                ))}
                            </div>
                        </Card>
                    </div>
                    <Skeleton height={56} className="w-full" />
                </section>

                {/* Em destaque (Boost) */}
                <FeedSectionSkeleton />
                {/* Em alta */}
                <FeedSectionSkeleton />
            </div>
        </PageSurface>
    );
}

function FeedSectionSkeleton() {
    return (
        <section className="flex flex-col gap-6 border-t border-border pt-12">
            <div className="flex items-end justify-between gap-4">
                <div className="flex flex-col gap-2">
                    <Skeleton width={140} height={28} />
                    <Skeleton width={220} height={16} variant="text" />
                </div>
                <Skeleton width={80} height={20} variant="text" />
            </div>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                    <ProfileCardSkeleton key={i} />
                ))}
            </div>
        </section>
    );
}

function ProfileCardSkeleton() {
    return (
        <Card className="!p-0 overflow-hidden">
            <Skeleton variant="card" className="!rounded-none aspect-[3/4] w-full" />
            <div className="flex flex-col gap-2 p-4">
                <Skeleton height={20} className="w-2/3" />
                <Skeleton height={14} className="w-1/2" variant="text" />
                <Skeleton height={14} className="w-full" variant="text" />
            </div>
        </Card>
    );
}
