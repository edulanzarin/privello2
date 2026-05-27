"use client";

import * as React from "react";

import {
    Badge,
    Button,
    Card,
    DiamondIcon,
    InfoList,
    InfoRow,
    LockIcon,
    MailIcon,
    PasswordChangeModal,
    SectionHeader,
    SparklesIcon,
    TrashIcon,
    useModal,
} from "@/components";

import type { PerfilClienteResumo } from "@/server/cliente-profile";

import { ExcluirContaModal } from "./ExcluirContaModal";

/**
 * Aba "Configurações" do painel do Cliente.
 *
 * Layout denso de duas seções com labels visualmente ocultos
 * (`hideLabel`) — o ícone tonal já comunica o tipo de cada campo:
 *
 * - "Conta": email (read-only com cadeado) + senha (edita via
 *   {@link PasswordChangeModal}).
 * - "Plano": uma única linha clicável que mostra o plano vigente em
 *   `Badge` e abre `/cliente/selecao-plano`. Quando ainda não há
 *   plano, mostra um CTA "Escolher plano" no lugar.
 *
 * O logout vive como `actions` do `ProfileHeader` na página, fixo no
 * topo. Gerenciamento de sessões ativas e exclusão de conta entram
 * aqui em rodadas futuras.
 */
export interface ConfiguracoesTabProps {
    perfil: PerfilClienteResumo;
}

export function ConfiguracoesTab({
    perfil,
}: ConfiguracoesTabProps): React.ReactElement {
    const isFan = perfil.planoVigente === "FAN";
    const semPlano = perfil.planoVigente === null;
    const senhaModal = useModal();
    const excluirModal = useModal();

    return (
        <div className="flex flex-col gap-5">
            <section className="flex flex-col gap-3">
                <SectionHeader title="Conta" />
                <InfoList>
                    <InfoRow
                        icon={<MailIcon size={14} />}
                        label="Email"
                        value={perfil.email}
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
                <SectionHeader title="Plano" />
                <InfoList>
                    {semPlano ? (
                        <InfoRow
                            icon={<SparklesIcon size={14} />}
                            label="Escolher plano"
                            hideLabel
                            value="Escolher plano"
                            editHref="/cliente/selecao-plano"
                        />
                    ) : (
                        <InfoRow
                            icon={
                                isFan ? (
                                    <DiamondIcon size={14} />
                                ) : (
                                    <SparklesIcon size={14} />
                                )
                            }
                            label="Plano vigente"
                            hideLabel
                            value={
                                <Badge tone={isFan ? "primary" : "neutral"}>
                                    {isFan ? "Fan" : "Grátis"}
                                </Badge>
                            }
                            // Fan é o plano máximo do Cliente — sem
                            // upgrade possível. Vira read-only para
                            // não dar a impressão de clicável.
                            editHref={
                                isFan ? undefined : "/cliente/selecao-plano"
                            }
                            locked={isFan}
                            lockedReason="Você já está no plano máximo."
                        />
                    )}
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
                                Apaga seu perfil, atividade e mídia. Não
                                pode ser desfeito.
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
