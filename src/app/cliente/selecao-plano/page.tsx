import {
    Badge,
    ChatIcon,
    DiamondIcon,
    HeartIcon,
    OfferCard,
    OfferLayout,
    SparklesIcon,
    type OfferBenefit,
} from "@/components";
import {
    podeAlterarPlanoCliente,
    type PlanoClienteDefinition,
} from "@/domain/plano-cliente/definitions";
import { getCurrentSession } from "@/server/auth/currentSession";
import { listar, obterVigente } from "@/server/planos-cliente";

import { PlanoForm } from "./PlanoForm";

/**
 * Página de seleção de plano de Cliente (`/cliente/selecao-plano`).
 *
 * Espelha o desenho da tela de planos da Acompanhante, mas com:
 *
 * - Conjunto de planos próprio (`GRATIS`, `FAN`) vindo de
 *   `@/server/planos-cliente`.
 * - Cópia adaptada ao Cliente (foco em consumir/avaliar, não publicar).
 * - Mesma identidade visual via {@link OfferLayout} + {@link OfferCard}.
 *
 * Diferente da Acompanhante, **não bloqueia acesso à plataforma**
 * quando o Cliente ainda não escolheu um plano — esta página é o
 * destino natural após o cadastro, mas o Cliente pode pular e
 * voltar pela área de configurações depois.
 *
 * Quando o Cliente já é `FAN`, a página continua acessível mas
 * apresenta o card do Fan como "atual" (botão desabilitado) e o card
 * do Grátis como "downgrade não permitido". Downgrade ativo só
 * acontece passivamente quando a assinatura expira.
 */

function rotularPlano(tipo: PlanoClienteDefinition["tipo"]): string {
    return tipo === "GRATIS" ? "Grátis" : "Fan";
}

function rotularBotao(
    tipo: PlanoClienteDefinition["tipo"],
    isAtual: boolean,
): string {
    if (isAtual) return "Plano atual";
    return tipo === "GRATIS" ? "Continuar com Grátis" : "Quero ser Fan";
}

function descricaoPlano(tipo: PlanoClienteDefinition["tipo"]): string {
    return tipo === "GRATIS"
        ? "Veja perfis, fotos e Stories. Bom pra explorar antes de virar Fan."
        : "Tudo do Grátis e ainda interaja: leia e publique avaliações e comentários, curta fotos.";
}

function beneficios(plano: PlanoClienteDefinition): readonly OfferBenefit[] {
    const isFan = plano.tipo === "FAN";
    const items: OfferBenefit[] = [];

    if (plano.podeVerStories) {
        items.push({
            label: "Veja Stories e fotos das Acompanhantes",
            icon: SparklesIcon,
        });
    }
    if (plano.podeAvaliar) {
        items.push({
            label: "Publique avaliações sobre quem você conheceu",
            icon: ChatIcon,
            highlight: isFan,
        });
    }
    if (plano.podeVerAvaliacoes) {
        items.push({
            label: "Leia avaliações de outros Clientes",
            icon: ChatIcon,
            highlight: isFan,
        });
    }
    if (plano.podeVerComentarios) {
        items.push({
            label: "Veja comentários nas fotos",
            highlight: isFan,
        });
    }
    if (plano.podeComentar) {
        items.push({
            label: "Comente nas fotos",
            highlight: isFan,
        });
    }
    if (plano.podeCurtir) {
        items.push({
            label: "Curta fotos e Stories",
            icon: HeartIcon,
            highlight: isFan,
        });
    }

    return items;
}

export default async function SelecaoPlanoClientePage() {
    const session = await getCurrentSession();
    if (!session) {
        // Layout protege esta rota; aqui é defensivo.
        throw new Error("Selecao_de_Plano sem sessão resolvida.");
    }

    const planoAtual = await obterVigente(session.userId);
    const planos = listar();

    const isPrimeiraEscolha = planoAtual === null;

    return (
        <OfferLayout
            eyebrow={isPrimeiraEscolha ? "Bem-vindo à Privello" : "Trocar plano"}
            title={
                isPrimeiraEscolha
                    ? "Escolha como você quer participar"
                    : "Faça upgrade"
            }
            subtitle={
                isPrimeiraEscolha
                    ? "Comece grátis ou desbloqueie tudo com o Fan."
                    : "Você está no Grátis. O Fan libera avaliações, comentários e curtidas."
            }
            footer="Você pode dar upgrade depois. Trocar para um plano menor não é possível enquanto o atual estiver ativo."
        >
            {planos.map((plano, index) => {
                const isFan = plano.tipo === "FAN";
                const isAtual =
                    planoAtual !== null && planoAtual.tipo === plano.tipo;
                const podeIr =
                    isPrimeiraEscolha ||
                    podeAlterarPlanoCliente(
                        planoAtual?.tipo ?? null,
                        plano.tipo,
                    );

                return (
                    <OfferCard
                        key={plano.tipo}
                        name={rotularPlano(plano.tipo)}
                        description={descricaoPlano(plano.tipo)}
                        benefits={beneficios(plano)}
                        recommended={isFan && !isAtual}
                        badge={
                            isFan && !isAtual ? (
                                <Badge
                                    tone="primaryGradient"
                                    icon={<DiamondIcon size={11} />}
                                    className="absolute right-5 top-5 px-3 py-1"
                                >
                                    Recomendado
                                </Badge>
                            ) : undefined
                        }
                        animationDelayMs={120 + index * 80}
                    >
                        <PlanoForm
                            tipo={plano.tipo}
                            label={rotularBotao(plano.tipo, isAtual)}
                            variant={
                                isAtual
                                    ? "ghost"
                                    : isFan
                                        ? "primary"
                                        : "secondary"
                            }
                            disabled={isAtual || !podeIr}
                        />
                    </OfferCard>
                );
            })}
        </OfferLayout>
    );
}
