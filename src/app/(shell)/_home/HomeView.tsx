"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import {
    Button,
    CalendarIcon,
    ChatIcon,
    ChevronRightIcon,
    CityCombobox,
    EyeIcon,
    FeatureCard,
    FlameIcon,
    HeartIcon,
    LockIcon,
    PlayCircleIcon,
    SectionHeader,
    SparklesIcon,
    StarIcon,
    StatStrip,
    UsersIcon,
    type CityComboboxValue,
} from "@/components";

/**
 * Props do {@link HomeView}.
 *
 * Visualização de "landing" da Privello. A home **não** lista perfis
 * — apresenta a marca, atalhos para descoberta e CTAs de cadastro.
 * Toda navegação leva pra `/acompanhantes` (busca) ou pra páginas
 * de cadastro/login.
 */
export interface HomeViewProps {
    /** `userType` da sessão atual ou `null` (anônimo). */
    viewerType: "CLIENTE" | "ACOMPANHANTE" | null;
}

/**
 * HomeView — landing pública da Privello.
 *
 * Estrutura mobile-first em seis blocos:
 *
 * 1. **Hero**: headline + sub + barra de busca por cidade + CTAs
 *    pra cadastro (apenas para visitantes anônimos).
 * 2. **StatStrip**: métricas tipográficas de orgulho.
 * 3. **Atalhos rápidos**: 4 `FeatureCard` em grid pra rotas
 *    principais (Acompanhantes, Reels, Avaliações, Conta).
 * 4. **Por que Privello**: 4 `FeatureCard` tile com selos de
 *    confiança (privacidade, pagamento seguro, fotos verificadas,
 *    avaliações reais).
 * 5. **CTA final**: bloco de destaque pra "Crie sua conta de graça".
 * 6. **Rodapé curto** com responsabilidade legal.
 */
export function HomeView({
    viewerType,
}: HomeViewProps): React.ReactElement {
    const router = useRouter();
    const [cityValue, setCityValue] = React.useState<CityComboboxValue>({
        query: "",
        name: "",
        uf: "",
    });

    function handleSubmit(value: CityComboboxValue): void {
        const params = new URLSearchParams();
        if (value.name && value.uf) {
            params.set("cidade", value.name);
            params.set("uf", value.uf);
        } else if (value.query.trim().length > 0) {
            params.set("q", value.query.trim());
        }
        const qs = params.toString();
        router.push(`/acompanhantes${qs ? `?${qs}` : ""}`);
    }

    const isAnonimo = viewerType === null;

    return (
        <div className="flex flex-col gap-12">
            {/* 1. Hero */}
            <section className="flex flex-col gap-6 sm:gap-8">
                <div className="flex flex-col gap-3">
                    <span className="inline-flex w-max items-center gap-1.5 rounded-full bg-primary-50 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-wider text-primary-700">
                        <FlameIcon size={11} />
                        Privello 2026
                    </span>
                    <h1 className="text-3xl font-semibold tracking-tight text-text-primary sm:text-5xl sm:leading-[1.05]">
                        Encontros com{" "}
                        <span className="text-primary-700">respeito,</span>{" "}
                        privacidade e atitude.
                    </h1>
                    <p className="max-w-2xl text-base text-text-secondary sm:text-lg">
                        A plataforma que coloca acompanhantes no centro: perfil
                        completo, agenda transparente e contato direto. Você
                        decide com quem, quando e como.
                    </p>
                </div>

                <div className="flex flex-col gap-3 sm:max-w-2xl">
                    <CityCombobox
                        value={cityValue}
                        onChange={setCityValue}
                        onSubmit={handleSubmit}
                        placeholder="Em qual cidade você está?"
                    />
                    <p className="text-xs text-text-secondary">
                        Digite a cidade e tecle enter pra ver quem está perto.
                    </p>
                </div>

                {isAnonimo ? (
                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                        <Button
                            href="/cadastro/cliente"
                            variant="primary"
                            size="md"
                        >
                            Criar conta grátis
                        </Button>
                        <Button
                            href="/cadastro/acompanhante"
                            variant="ghost"
                            size="md"
                        >
                            Quero anunciar como acompanhante
                        </Button>
                    </div>
                ) : null}
            </section>

            {/* 2. StatStrip */}
            <section>
                <StatStrip
                    items={[
                        {
                            icon: <UsersIcon size={14} />,
                            value: "+10mi",
                            label: "visitas mensais",
                        },
                        {
                            icon: <SparklesIcon size={14} />,
                            value: "+50k",
                            label: "perfis ativos",
                        },
                        {
                            icon: <StarIcon size={14} />,
                            value: "+200k",
                            label: "avaliações reais",
                        },
                        {
                            icon: <PlayCircleIcon size={14} />,
                            value: "+1M",
                            label: "vídeos publicados",
                        },
                    ]}
                />
            </section>

            {/* 3. Atalhos */}
            <section className="flex flex-col gap-4">
                <SectionHeader
                    icon={<SparklesIcon size={16} />}
                    title="Atalhos rápidos"
                    subtitle="O que você quer fazer agora?"
                />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <FeatureCard
                        href="/acompanhantes"
                        tone="primary"
                        icon={<UsersIcon size={18} />}
                        title="Ver acompanhantes"
                        description="Filtre por cidade, idade, atendimento e mais."
                        trailing={<ChevronRightIcon size={16} />}
                    />
                    <FeatureCard
                        href="/reels"
                        icon={<PlayCircleIcon size={18} />}
                        title="Reels"
                        description="Vídeos curtos pra descobrir novos perfis."
                        trailing={<ChevronRightIcon size={16} />}
                    />
                    <FeatureCard
                        href="/acompanhantes?ordenar=avaliacoes"
                        icon={<ChatIcon size={18} />}
                        title="Ler avaliações"
                        description="Quem já contratou, quem foi bem atendido."
                        trailing={<ChevronRightIcon size={16} />}
                    />
                    <FeatureCard
                        href={
                            viewerType === "CLIENTE"
                                ? "/cliente"
                                : viewerType === "ACOMPANHANTE"
                                    ? "/acompanhante"
                                    : "/login"
                        }
                        icon={<HeartIcon size={18} />}
                        title={
                            viewerType === null
                                ? "Entrar na minha conta"
                                : "Minha conta"
                        }
                        description={
                            viewerType === null
                                ? "Já tem perfil? Acesse pra continuar."
                                : "Acesse seu painel privado."
                        }
                        trailing={<ChevronRightIcon size={16} />}
                    />
                </div>
            </section>

            {/* 4. Por que Privello */}
            <section className="flex flex-col gap-4">
                <SectionHeader
                    icon={<StarIcon size={16} />}
                    title="Por que Privello"
                    subtitle="Pensada pra acompanhantes e clientes que querem mais"
                />
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <FeatureCard
                        shape="tile"
                        icon={<LockIcon size={20} />}
                        title="Privacidade real"
                        description="Telefone só vai pro WhatsApp quando você decidir."
                    />
                    <FeatureCard
                        shape="tile"
                        icon={<EyeIcon size={20} />}
                        title="Perfis verificados"
                        description="Foto, áudio e atendimento conferidos pela equipe."
                    />
                    <FeatureCard
                        shape="tile"
                        icon={<CalendarIcon size={20} />}
                        title="Agenda transparente"
                        description="Dias, horários e formas de pagamento em destaque."
                    />
                    <FeatureCard
                        shape="tile"
                        icon={<ChatIcon size={20} />}
                        title="Avaliações reais"
                        description="Só clientes que pagaram podem avaliar."
                    />
                </div>
            </section>

            {/* 5. CTA final — só pra anônimos */}
            {isAnonimo ? (
                <section className="rounded-3xl border border-primary-100 bg-gradient-to-br from-primary-50 to-secondary-50 p-6 sm:p-10">
                    <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex flex-col gap-2">
                            <h2 className="text-xl font-semibold tracking-tight text-text-primary sm:text-2xl">
                                Crie seu perfil de graça e comece hoje.
                            </h2>
                            <p className="max-w-xl text-sm text-text-secondary">
                                Cadastro em menos de 1 minuto. Para
                                acompanhantes que querem visibilidade séria e
                                clientes que valorizam discrição.
                            </p>
                        </div>
                        <div className="flex flex-col gap-2 sm:flex-row">
                            <Button
                                href="/cadastro/cliente"
                                variant="primary"
                                size="md"
                            >
                                Sou cliente
                            </Button>
                            <Button
                                href="/cadastro/acompanhante"
                                variant="ghost"
                                size="md"
                            >
                                Sou acompanhante
                            </Button>
                        </div>
                    </div>
                </section>
            ) : null}

            {/* 6. Rodapé curto */}
            <footer className="border-t border-border pt-6 text-center text-xs text-text-secondary sm:text-left">
                <p>
                    Privello é uma plataforma para maiores de 18 anos. Não
                    intermediamos contratações; cada acompanhante negocia
                    diretamente com o cliente. Conteúdos publicados são de
                    responsabilidade dos respectivos titulares.
                </p>
            </footer>
        </div>
    );
}
