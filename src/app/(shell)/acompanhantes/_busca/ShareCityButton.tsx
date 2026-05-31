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
 * Botão "Compartilhar cidade" da busca (V6).
 *
 * Estende o padrão do `ShareButton` do perfil (T11), mas pro nível
 * da cidade: gera/baixa o card-imagem
 * `/api/acompanhantes/share-city.png?cidade=...&uf=...` e abre o
 * share nativo (Story/Status) com imagem + link da busca. Sem
 * suporte nativo, cai num Modal com preview + "Copiar link".
 *
 * Tudo client-side; o card é cacheado pelo browser via ETag.
 */
export interface ShareCityButtonProps {
    cidadeNome: string;
    estadoSigla: string;
    /** Total exibido — usado só no texto do compartilhamento. */
    total: number;
}

export function ShareCityButton({
    cidadeNome,
    estadoSigla,
    total,
}: ShareCityButtonProps): React.ReactElement {
    const modal = useModal();
    const [sharing, setSharing] = React.useState(false);
    const [copied, setCopied] = React.useState(false);

    const cardUrl = `/api/acompanhantes/share-city.png?cidade=${encodeURIComponent(
        cidadeNome,
    )}&uf=${encodeURIComponent(estadoSigla)}`;

    const shareText =
        total === 1
            ? `1 acompanhante em ${cidadeNome}, ${estadoSigla} · Privello`
            : `${total.toLocaleString("pt-BR")} acompanhantes em ${cidadeNome}, ${estadoSigla} · Privello`;

    function buscaUrl(): string {
        if (typeof window === "undefined") return "";
        const params = new URLSearchParams({
            cidade: cidadeNome,
            uf: estadoSigla,
        });
        return `${window.location.origin}/acompanhantes?${params.toString()}`;
    }

    async function tentarShareNativo(): Promise<boolean> {
        const nav = typeof navigator !== "undefined" ? navigator : undefined;
        if (!nav || typeof nav.share !== "function") return false;

        try {
            const res = await fetch(cardUrl);
            if (!res.ok) {
                if (nav.canShare === undefined) {
                    await nav.share({
                        title: "Privello",
                        text: shareText,
                        url: buscaUrl(),
                    });
                    return true;
                }
                return false;
            }
            const blob = await res.blob();
            const file = new File(
                [blob],
                `${cidadeNome}-${estadoSigla}.png`,
                { type: "image/png" },
            );

            if (
                typeof nav.canShare === "function" &&
                !nav.canShare({ files: [file] })
            ) {
                await nav.share({
                    title: "Privello",
                    text: shareText,
                    url: buscaUrl(),
                });
                return true;
            }

            await nav.share({
                files: [file],
                title: "Privello",
                text: shareText,
                url: buscaUrl(),
            });
            return true;
        } catch (err) {
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
            if (!ok) modal.open();
        } finally {
            setSharing(false);
        }
    }

    async function copiarLink(): Promise<void> {
        try {
            await navigator.clipboard.writeText(buscaUrl());
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2000);
        } catch {
            // clipboard bloqueado — usuário copia manual.
        }
    }

    return (
        <>
            <button
                type="button"
                onClick={() => void handleShare()}
                disabled={sharing}
                aria-label="Compartilhar cidade"
                className="inline-flex flex-none items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ec7b5b]/40 disabled:opacity-60"
            >
                <ShareIcon size={14} />
                Compartilhar
            </button>

            <Modal
                open={modal.isOpen}
                onClose={modal.close}
                title="Compartilhar cidade"
                size="sm"
            >
                <div className="flex flex-col gap-4 p-5">
                    <p className="text-sm text-text-secondary">
                        Salve a imagem abaixo (toque e segure) pra postar
                        no Stories ou Status, ou copie o link da busca.
                    </p>
                    <div className="mx-auto overflow-hidden rounded-2xl ring-1 ring-border">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={cardUrl}
                            alt={`Card de ${cidadeNome}, ${estadoSigla}`}
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
