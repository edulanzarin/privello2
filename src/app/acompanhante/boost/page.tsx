import {
    Card,
    EmptyState,
    FlameIcon,
    PageSurface,
    SectionHeader,
    SparklesIcon,
    UsersIcon,
} from "@/components";
import { formatarPrecoBoost } from "@/domain/boost/definitions";
import { getCurrentSession } from "@/server/auth/currentSession";
import { obterStatusBoost } from "@/server/boost";

import { BoostStatusCard } from "./BoostStatusCard";
import { BoostCheckoutButton } from "./BoostCheckoutButton";

/**
 * Página de Boost (`/acompanhante/boost`).
 *
 * Boost é uma promoção paga de 24 horas que dá:
 *   - Prioridade total nas buscas (ranking acima de Premium e Básico).
 *   - Destaque na home pública.
 *
 * # Fluxo
 *
 * 1. **Sem boost ativo**: mostra a proposta + valor + benefícios e
 *    o botão "Comprar boost" que dispara o checkout do Mercado Pago
 *    (POST `/api/acompanhante/boost/checkout` → redirect pra
 *    `init_point` da Preference).
 * 2. **Com boost ativo**: mostra o card "Em chamas" com o tempo
 *    restante (countdown ao vivo) e a opção de "Estender por mais
 *    24h" — comprar de novo durante a janela ativa adiciona horas
 *    cumulativamente (a regra está em
 *    `calcularNovoBoostUntil` no domínio).
 * 3. **Pagamento pendente**: indica que o checkout foi iniciado e
 *    aguarda confirmação do MP. Geralmente resolve em segundos.
 *
 * Layout do `(acompanhante)` já garante sessão + plano vigente
 * antes de chegar aqui.
 */

const BENEFITS = [
    {
        icon: <SparklesIcon size={16} />,
        title: "Prioridade total nas buscas",
        description:
            "Aparece acima de Premium e Básico nos resultados da sua cidade.",
    },
    {
        icon: <UsersIcon size={16} />,
        title: "Destaque na home",
        description:
            "Boost ativo aparece em uma seção dedicada na home pública.",
    },
    {
        icon: <FlameIcon size={16} />,
        title: "24 horas de fogo",
        description:
            "Ativa na hora do pagamento. Comprar de novo estende a janela em mais 24h.",
    },
] as const;

export default async function BoostPage() {
    const session = await getCurrentSession();
    if (!session) {
        throw new Error("Boost sem sessão resolvida.");
    }

    const status = await obterStatusBoost(session.userId);
    const isAtivo = status.ativo;

    return (
        <PageSurface width="sm" verticalAlign="center">
            <SectionHeader
                title={isAtivo ? "Boost ativo" : "Em chamas por 24h"}
                subtitle={
                    isAtivo
                        ? "Você está nos primeiros resultados das buscas."
                        : `Por ${formatarPrecoBoost()} sua presença vai pra prioridade total.`
                }
            />

            {isAtivo && status.boostUntil ? (
                <BoostStatusCard
                    boostUntil={status.boostUntil.toISOString()}
                />
            ) : null}

            {status.agendadoParaInicio ? (
                <Card>
                    <div className="flex items-center gap-3">
                        <span
                            aria-hidden="true"
                            className="inline-flex h-10 w-10 flex-none items-center justify-center rounded-full bg-accent-soft text-accent-deep"
                        >
                            <FlameIcon size={20} />
                        </span>
                        <div className="flex flex-col gap-0.5">
                            <span className="text-sm font-semibold text-text-primary">
                                Boost programado
                            </span>
                            <span className="text-xs text-text-secondary">
                                Começa em{" "}
                                {status.agendadoParaInicio.toLocaleString(
                                    "pt-BR",
                                    {
                                        day: "2-digit",
                                        month: "2-digit",
                                        hour: "2-digit",
                                        minute: "2-digit",
                                    },
                                )}{" "}
                                e dura 24h. Pagamento já confirmado.
                            </span>
                        </div>
                    </div>
                </Card>
            ) : null}

            <Card>
                <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-3">
                        <span
                            aria-hidden="true"
                            className="inline-flex h-12 w-12 flex-none items-center justify-center rounded-full bg-accent-soft text-accent-deep"
                        >
                            <FlameIcon size={24} />
                        </span>
                        <div className="flex flex-col gap-0.5">
                            <span className="text-base font-semibold text-text-primary">
                                Boost
                            </span>
                            <span className="text-sm text-text-secondary">
                                Promoção de 24 horas com prioridade máxima.
                            </span>
                        </div>
                    </div>

                    <ul className="flex flex-col gap-3">
                        {BENEFITS.map((benefit) => (
                            <li
                                key={benefit.title}
                                className="flex items-start gap-3"
                            >
                                <span
                                    aria-hidden="true"
                                    className="inline-flex h-8 w-8 flex-none items-center justify-center rounded-full bg-accent-soft text-accent-deep"
                                >
                                    {benefit.icon}
                                </span>
                                <div className="flex flex-col gap-0.5">
                                    <span className="text-sm font-medium text-text-primary">
                                        {benefit.title}
                                    </span>
                                    <span className="text-xs text-text-secondary">
                                        {benefit.description}
                                    </span>
                                </div>
                            </li>
                        ))}
                    </ul>

                    <BoostCheckoutButton
                        ativo={isAtivo}
                        pendingPaymentId={status.pendingPaymentId}
                    />
                </div>
            </Card>

            <Card padding="none">
                <EmptyState
                    size="sm"
                    icon={<FlameIcon size={20} />}
                    title="Como funciona o pagamento"
                    description="Você é redirecionado para o checkout seguro. Após a confirmação, o boost ativa automaticamente. Pode levar alguns segundos."
                />
            </Card>
        </PageSurface>
    );
}
