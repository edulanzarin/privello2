"use client";

import * as React from "react";

import {
    InstallPromptBanner,
    Modal,
    useModal,
} from "@/components";

/**
 * Bootstrap do PWA.
 *
 * Componente client-only mountado uma vez no `RootLayout`. Faz duas
 * coisas:
 *
 * 1. Registra o service worker `/sw.js` (apenas em prod e quando o
 *    browser suporta). Em dev, deliberadamente NÃO registra — SW
 *    cacheando assets do `/_next/static/` em hot reload causa
 *    confusão.
 * 2. Renderiza o {@link InstallPromptBanner} + um {@link Modal} de
 *    instruções específicas pra iOS Safari.
 *
 * Mantemos isso fora do `layout.tsx` puro (que é server) pra não
 * arrastar `useModal` pra o root server component.
 */
export function PwaBootstrap(): React.ReactElement {
    const iosModal = useModal();

    React.useEffect(() => {
        if (typeof window === "undefined") return;
        if (!("serviceWorker" in navigator)) return;
        // Só registra em prod — evita interferir com hot reload.
        if (process.env.NODE_ENV !== "production") return;

        // Best-effort: erro de registro não bloqueia nada na UI.
        navigator.serviceWorker.register("/sw.js").catch(() => {
            // Silencioso. Em browsers que não habilitam SW (ex.:
            // private mode), o fetch fallback do browser cuida da
            // navegação normalmente.
        });
    }, []);

    return (
        <>
            <InstallPromptBanner
                title="Tenha o Privello na tela inicial"
                description="Acesso direto, sem barra do navegador."
                onShowInstructions={iosModal.open}
            />
            <Modal
                open={iosModal.isOpen}
                onClose={iosModal.close}
                title="Como instalar no iPhone"
                size="sm"
            >
                <div className="flex flex-col gap-4 text-sm text-text-primary">
                    <p>
                        Como o Safari não suporta instalação direta,
                        siga estes passos:
                    </p>
                    <ol className="ml-5 flex list-decimal flex-col gap-2 text-text-secondary">
                        <li>
                            Toque no botão{" "}
                            <strong className="text-text-primary">
                                Compartilhar
                            </strong>{" "}
                            (ícone de quadrado com seta para cima) na
                            barra inferior do Safari.
                        </li>
                        <li>
                            Role e toque em{" "}
                            <strong className="text-text-primary">
                                Adicionar à Tela de Início
                            </strong>
                            .
                        </li>
                        <li>
                            Confirme em{" "}
                            <strong className="text-text-primary">
                                Adicionar
                            </strong>
                            . O ícone do Privello aparece como qualquer
                            outro app.
                        </li>
                    </ol>
                    <p className="text-xs text-text-secondary">
                        Em iPad, o botão Compartilhar fica no canto
                        superior direito.
                    </p>
                </div>
            </Modal>
        </>
    );
}
