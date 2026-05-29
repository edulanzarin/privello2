"use client";

import * as React from "react";

import { Button } from "./Button";
import { InlineAlert } from "./InlineAlert";
import { Modal } from "./Modal";

/**
 * Tipos de alvo que o {@link ReportDialog} sabe denunciar.
 *
 * Mantemos como string-union puro (sem nomes de domínio) e o
 * caller traduz pra string compatível com a API.
 */
export type ReportDialogTargetType = "USER" | "MEDIA" | "COMMENT" | "REVIEW";

/**
 * Lista canônica de motivos. Espelha o enum `ReportMotivo` do banco
 * mas mantém o componente desacoplado do ORM. Cada entry traz o
 * label legível em pt-BR.
 */
export type ReportDialogMotivo =
    | "CONTEUDO_FALSO"
    | "MENOR_DE_IDADE"
    | "ASSEDIO"
    | "GOLPE"
    | "SPAM"
    | "OUTRO";

/**
 * Props do {@link ReportDialog}.
 *
 * Modal de denúncia. Mostra os motivos como chips selecionáveis,
 * campo de descrição opcional (até 500 chars na UI, banco aceita
 * 2000), botões cancelar/enviar. Após submit bem-sucedido, o
 * componente fecha sozinho e dispara `onSuccess`.
 *
 * Toda a comunicação com a API fica encapsulada aqui — caller só
 * passa `targetType` + `targetId` e reage ao sucesso/erro via
 * callbacks.
 */
export interface ReportDialogProps {
    open: boolean;
    onClose: () => void;
    /** Tipo do alvo da denúncia. */
    targetType: ReportDialogTargetType;
    /** Id do alvo. */
    targetId: string;
    /** Callback chamado após denúncia confirmada com sucesso. */
    onSuccess?: () => void;
    /**
     * Endpoint customizado. Padrão: `"/api/reports"`. Útil pra
     * testes/storybook.
     */
    endpoint?: string;
}

interface MotivoOption {
    valor: ReportDialogMotivo;
    label: string;
    descricao: string;
}

const OPCOES_MOTIVO: ReadonlyArray<MotivoOption> = [
    {
        valor: "CONTEUDO_FALSO",
        label: "Conteúdo falso",
        descricao: "Fotos/dados que não correspondem à pessoa.",
    },
    {
        valor: "MENOR_DE_IDADE",
        label: "Menor de idade",
        descricao: "Suspeita de exploração ou pessoa menor de 18.",
    },
    {
        valor: "ASSEDIO",
        label: "Assédio",
        descricao: "Mensagens ofensivas, ameaças ou perseguição.",
    },
    {
        valor: "GOLPE",
        label: "Golpe ou fraude",
        descricao: "Tentativa de extorquir ou enganar usuários.",
    },
    {
        valor: "SPAM",
        label: "Spam",
        descricao: "Conteúdo repetitivo, propaganda fora de contexto.",
    },
    {
        valor: "OUTRO",
        label: "Outro",
        descricao: "Descreva o motivo no campo abaixo.",
    },
];

/**
 * ReportDialog — modal pra reportar um alvo.
 *
 * Estado interno: motivo selecionado, descrição, status de envio.
 * Reseta tudo quando `open` vira `true` pra não preservar dados
 * da última denúncia.
 */
export function ReportDialog({
    open,
    onClose,
    targetType,
    targetId,
    onSuccess,
    endpoint = "/api/reports",
}: ReportDialogProps): React.ReactElement {
    const [motivo, setMotivo] = React.useState<ReportDialogMotivo | null>(null);
    const [descricao, setDescricao] = React.useState("");
    const [enviando, setEnviando] = React.useState(false);
    const [erro, setErro] = React.useState<string | null>(null);
    const [sucesso, setSucesso] = React.useState(false);

    // Reset ao abrir.
    React.useEffect(() => {
        if (open) {
            setMotivo(null);
            setDescricao("");
            setEnviando(false);
            setErro(null);
            setSucesso(false);
        }
    }, [open]);

    const handleSubmit = async (): Promise<void> => {
        if (!motivo || enviando) return;
        setEnviando(true);
        setErro(null);
        try {
            const response = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    targetType,
                    targetId,
                    motivo,
                    descricao: descricao.trim() || undefined,
                }),
            });
            const json = (await response.json().catch(() => null)) as
                | { ok?: boolean; reason?: string }
                | null;
            if (!response.ok || !json?.ok) {
                const reason = json?.reason ?? "PERSISTENCIA";
                if (reason === "NAO_AUTENTICADO") {
                    setErro("Você precisa estar logado para denunciar.");
                } else if (reason === "ALVO_NAO_ENCONTRADO") {
                    setErro("Conteúdo não encontrado. Atualize a página.");
                } else if (reason === "DESCRICAO_INVALIDA") {
                    setErro("Descrição muito longa (máx. 2000 caracteres).");
                } else {
                    setErro("Erro ao enviar denúncia. Tente novamente.");
                }
                return;
            }
            setSucesso(true);
            onSuccess?.();
            // Pequeno delay pra usuário enxergar a confirmação.
            setTimeout(() => onClose(), 900);
        } catch {
            setErro("Erro de conexão. Tente novamente.");
        } finally {
            setEnviando(false);
        }
    };

    return (
        <Modal
            open={open}
            onClose={enviando ? () => undefined : onClose}
            title="Denunciar"
            size="sm"
            dismissOnBackdrop={!enviando}
            dismissOnEsc={!enviando}
        >
            <div className="flex flex-col gap-4 px-5 py-4">
                {sucesso ? (
                    <InlineAlert tone="success">
                        Denúncia enviada. Nossa equipe vai analisar.
                    </InlineAlert>
                ) : (
                    <>
                        <p className="text-sm text-text-secondary">
                            Escolha o motivo. Sua denúncia é anônima
                            para o autor do conteúdo.
                        </p>

                        <fieldset className="flex flex-col gap-2">
                            <legend className="sr-only">
                                Motivo da denúncia
                            </legend>
                            {OPCOES_MOTIVO.map((opt) => {
                                const checked = motivo === opt.valor;
                                return (
                                    <label
                                        key={opt.valor}
                                        className={[
                                            "flex cursor-pointer items-start gap-3 rounded-2xl border p-3 transition-colors",
                                            checked
                                                ? "border-[#ec7b5b]/40 bg-[color:var(--accent-soft)]"
                                                : "border-border bg-surface hover:bg-surface-muted",
                                        ].join(" ")}
                                    >
                                        <input
                                            type="radio"
                                            name="motivo-denuncia"
                                            className="mt-1 h-4 w-4 flex-none accent-[color:var(--accent)]"
                                            checked={checked}
                                            onChange={() =>
                                                setMotivo(opt.valor)
                                            }
                                            disabled={enviando}
                                        />
                                        <span className="flex flex-col">
                                            <span className="text-sm font-medium text-text-primary">
                                                {opt.label}
                                            </span>
                                            <span className="text-xs text-text-secondary">
                                                {opt.descricao}
                                            </span>
                                        </span>
                                    </label>
                                );
                            })}
                        </fieldset>

                        <label className="flex flex-col gap-1">
                            <span className="text-xs font-medium text-text-secondary">
                                Descrição (opcional)
                            </span>
                            <textarea
                                value={descricao}
                                onChange={(e) => setDescricao(e.target.value)}
                                rows={3}
                                maxLength={500}
                                disabled={enviando}
                                placeholder="Explique brevemente, se necessário."
                                className="resize-none rounded-2xl border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:border-[#ec7b5b]/50 focus:outline-none focus:ring-2 focus:ring-[#ec7b5b]/25"
                            />
                            <span className="text-right text-[10px] text-text-secondary">
                                {descricao.length}/500
                            </span>
                        </label>

                        {erro ? (
                            <InlineAlert tone="danger">{erro}</InlineAlert>
                        ) : null}
                    </>
                )}
            </div>

            {!sucesso ? (
                <footer className="flex flex-none flex-col-reverse items-stretch gap-2 border-t border-neutral-200 px-5 py-3 sm:flex-row sm:items-center sm:justify-end">
                    <Button
                        type="button"
                        variant="ghost"
                        size="md"
                        onClick={onClose}
                        disabled={enviando}
                    >
                        Cancelar
                    </Button>
                    <Button
                        type="button"
                        variant="danger"
                        size="md"
                        onClick={() => void handleSubmit()}
                        loading={enviando}
                        disabled={!motivo || enviando}
                    >
                        Enviar denúncia
                    </Button>
                </footer>
            ) : null}
        </Modal>
    );
}
