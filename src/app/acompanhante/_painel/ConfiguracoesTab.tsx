"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import {
    Badge,
    Button,
    Card,
    FlameIcon,
    HeartIcon,
    InfoList,
    InfoRow,
    InlineAlert,
    LockIcon,
    MailIcon,
    PasswordChangeModal,
    SectionHeader,
    SparklesIcon,
    Switch,
    TrashIcon,
    useModal,
} from "@/components";

import type { PlanoDefinition } from "@/domain/plano/definitions";

import { ExcluirContaModal } from "./ExcluirContaModal";

/**
 * Aba "Configurações" do painel da Acompanhante.
 *
 * Layout denso de quatro seções:
 *
 * - "Conta": email (read-only com cadeado) + senha (edita via
 *   {@link PasswordChangeModal}).
 * - "Perfil público": Switch que liga/desliga a visibilidade do
 *   perfil. Quando desligado, o perfil some das buscas e o link
 *   direto cai numa tela "perfil oculto ou desativado".
 * - "Boost": atalho para `/acompanhante/boost`. Quando há boost
 *   ativo, a linha mostra o tempo restante da janela; caso
 *   contrário, exibe "Em chamas" como CTA.
 * - "Plano": uma única linha clicável que mostra o plano vigente em
 *   `Badge` e abre `/selecao-plano` ao clicar.
 *
 * O logout vive como `actions` do {@link import("@/components").ProfileHeader}
 * na página, fixo no topo.
 */
export interface ConfiguracoesTabProps {
    email: string;
    planoTipo: PlanoDefinition["tipo"];
    perfilVisivel: boolean;
    /**
     * Data/hora em que a janela atual de boost expira, ou `null`
     * quando não há boost ativo. A UI calcula no cliente o tempo
     * restante a partir dessa data.
     */
    boostUntil: Date | null;
}

export function ConfiguracoesTab({
    email,
    planoTipo,
    perfilVisivel,
    boostUntil,
}: ConfiguracoesTabProps): React.ReactElement {
    const router = useRouter();
    const isPremium = planoTipo === "PREMIUM";
    const senhaModal = useModal();
    const excluirModal = useModal();

    // Estado otimista do toggle: troca imediato no UI, reverte se o
    // servidor recusar. Evita "click → spinner → confirma" em uma
    // ação binária que precisa parecer instantânea.
    const [visivel, setVisivel] = React.useState(perfilVisivel);
    const [pending, setPending] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
        setVisivel(perfilVisivel);
    }, [perfilVisivel]);

    async function toggleVisibilidade(next: boolean): Promise<void> {
        if (pending) return;
        const previous = visivel;
        setVisivel(next);
        setPending(true);
        setError(null);
        try {
            const res = await fetch("/api/acompanhante/visibilidade", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ visivel: next }),
            });
            if (!res.ok) {
                setVisivel(previous);
                setError(
                    "Não foi possível atualizar agora. Tente novamente.",
                );
                return;
            }
            // Refresh para o painel pegar o estado atualizado da
            // próxima vez que o usuário recarregar.
            router.refresh();
        } catch {
            setVisivel(previous);
            setError("Falha de rede. Tente novamente.");
        } finally {
            setPending(false);
        }
    }

    return (
        <div className="flex flex-col gap-5">
            <section className="flex flex-col gap-3">
                <SectionHeader title="Conta" />
                <InfoList>
                    <InfoRow
                        icon={<MailIcon size={14} />}
                        label="Email"
                        value={email}
                        hideLabel
                        locked
                        lockedReason="O email não pode ser alterado."
                    />
                    <InfoRow
                        icon={<LockIcon size={14} />}
                        label="Senha"
                        value="••••••••"
                        hideLabel
                        onEdit={senhaModal.open}
                    />
                </InfoList>
            </section>

            <section className="flex flex-col gap-3">
                <SectionHeader
                    title="Perfil público"
                    subtitle={
                        visivel
                            ? "Seu perfil aparece nas buscas e pode ser acessado pelo link."
                            : "Seu perfil está oculto. Não aparece nas buscas e o link mostra que está indisponível."
                    }
                />
                <Switch
                    label={visivel ? "Perfil visível" : "Perfil oculto"}
                    description={
                        visivel
                            ? "Clientes podem encontrar você."
                            : "Ninguém vê seu perfil até você ligar de novo."
                    }
                    checked={visivel}
                    onChange={(next) => void toggleVisibilidade(next)}
                    disabled={pending}
                />
                {error !== null ? (
                    <InlineAlert tone="danger">{error}</InlineAlert>
                ) : null}
            </section>

            <section className="flex flex-col gap-3">
                <SectionHeader title="Boost" />
                <InfoList>
                    <InfoRow
                        icon={<FlameIcon size={14} />}
                        label="Boost"
                        hideLabel
                        value={
                            boostUntil !== null &&
                                boostUntil.getTime() > Date.now() ? (
                                <span className="inline-flex items-center gap-2">
                                    <Badge tone="primary">Em chamas</Badge>
                                    <span className="text-xs text-text-secondary">
                                        até {formatHora(boostUntil)}
                                    </span>
                                </span>
                            ) : (
                                <span className="text-sm text-text-primary">
                                    Em chamas por 24h
                                </span>
                            )
                        }
                        editHref="/acompanhante/boost"
                    />
                </InfoList>
            </section>

            <section className="flex flex-col gap-3">
                <SectionHeader title="Plano" />
                <InfoList>
                    <InfoRow
                        icon={
                            isPremium ? (
                                <HeartIcon size={14} />
                            ) : (
                                <SparklesIcon size={14} />
                            )
                        }
                        label="Plano vigente"
                        hideLabel
                        value={
                            <Badge tone={isPremium ? "primary" : "neutral"}>
                                {isPremium ? "Premium" : "Básico"}
                            </Badge>
                        }
                        // Premium é o plano máximo — não há upgrade
                        // possível e downgrade ativo é proibido. A
                        // linha vira read-only para evitar o clique
                        // que cairia no redirect do layout.
                        editHref={
                            isPremium
                                ? undefined
                                : "/acompanhante/selecao-plano"
                        }
                        locked={isPremium}
                        lockedReason="Você já está no plano máximo."
                    />
                </InfoList>
            </section>

            <section className="flex flex-col gap-3">
                <SectionHeader
                    title="Zona de risco"
                    subtitle="Ações permanentes. Sem volta."
                />
                <Card>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex flex-col gap-0.5">
                            <span className="text-sm font-medium text-text-primary">
                                Excluir minha conta
                            </span>
                            <span className="text-xs text-text-secondary">
                                Apaga seu perfil, mídias, áudios, stories,
                                avaliações e perguntas. Não pode ser
                                desfeito.
                            </span>
                        </div>
                        <Button
                            type="button"
                            variant="danger"
                            size="sm"
                            onClick={excluirModal.open}
                        >
                            <TrashIcon size={14} />
                            Excluir conta
                        </Button>
                    </div>
                </Card>
            </section>

            <PasswordChangeModal
                open={senhaModal.isOpen}
                onClose={senhaModal.close}
            />
            <ExcluirContaModal
                open={excluirModal.isOpen}
                onClose={excluirModal.close}
            />
        </div>
    );
}


/**
 * Formata uma data como `HH:mm` no fuso local. Usado pra mostrar
 * "boost ativo até HH:mm" quando a janela termina no mesmo dia.
 * Quando termina em outro dia, mostra "DD/MM HH:mm".
 */
function formatHora(date: Date): string {
    const now = new Date();
    const sameDay =
        date.getDate() === now.getDate() &&
        date.getMonth() === now.getMonth() &&
        date.getFullYear() === now.getFullYear();
    const hh = date.getHours().toString().padStart(2, "0");
    const mm = date.getMinutes().toString().padStart(2, "0");
    if (sameDay) return `${hh}:${mm}`;
    const dd = date.getDate().toString().padStart(2, "0");
    const mo = (date.getMonth() + 1).toString().padStart(2, "0");
    return `${dd}/${mo} ${hh}:${mm}`;
}
