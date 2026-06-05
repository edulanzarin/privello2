import { MicIcon, OfferCard, OfferLayout, PaymentResultBanner, PlanComparison } from "@/components";
import {
    PLANO_DEFINITIONS,
    podeAlterarPlano,
    type PlanoDefinition,
} from "@/domain/plano/definitions";
import { getCurrentSession } from "@/server/auth/currentSession";
import { listar, obterVigente } from "@/server/planos";

import { PlanoForm } from "./PlanoForm";

/**
 * Página de Selecao_de_Plano (Sistema_de_Planos).
 *
 * Server Component que renderiza um cartão por plano disponível a
 * partir do plano vigente da Acompanhante:
 *
 * - **Sem plano** (`planoVigente === null`, primeira escolha
 *   pós-cadastro): mostra todos os planos.
 * - **Com plano Básico**: mostra Básico (idempotente, mas o botão
 *   fica em estado neutro indicando "atual") + Premium (upgrade).
 * - **Com plano Premium**: o layout já redireciona — esta página
 *   nem chega a renderizar pra Premium.
 *
 * Reusa os primitivos {@link OfferLayout} e {@link OfferCard} da
 * Biblioteca_de_Componentes, garantindo paridade visual com a tela de
 * planos de Cliente. Os termos de domínio (`Plano_Premium`,
 * `Áudio_de_Apresentação`, etc.) ficam aqui na página, fora dos
 * primitivos (Property 29).
 */

function rotularPlano(tipo: PlanoDefinition["tipo"]): string {
    return tipo === "BASICO" ? "Plano Básico" : "Plano Premium";
}

function rotularBotao(
    tipo: PlanoDefinition["tipo"],
    isAtual: boolean,
): string {
    if (isAtual) return "Plano atual";
    return tipo === "BASICO" ? "Escolher Básico" : "Escolher Premium";
}

function descricaoPlano(tipo: PlanoDefinition["tipo"]): string {
    return tipo === "BASICO"
        ? "O essencial para começar com presença consistente."
        : "Visibilidade máxima, recursos premium e prioridade.";
}

/**
 * Formata o preço mensal do plano em BRL (`"R$ 99,90"`).
 */
function formatarPrecoMensal(cents: number): string {
    return `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}

/**
 * Traduz os atributos canônicos do {@link PlanoDefinition} em itens
 * visuais para o {@link OfferCard}. Em vez de exibir o número absoluto
 * de mídias permitidas, comunicamos a diferença qualitativa entre os
 * planos.
 */
function beneficios(plano: PlanoDefinition) {
    const isPremium = plano.tipo === "PREMIUM";
    const items: import("@/components").OfferBenefit[] = [
        {
            label: isPremium
                ? "Muito mais mídias além da foto de perfil"
                : "Mídias suficientes para começar",
        },
        {
            label: plano.permiteStories
                ? "Stories disponíveis"
                : "Stories não inclusos",
        },
        {
            label: plano.prioridadeBusca
                ? "Prioridade em buscas"
                : "Sem prioridade em buscas",
        },
    ];
    if (plano.permiteAudio) {
        items.push({
            label: "Áudio de apresentação “Ouça minha voz”",
            icon: MicIcon,
            highlight: true,
        });
    }
    return items;
}

/**
 * Linhas do comparativo Básico × Premium, derivadas do catálogo
 * canônico {@link PLANO_DEFINITIONS}. Mantém os números (limites)
 * em sincronia com o domínio — sem hardcode na UI.
 */
function linhasComparativo() {
    const b = PLANO_DEFINITIONS.BASICO;
    const p = PLANO_DEFINITIONS.PREMIUM;
    const limiteReelsLabel = (n: number): string =>
        Number.isFinite(n) ? String(n) : "Ilimitado";
    return [
        {
            label: "Mídias na galeria",
            values: [String(b.limiteMidias), String(p.limiteMidias)],
        },
        {
            label: "Reels",
            values: [limiteReelsLabel(b.limiteReels), limiteReelsLabel(p.limiteReels)],
        },
        { label: "Stories", values: [b.permiteStories, p.permiteStories] },
        {
            label: "Áudio de apresentação",
            values: [b.permiteAudio, p.permiteAudio],
        },
        {
            label: "Vídeo de apresentação",
            values: [b.permiteAudio, p.permiteAudio],
        },
        {
            label: "Prioridade em buscas",
            values: [b.prioridadeBusca, p.prioridadeBusca],
        },
    ];
}

export default async function SelecaoPlanoPage({
    searchParams,
}: {
    searchParams: Promise<{ payment?: string; status?: string }>;
}) {
    const session = await getCurrentSession();
    if (!session) {
        // Layout protege esta rota; aqui é defensivo para satisfazer
        // o tipo do `obterVigente`.
        throw new Error("Selecao_de_Plano sem sessão resolvida.");
    }

    const sp = await searchParams;
    const paymentStatus = sp.payment ?? sp.status;

    const planoAtual = await obterVigente(session.userId);
    const planos = listar();

    const isPrimeiraEscolha = planoAtual === null;

    return (
        <>
            <PaymentResultBanner status={paymentStatus} />
            <OfferLayout
            eyebrow={isPrimeiraEscolha ? "Sua jornada começa aqui" : "Trocar plano"}
            title={isPrimeiraEscolha ? "Escolha seu plano" : "Faça upgrade"}
            subtitle={
                isPrimeiraEscolha
                    ? "Selecione o plano que combina com você para liberar sua área."
                    : "Você está no Básico. Premium libera Stories, prioridade em buscas e o áudio de apresentação."
            }
            footer="Você pode dar upgrade depois. Trocar para um plano menor não é possível enquanto o atual estiver ativo."
        >
            {planos.map((plano, index) => {
                const isPremium = plano.tipo === "PREMIUM";
                const isAtual =
                    planoAtual !== null && planoAtual.tipo === plano.tipo;
                const podeIr =
                    isPrimeiraEscolha ||
                    podeAlterarPlano(planoAtual?.tipo ?? null, plano.tipo);

                return (
                    <OfferCard
                        key={plano.tipo}
                        name={rotularPlano(plano.tipo)}
                        description={descricaoPlano(plano.tipo)}
                        price={formatarPrecoMensal(plano.precoCents)}
                        priceSuffix="/mês"
                        benefits={beneficios(plano)}
                        recommended={isPremium && !isAtual}
                        animationDelayMs={120 + index * 80}
                    >
                        <PlanoForm
                            tipo={plano.tipo}
                            label={rotularBotao(plano.tipo, isAtual)}
                            variant={
                                isAtual
                                    ? "ghost"
                                    : isPremium
                                        ? "primary"
                                        : "secondary"
                            }
                            disabled={isAtual || !podeIr}
                        />
                    </OfferCard>
                );
            })}
            </OfferLayout>

            {/* Comparativo contextual Básico × Premium (W4). Em vez de
                só bloquear recursos, mostra lado a lado o que cada
                plano entrega. */}
            <section className="mx-auto w-full max-w-3xl px-4 pb-12 sm:px-6">
                <h2 className="mb-3 text-center text-lg font-semibold tracking-tight text-text-primary">
                    Compare os planos
                </h2>
                <PlanComparison
                    caption="Recurso"
                    columns={[
                        { title: "Básico" },
                        { title: "Premium", highlight: true },
                    ]}
                    rows={linhasComparativo()}
                />
            </section>
        </>
    );
}
