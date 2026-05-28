"use client";

import * as React from "react";

import { FlagIcon } from "../icons";

import { IconButton } from "./IconButton";
import {
    ReportDialog,
    type ReportDialogTargetType,
} from "./ReportDialog";

/**
 * Tamanhos disponíveis para o {@link ReportButton}.
 */
export type ReportButtonSize = "sm" | "md";

/**
 * Props do {@link ReportButton}.
 *
 * Botão "denunciar" que abre o {@link ReportDialog} ao clicar.
 * Encapsula a UX completa: o caller só passa `targetType` +
 * `targetId` e plugar o componente onde for preciso.
 *
 * Renderizado como ícone-botão circular discreto. Em qualquer
 * surface escura (overlay de mídia, story), passe
 * `tone="ghost"` para ficar translúcido.
 */
export interface ReportButtonProps {
    targetType: ReportDialogTargetType;
    targetId: string;
    /** Tamanho. Padrão: `"sm"`. */
    size?: ReportButtonSize;
    /**
     * Tom visual. `"ghost"` é translúcido (overlay sobre mídia).
     * `"neutral"` é o padrão sólido sobre fundo claro.
     */
    tone?: "ghost" | "neutral";
    /** Texto da tooltip. Padrão: `"Denunciar"`. */
    title?: string;
    /** Classes adicionais aplicadas ao botão. */
    className?: string;
    /** Callback opcional acionado ao confirmar denúncia. */
    onSuccess?: () => void;
}

/**
 * ReportButton — botão "denunciar" + dialog encapsulado.
 *
 * Auto-contido: gerencia o estado `open` do diálogo internamente.
 * Caller pode plugar e esquecer.
 */
export function ReportButton({
    targetType,
    targetId,
    size = "sm",
    tone = "neutral",
    title = "Denunciar",
    className,
    onSuccess,
}: ReportButtonProps): React.ReactElement {
    const [open, setOpen] = React.useState(false);

    return (
        <>
            <IconButton
                size={size}
                tone={tone}
                onClick={() => setOpen(true)}
                aria-label={title}
                className={className}
                icon={<FlagIcon size={size === "sm" ? 14 : 16} />}
            />

            <ReportDialog
                open={open}
                onClose={() => setOpen(false)}
                targetType={targetType}
                targetId={targetId}
                onSuccess={onSuccess}
            />
        </>
    );
}
