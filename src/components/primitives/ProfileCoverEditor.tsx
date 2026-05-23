"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { CameraIcon } from "../icons";

import { LinkButton } from "./LinkButton";
import { MediaUploadModal, type MediaUploadResult } from "./MediaUploadModal";
import { ProfileBanner } from "./ProfileBanner";

/**
 * Props do {@link ProfileCoverEditor}.
 *
 * Wrapper client do {@link ProfileBanner} que adiciona o fluxo de
 * troca de Capa_de_Perfil (banner horizontal). Renderiza o banner
 * com um botão "Alterar capa" no canto superior direito; clicar
 * abre um {@link MediaUploadModal} configurado para foto sem
 * descrição.
 *
 * Por padrão envia para `POST /api/conta/capa` (multipart com `foto`).
 * Use `onUpload` para sobreescrever o destino quando precisar de um
 * endpoint customizado.
 *
 * Tipicamente plugado direto na prop `banner` do {@link import("./PageSurface").PageSurface}:
 *
 * ```tsx
 * <PageSurface
 *   banner={<ProfileCoverEditor coverUrl={perfil.coverUrl} />}
 * >
 *   <ProfilePhotoEditor ... />
 *   ...
 * </PageSurface>
 * ```
 *
 * Nenhuma prop carrega nomes de entidades de domínio (Property 29).
 */
export interface ProfileCoverEditorProps {
    /** URL atual da capa. `null`/`undefined` cai no gradient fallback. */
    coverUrl?: string | null;
    /**
     * Override do envio. Quando ausente, faz `POST /api/conta/capa`
     * com `foto` no FormData.
     */
    onUpload?: (file: File) => Promise<void>;
    /**
     * Callback opcional disparado após o upload. Quando ausente, o
     * componente faz `router.refresh()` para que o Server Component
     * pai busque a `coverUrl` atualizada.
     */
    onUploaded?: () => void;
    /** Texto do botão. Padrão: `"Alterar capa"`. */
    triggerLabel?: React.ReactNode;
    /** Classes extras passadas ao banner. */
    className?: string;
}

/**
 * ProfileCoverEditor — banner com botão de alterar capa + modal de
 * upload integrado.
 */
export function ProfileCoverEditor({
    coverUrl,
    onUpload,
    onUploaded,
    triggerLabel = "Alterar capa",
    className,
}: ProfileCoverEditorProps): React.ReactElement {
    const [open, setOpen] = React.useState(false);
    const [uploading, setUploading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const router = useRouter();

    async function defaultUpload(file: File): Promise<void> {
        const formData = new FormData();
        formData.append("foto", file);
        const res = await fetch("/api/conta/capa", {
            method: "POST",
            body: formData,
        });
        if (!res.ok) {
            const payload = (await res.json().catch(() => null)) as
                | { reason?: string }
                | null;
            const reason = payload?.reason ?? "DESCONHECIDO";
            throw new Error(`Falha ao trocar capa: ${reason}`);
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
                    : "Não foi possível trocar a capa.",
            );
        } finally {
            setUploading(false);
        }
    }

    return (
        <>
            <ProfileBanner
                photoUrl={coverUrl}
                alt="Capa do perfil"
                className={className}
                overlay={
                    <LinkButton
                        onClick={() => {
                            setError(null);
                            setOpen(true);
                        }}
                        icon={<CameraIcon size={12} />}
                        aria-label="Alterar capa do perfil"
                        // Tom escurecido pra contrastar sobre a capa
                        // (que pode ser muito clara ou muito escura).
                        className="!border-white/40 !bg-black/45 !text-white !backdrop-blur-sm hover:!border-white/60 hover:!bg-black/65 hover:!text-white"
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
                title="Trocar capa do perfil"
                subtitle={
                    error ?? "Use uma imagem horizontal — proporção 4:1 ou 5:1."
                }
                submitLabel="Atualizar"
            />
        </>
    );
}
