"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { CameraIcon } from "../icons";

import { LinkButton } from "./LinkButton";
import { MediaUploadModal, type MediaUploadResult } from "./MediaUploadModal";
import { ProfileHeader, type ProfileHeaderProps } from "./ProfileHeader";

/**
 * Props do {@link ProfilePhotoEditor}.
 *
 * Wrapper client do {@link ProfileHeader} que adiciona o fluxo de
 * troca de Foto_de_Perfil: clicar no avatar abre um
 * {@link MediaUploadModal} configurado para aceitar apenas fotos e
 * sem campo de descrição.
 *
 * Por padrão envia para o endpoint `POST /api/conta/foto` (com o
 * campo `foto` no FormData), que é compartilhado por Cliente e
 * Acompanhante e descobre o tipo via sessão. Use `onUpload` para
 * sobreescrever o destino quando precisar de um endpoint customizado.
 *
 * Após o upload bem-sucedido, recarrega a página via
 * `router.refresh()` para que o Server Component pai busque o novo
 * `fotoUrl` e re-renderize o cabeçalho. Use `onUploaded` se preferir
 * controlar a atualização via outro mecanismo (ex.: SWR mutate).
 *
 * Mantém todas as props do {@link ProfileHeader} intactas, exceto
 * `onPhotoClick` (consumido internamente).
 *
 * Nenhuma prop carrega nomes de entidades de domínio (Property 29).
 */
export interface ProfilePhotoEditorProps
    extends Omit<ProfileHeaderProps, "onPhotoClick" | "extras"> {
    /**
     * Override do envio. Quando ausente, faz `POST /api/conta/foto`
     * com `foto` no FormData. Use para apontar para outro endpoint
     * ou para fluxos com pre-processing (cropping etc.).
     */
    onUpload?: (file: File) => Promise<void>;
    /**
     * Callback opcional disparado após o upload bem-sucedido. Use
     * para invalidar caches client-side ou disparar toasts.
     */
    onUploaded?: () => void;
    /**
     * Texto do botão. Padrão: `"Alterar foto"`. O label é truncado
     * em telas estreitas via `LinkButton.collapseToIcon`.
     */
    triggerLabel?: React.ReactNode;
}

/**
 * ProfilePhotoEditor — composto client de header + modal de troca
 * de foto.
 *
 * Visual: idêntico ao {@link ProfileHeader} (mantém o avatar grande,
 * nome, badge, actions). A diferença é que o avatar fica clicável
 * com overlay de câmera no hover. Ao clicar, abre um modal de
 * upload focado em foto.
 */
export function ProfilePhotoEditor({
    onUpload,
    onUploaded,
    triggerLabel = "Alterar foto",
    ...headerProps
}: ProfilePhotoEditorProps): React.ReactElement {
    const [open, setOpen] = React.useState(false);
    const [uploading, setUploading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const router = useRouter();

    async function defaultUpload(file: File): Promise<void> {
        const formData = new FormData();
        formData.append("foto", file);
        const res = await fetch("/api/conta/foto", {
            method: "POST",
            body: formData,
        });
        if (!res.ok) {
            const payload = (await res.json().catch(() => null)) as
                | { reason?: string }
                | null;
            const reason = payload?.reason ?? "DESCONHECIDO";
            throw new Error(`Falha ao trocar foto: ${reason}`);
        }
    }

    async function handleSubmit(result: MediaUploadResult): Promise<void> {
        setUploading(true);
        setError(null);
        try {
            if (onUpload !== undefined) {
                await onUpload(result.file);
            } else {
                await defaultUpload(result.file);
            }
            setOpen(false);
            if (onUploaded !== undefined) {
                onUploaded();
            } else {
                router.refresh();
            }
        } catch (e) {
            setError(
                e instanceof Error
                    ? e.message
                    : "Não foi possível trocar a foto.",
            );
        } finally {
            setUploading(false);
        }
    }

    function openModal(): void {
        setError(null);
        setOpen(true);
    }

    return (
        <>
            <ProfileHeader
                {...headerProps}
                extras={
                    <LinkButton
                        onClick={openModal}
                        icon={<CameraIcon size={12} />}
                        aria-label="Alterar foto de perfil"
                    >
                        {triggerLabel}
                    </LinkButton>
                }
            />
            <MediaUploadModal
                open={open}
                onClose={() => setOpen(false)}
                submitting={uploading}
                onSubmit={handleSubmit}
                accept="photo"
                showDescription={false}
                title="Trocar foto de perfil"
                subtitle={
                    error ?? "Escolha uma imagem que represente você."
                }
                submitLabel="Atualizar"
            />
        </>
    );
}
