"use client";

import * as React from "react";

import {
    ChatIcon,
    DiamondIcon,
    HeartIcon,
    OnboardingTour,
    StarIcon,
} from "@/components";

/**
 * FanTour — banner de boas-vindas pro Cliente no plano Grátis (V5).
 *
 * Explica, no primeiro acesso ao painel, o que o plano Fan
 * desbloqueia, com CTA pra tela de seleção de plano. Dismissível e
 * persistido em `localStorage` (não reaparece depois de fechar).
 *
 * Só deve ser renderizado pra Cliente Grátis — a página decide via
 * `planoVigente`. Quem virou Fan não vê.
 *
 * O domínio (o que é "Fan", o que desbloqueia) mora aqui; o
 * primitivo {@link OnboardingTour} é genérico e sem domain leak.
 */
export function FanTour(): React.ReactElement {
    return (
        <OnboardingTour
            storageKey="privello:fan-tour-visto"
            icon={<DiamondIcon size={20} />}
            title="Aproveite mais com o Fan"
            description="Você está no plano Grátis. Vire Fan pra liberar a interação completa com os perfis."
            items={[
                {
                    icon: <HeartIcon size={14} />,
                    text: "Curtir fotos e Stories das Acompanhantes",
                },
                {
                    icon: <ChatIcon size={14} />,
                    text: "Comentar e fazer perguntas nos perfis",
                },
                {
                    icon: <StarIcon size={14} />,
                    text: "Ler e publicar avaliações",
                },
            ]}
            ctaHref="/cliente/selecao-plano"
            ctaLabel="Conhecer o Fan"
        />
    );
}
