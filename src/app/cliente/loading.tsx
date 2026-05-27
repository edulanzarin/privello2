import { Card, PageSurface, Skeleton } from "@/components";

/**
 * Loading state do painel do Cliente.
 */
export default function Loading() {
    return (
        <PageSurface>
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
                <div className="grid grid-cols-3 gap-2">
                    {[1, 2, 3].map((i) => (
                        <Skeleton key={i} height={48} />
                    ))}
                </div>

                {/* Tabs */}
                <Skeleton height={40} width={260} />

                {/* Conteúdo da aba */}
                <Card>
                    <div className="flex flex-col gap-4">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="flex items-center gap-3">
                                <Skeleton variant="avatar" width={32} height={32} />
                                <div className="flex flex-1 flex-col gap-2">
                                    <Skeleton
                                        height={14}
                                        width="40%"
                                        variant="text"
                                    />
                                    <Skeleton
                                        height={12}
                                        width="80%"
                                        variant="text"
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
            </div>
        </PageSurface>
    );
}
