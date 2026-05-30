import { Card, PageSurface, Skeleton } from "@/components";

/**
 * Loading state do painel da Acompanhante.
 */
export default function Loading() {
    return (
        <PageSurface
            banner={<Skeleton variant="card" className="!rounded-none h-44 w-full" />}
        >
            <div className="flex flex-col gap-5">
                {/* ProfileHeader */}
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

                {/* MetricPills */}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {[1, 2, 3, 4].map((i) => (
                        <Skeleton key={i} height={48} />
                    ))}
                </div>

                {/* Tabs */}
                <Skeleton height={40} width={320} />

                {/* Conteúdo da aba */}
                <div className="flex flex-col gap-4">
                    <Skeleton height={20} width={140} />
                    <Card>
                        <div className="flex flex-col gap-3">
                            <Skeleton height={14} className="w-full" variant="text" />
                            <Skeleton height={14} className="w-3/4" variant="text" />
                        </div>
                    </Card>

                    <Skeleton height={20} width={180} />
                    <Card>
                        <div className="flex flex-col gap-4">
                            {[1, 2, 3].map((i) => (
                                <div
                                    key={i}
                                    className="flex items-center justify-between gap-3"
                                >
                                    <div className="flex items-center gap-3">
                                        <Skeleton width={20} height={20} />
                                        <Skeleton
                                            height={14}
                                            width={140}
                                            variant="text"
                                        />
                                    </div>
                                    <Skeleton
                                        height={14}
                                        width={80}
                                        variant="text"
                                    />
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>
            </div>
        </PageSurface>
    );
}
