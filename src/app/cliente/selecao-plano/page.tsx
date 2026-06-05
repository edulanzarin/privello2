import {
    Badge,
    ChatIcon,
    DiamondIcon,
    HeartIcon,
    OfferCard,
    OfferLayout,
    PaymentResultBanner,
    SparklesIcon,
    type OfferBenefit,
} from "@/components";
import {
    PLANO_CLIENTE_DURACOES,
    type PlanoClienteDuracao,
} from "@/domain/plano-cliente/definitions";
import { getCurrentSession } from "@/server/auth/currentSession";
import { obterVigente } from "@/server/planos-cliente";
import { obterPerfilCliente } from "@/server/cliente-profile";

import { PlanoForm } from "./PlanoForm";

/**
 * Página de seleção de plano de Cliente (`/cliente/selecao-plano`).
 *
 * Mostra 4 opções em cards:
 *
 *   1. **Grátis** — sempre disponível, idempotente.
 *   2. **Fan 24h** — R$ 3,99. Acesso premium por 1 dia.
 *   3. **Fan 7 dias** — R$ X. Pacote semanal.
 *   4. **Fan 30 dias** — R$ Y. Assinatura padrão.
 *
 * Comprar Fan estando já com Fan ativo **estende** a janela
 * (cumulativo). O backend (`comprarFan`) cuida disso.
 *
 * Diferente da Acompanhante, **não bloqueia acesso à plataforma**
 * quando o Cliente ainda não escolheu um plano — esta página é o
 * destino natural após o cadastro, mas o Cliente pode pular e
 * voltar pela área de configurações depois.
 */

const DURACOES: ReadonlyArray<PlanoClienteDuracao> = [
    "FAN_24H",
    "FAN_7D",
    "FAN_30D",
];

function formatarPreco(cents: number): string {
    return `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}

const FAN_BENEFITS: ReadonlyArray<OfferBenefit> = [
    {
        label: "Leia avaliações de outros Clientes",
        icon: ChatIcon,
        highlight: true,
    },
    { label: "Veja perguntas e respostas", icon: ChatIcon, highlight: true },
    { label: "Comente e curta as fotos", icon: HeartIcon, highlight: true },
    { label: "Avalie seus encontros", icon: SparklesIcon, highlight: true },
];

const GRATIS_BENEFITS: ReadonlyArray<OfferBenefit> = [
    { label: "Veja perfis públicos das Acompanhantes" },
    { label: "Veja Stories" },
    { label: "Filtre por cidade, gênero, preço e mais" },
];

/**
 * Formata "expira em X" a partir de uma data — usado quando o
 * Cliente já tem Fan ativo e a página deve indicar isso.
 */
function expiraEmTexto(expiraEm: Date | null, now: Date): string | null {
    if (!expiraEm) return null;
    const ms = expiraEm.getTime() - now.getTime();
    if (ms <= 0) return null;
    const horas = Math.floor(ms / (60 * 60 * 1000));
    if (horas < 24) return `Expira em ${horas} h`;
    const dias = Math.floor(horas / 24);
    return `Expira em ${dias} ${dias === 1 ? "dia" : "dias"}`;
}

export default async function SelecaoPlanoClientePage({
    searchParams,
}: {
    searchParams: Promise<{ payment?: string; status?: string }>;
}) {
    const session = await getCurrentSession();
    if (!session) {
        throw new Error("Selecao_de_Plano sem sessão resolvida.");
    }

    const sp = await searchParams;
    const paymentStatus = sp.payment ?? sp.status;

    const planoAtual = await obterVigente(session.userId);
    const perfil = await obterPerfilCliente(session.userId);
    const now = new Date();
    const fanAtivo = planoAtual?.tipo === "FAN";
    const expiraTexto = fanAtivo
        ? expiraEmTexto(perfil?.planoExpiraEm ?? null, now)
        : null;

    const isPrimeiraEscolha = planoAtual === null;

    return (
        <>
            <PaymentResultBanner status={paymentStatus} />
            <OfferLayout
            eyebrow={isPrimeiraEscolha ? "Bem-vindo à Privello" : "Plano Fan"}
            title={
                isPrimeiraEscolha
                    ? "Como você quer participar?"
                    : fanAtivo
                        ? "Renovar ou estender seu Fan"
                        : "Vire Fan agora"
            }
            subtitle={
                fanAtivo
                    ? `${expiraTexto ?? "Fan ativo"}. Comprar de novo soma à janela atual.`
                    : "Comece grátis ou desbloqueie tudo pelo tempo que quiser."
            }
            footer="Trocar para o Grátis só após o Fan expirar. Comprar Fan novamente acumula o tempo."
        >
            {/* ─── Card Grátis ─────────────────────────────────── */}
            <OfferCard
                name="Grátis"
                description="Veja perfis e Stories. Boa pra explorar antes de virar Fan."
                price="R$ 0"
                priceSuffix="grátis para sempre"
                benefits={GRATIS_BENEFITS}
                animationDelayMs={120}
            >
                <PlanoForm
                    mode="selecionar"
                    value="GRATIS"
                    label={
                        planoAtual?.tipo === "GRATIS"
                            ? "Plano atual"
                            : "Continuar com Grátis"
                    }
                    variant={planoAtual?.tipo === "GRATIS" ? "ghost" : "secondary"}
                    disabled={planoAtual?.tipo === "GRATIS" || fanAtivo}
                />
            </OfferCard>

            {/* ─── 3 cards Fan (24h / 7d / 30d) ───────────────── */}
            {DURACOES.map((chave, idx) => {
                const duracao = PLANO_CLIENTE_DURACOES[chave];
                const recomendado = chave === "FAN_30D";
                return (
                    <OfferCard
                        key={chave}
                        name={duracao.label}
                        description={duracao.descricaoCurta}
                        price={formatarPreco(duracao.precoCents)}
                        priceSuffix={
                            chave === "FAN_24H"
                                ? "/24h"
                                : chave === "FAN_7D"
                                    ? "/7 dias"
                                    : "/30 dias"
                        }
                        benefits={FAN_BENEFITS}
                        recommended={recomendado}
                        badge={
                            recomendado ? (
                                <Badge
                                    tone="primaryGradient"
                                    icon={<DiamondIcon size={11} />}
                                    className="absolute right-5 top-5 px-3 py-1"
                                >
                                    Mais escolhido
                                </Badge>
                            ) : undefined
                        }
                        animationDelayMs={200 + idx * 80}
                    >
                        <PlanoForm
                            mode="comprar"
                            value={chave}
                            label={
                                fanAtivo
                                    ? `Estender +${duracao.label.replace("Fan ", "")}`
                                    : `Comprar ${duracao.label}`
                            }
                            variant={recomendado ? "primary" : "secondary"}
                        />
                    </OfferCard>
                );
            })}
        </OfferLayout>
        </>
    );
}
