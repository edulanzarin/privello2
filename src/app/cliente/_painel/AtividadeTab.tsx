"use client";

import * as React from "react";

import {
    ActivityFeed,
    DiamondIcon,
    EmptyState,
    FilterChips,
    HeartIcon,
    PlayCircleIcon,
    SparklesIcon,
    StarIcon,
    UpgradeBanner,
    type FilterChipsOption,
} from "@/components";
import type { PlanoClienteTipo } from "@/domain/plano-cliente/definitions";

/**
 * Aba "Atividade" do painel do Cliente.
 *
 * Substituiu o trio anterior de cards gigantes (Avaliações / Curtidas
 * / Comentários) por um feed unificado denso, no estilo de apps
 * modernos:
 *
 * 1. Banner de upgrade compacto no topo (apenas para o Grátis).
 *    Agrupa em um único CTA o que antes eram dois cards "Virar Fan"
 *    espalhados pela aba.
 * 2. Linha de filtros em pílula (`FilterChips`) — Tudo, Avaliações,
 *    Curtidas, Comentários. Para o Grátis, Curtidas e Comentários
 *    aparecem com cadeado: clicar redireciona para
 *    `/cliente/selecao-plano`.
 * 3. {@link ActivityFeed} unificado: cada item é uma linha densa
 *    com ícone tonal, contexto (a quem se refere) e timestamp. O
 *    feed escala para qualquer quantidade — quando o Cliente curtir
 *    ou avaliar várias dezenas, o layout não desmorona.
 *
 * # Comportamento futuro (referência para quando construirmos)
 *
 * - Cada listagem aplicará filtro `WHERE acompanhante.status = 'ATIVA'
 *   AND acompanhante.planoVigente IS NOT NULL` (Caminho A: filtrar no
 *   read). Acompanhantes que desativaram a conta ou cancelaram o
 *   plano somem do histórico do Cliente automaticamente, sem
 *   precisar de soft-delete em massa.
 *
 * - Quando o Cliente é Grátis, **avaliações** que ele publicou ainda
 *   aparecem (ele pode revisar/editar as próprias). Curtidas e
 *   comentários ficam vazios por design (recursos exclusivos do
 *   Fan), e o filtro respectivo aparece com cadeado.
 *
 * - Quando o Cliente é Fan, todos os filtros funcionam normalmente.
 *
 * Por ora, todos os filtros levam ao `EmptyState` "ainda sem
 * atividade" — a estrutura está pronta para receber dados reais.
 */
export interface AtividadeTabProps {
    planoVigente: PlanoClienteTipo | null;
}

type FiltroAtividade = "tudo" | "avaliacoes" | "curtidas" | "comentarios";

export function AtividadeTab({
    planoVigente,
}: AtividadeTabProps): React.ReactElement {
    const isFan = planoVigente === "FAN";
    const [filtro, setFiltro] = React.useState<FiltroAtividade>("tudo");

    /**
     * Quando o Grátis tenta abrir uma aba bloqueada, redirecionamos
     * para a tela de planos em vez de tentar mudar o filtro. Em
     * produção isso pode virar um modal "Faça upgrade para curtir/
     * comentar"; o componente já entrega o evento, basta a página
     * decidir.
     */
    function handleFiltroChange(next: string): void {
        if (
            !isFan &&
            (next === "curtidas" || next === "comentarios")
        ) {
            window.location.href = "/cliente/selecao-plano";
            return;
        }
        setFiltro(next as FiltroAtividade);
    }

    const opcoes: ReadonlyArray<FilterChipsOption> = [
        {
            value: "tudo",
            label: "Tudo",
            icon: <SparklesIcon size={11} />,
        },
        {
            value: "avaliacoes",
            label: "Avaliações",
            icon: <StarIcon size={11} />,
        },
        {
            value: "curtidas",
            label: "Curtidas",
            icon: <HeartIcon size={11} />,
            locked: !isFan,
        },
        {
            value: "comentarios",
            label: "Comentários",
            icon: <PlayCircleIcon size={11} />,
            locked: !isFan,
        },
    ];

    const empty = empties[filtro];

    return (
        <div className="flex flex-col gap-4">
            {!isFan ? (
                <UpgradeBanner
                    icon={<DiamondIcon size={16} />}
                    title="Desbloqueie o Fan"
                    description="Curta fotos e Stories, comente e veja avaliações de outros Clientes."
                    ctaHref="/cliente/selecao-plano"
                    ctaLabel="Virar Fan"
                />
            ) : null}

            <FilterChips
                options={opcoes}
                value={filtro}
                onChange={handleFiltroChange}
                aria-label="Filtrar tipo de atividade"
                layout="fixed"
            />

            <ActivityFeed aria-label="Histórico de atividade">
                <EmptyState
                    size="sm"
                    icon={empty.icon}
                    title={empty.title}
                    description={empty.description}
                />
            </ActivityFeed>
        </div>
    );
}

/**
 * Mensagens de estado vazio para cada filtro. Centralizar aqui
 * facilita reusar o mesmo `EmptyState` quando o feed real chegar e
 * uma busca/filtro voltar zero resultados.
 */
const empties: Record<
    FiltroAtividade,
    { title: string; description: string; icon: React.ReactNode }
> = {
    tudo: {
        title: "Sem atividade por enquanto",
        description:
            "Quando você avaliar, curtir ou comentar, tudo aparece aqui.",
        icon: <SparklesIcon size={20} />,
    },
    avaliacoes: {
        title: "Você ainda não avaliou nenhuma Acompanhante",
        description: "Ao publicar avaliações, elas ficam disponíveis aqui.",
        icon: <StarIcon size={20} />,
    },
    curtidas: {
        title: "Sem curtidas por enquanto",
        description: "Suas curtidas em fotos e Stories aparecem nesta lista.",
        icon: <HeartIcon size={20} />,
    },
    comentarios: {
        title: "Sem comentários por enquanto",
        description: "Os comentários que você publicar em fotos vêm para cá.",
        icon: <PlayCircleIcon size={20} />,
    },
};
