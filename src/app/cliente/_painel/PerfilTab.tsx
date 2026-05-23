"use client";

import * as React from "react";

import {
    AtIcon,
    InfoList,
    InfoRow,
    LinkButton,
    MailIcon,
    PencilIcon,
    SectionHeader,
    UserIcon,
    useModal,
} from "@/components";

import type { PerfilClienteResumo } from "@/server/cliente-profile";

import { EditarPerfilModal } from "./EditarPerfilModal";

/**
 * Aba "Perfil" do painel do Cliente.
 *
 * Exibe os dados de identidade em modo read-only com cadeado nos
 * campos imutáveis. Para editar, o usuário aciona o `LinkButton`
 * "Editar" no cabeçalho da seção, que abre o
 * {@link EditarPerfilModal} concentrando todos os campos em um único
 * formulário.
 *
 * Imutáveis: `@username` (vinculado a URLs/menções) e email
 * (mudança de email exigiria fluxo próprio de confirmação por
 * token, ainda não implementado).
 */
export interface PerfilClienteTabProps {
    perfil: PerfilClienteResumo;
}

export function PerfilTab({
    perfil,
}: PerfilClienteTabProps): React.ReactElement {
    const editar = useModal();

    return (
        <section className="flex flex-col gap-3">
            <SectionHeader
                title="Dados da conta"
                subtitle="Suas informações de identidade."
                trailing={
                    <LinkButton
                        onClick={editar.open}
                        icon={<PencilIcon size={12} />}
                        aria-label="Editar dados da conta"
                    >
                        Editar
                    </LinkButton>
                }
            />
            <InfoList>
                <InfoRow
                    icon={<UserIcon size={14} />}
                    label="Nome"
                    value={perfil.nome}
                    hideLabel
                />
                <InfoRow
                    icon={<AtIcon size={14} />}
                    label="Nome de usuário"
                    value={`@${perfil.identificador}`}
                    hideLabel
                    locked
                    lockedReason="O nome de usuário não pode ser alterado."
                />
                <InfoRow
                    icon={<MailIcon size={14} />}
                    label="Email"
                    value={perfil.email}
                    hideLabel
                    locked
                    lockedReason="O email não pode ser alterado."
                />
            </InfoList>

            <EditarPerfilModal
                open={editar.isOpen}
                onClose={editar.close}
                inicial={{ nome: perfil.nome }}
            />
        </section>
    );
}
