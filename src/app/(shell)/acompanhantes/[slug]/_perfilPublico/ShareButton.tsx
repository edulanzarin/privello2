"use client";

import * as React from "react";

import {
    Button,
    CheckIcon,
    InlineAlert,
    LinkIcon,
    Modal,
    ShareIcon,
    useModal,
} from "@/components";

/**
 * Botão "Compartilhar" do perfil público (T11).
 *
 * Comportamento:
 *
 *  1. **Share nativo** (`navigator.share` com suporte a arquivos):
 *     baixa o card-imagem PNG gerado server-side
 *     (`/api/acompanhantes/[slug]/share-card.png`) e abre a folha de
 *     compartilhamento do sistema com imagem + URL + texto. Ideal
 *     pra postar direto no Instagram Story / WhatsApp Status.
 *  2. **Fallback** (browsers sem `share` ou sem suporte a arquivos):
 *     abre um Modal mostrando o preview do card + botão "Copiar
 *     link". Usuário salva a imagem manualmente (long-press / botão
 *     direito) e cola o link onde quiser.
 *
 * Tudo client-side — o card é cacheado pelo browser (ETag no
 * endpoint), então abrir o modal de novo não regera.
 */
export interface ShareButtonProps {
    slug: string;
    nome: string;
    cidadeNome: string;
    estadoSigla: string;
}

export function ShareButton({
    slug,
    nome,
    cidadeNome,
    estadoSigla,
}: ShareButtonProps): React.ReactElement {
    const modal = useModal();
    const [sharing, setSharing] = React.useState(false);
    const [copied, setCopied] = React.useState(false);

    const cardUrl = `/api/acompanhantes/${encodeURIComponent(slug)}/share-card.png`;
    const shareText = `${nome} em ${cidadeNome}, ${estadoSigla} · Privello`;

    function profileUrl(): string {
        if (typeof window === "undefined") return "";
        return `${window.location.origin}/acompanhantes/${slug}`;
    }

    /**
     * Tenta o share nativo com arquivo. Retorna `true` quando
     * conseguiu compartilhar (ou o usuário cancelou de propósito),
     * `false` quando o browser não suporta e devemos cair no modal.
     */
    async function tentarShareNativo(): Promise<boolean> {
        const nav = typeof navigator !== "undefined" ? navigator : undefined;
        if (!nav || typeof nav.share !== "function") return false;

        try {
            const res = await fetch(cardUrl);
            if (!res.ok) {
                // Sem imagem: tenta share só com URL/texto (ainda é
                // share nativo, melhor que abrir modal).
                if (nav.canShare === undefined) {
                    await nav.share({
                        title: "Privello",
                        text: shareText,
                        url: profileUrl(),
                    });
                    return true;
                }
                return false;
            }
            const blob = await res.blob();
            const file = new File([blob], `${slug}.png`, {
                type: "image/png",
            });

            // Confirma que o browser sabe compartilhar este arquivo.
            if (
                typeof nav.canShare === "function" &&
                !nav.canShare({ files: [file] })
            ) {
                // Não dá pra mandar arquivo — tenta só url/texto.
                await nav.share({
                    title: "Privello",
                    text: shareText,
                    url: profileUrl(),
                });
                return true;
            }

            await nav.share({
                files: [file],
                title: "Privello",
                text: shareText,
                url: profileUrl(),
            });
            return true;
        } catch (err) {
            // AbortError = usuário fechou a folha. Não é falha real,
            // não cai no modal.
            if (err instanceof DOMException && err.name === "AbortError") {
                return true;
            }
            return false;
        }
    }

    async function handleShare(): Promise<void> {
        if (sharing) return;
        setSharing(true);
        try {
            const ok = await tentarShareNativo();
            if (!ok) {
                modal.open();
            }
        } finally {
            setSharing(false);
        }
    }

    async function copiarLink(): Promise<void> {
        try {
            await navigator.clipboard.writeText(profileUrl());
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2000);
        } catch {
            // Clipboard bloqueado — usuário copia manual da barra.
        }
    }

    return (
        <>
            <Button
                type="button"
                variant="secondary"
                size="lg"
                className="w-full"
                onClick={() => void handleShare()}
                loading={sharing}
                disabled={sharing}
            >
                <ShareIcon size={16} />
                Compartilhar
            </Button>

            <Modal
                open={modal.isOpen}
                onClose={modal.close}
                title="Compartilhar perfil"
                size="sm"
            >
                <div className="flex flex-col gap-4 p-5">
                    <p className="text-sm text-text-secondary">
                        Salve a imagem abaixo (toque e segure) pra postar
                        no Stories ou Status, ou copie o link.
                    </p>
                    <div className="mx-auto overflow-hidden rounded-2xl ring-1 ring-border">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={cardUrl}
                            alt={`Card de ${nome}`}
                            className="mx-auto max-h-[46vh] w-auto"
                        />
                    </div>
                    <Button
                        type="button"
                        variant="primary"
                        size="md"
                        onClick={() => void copiarLink()}
                    >
                        {copied ? (
                            <>
                                <CheckIcon size={16} />
                                Link copiado
                            </>
                        ) : (
                            <>
                                <LinkIcon size={16} />
                                Copiar link
                            </>
                        )}
                    </Button>
                    {copied ? (
                        <InlineAlert tone="success">
                            Link copiado pra área de transferência.
                        </InlineAlert>
                    ) : null}
                </div>
            </Modal>
        </>
    );
}
