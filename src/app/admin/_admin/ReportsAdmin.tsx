"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import {
    Badge,
    Button,
    Card,
    EmptyState,
    InlineAlert,
    Modal,
} from "@/components";

interface ReportItem {
    id: string;
    reporterIdentificador: string;
    reporterNome: string;
    targetType: "USER" | "MEDIA" | "COMMENT" | "REVIEW";
    targetId: string;
    motivo:
        | "CONTEUDO_FALSO"
        | "MENOR_DE_IDADE"
        | "ASSEDIO"
        | "GOLPE"
        | "SPAM"
        | "OUTRO";
    descricao: string | null;
    criadaEmISO: string;
}

const MOTIVO_LABEL: Record<ReportItem["motivo"], string> = {
    CONTEUDO_FALSO: "Conteúdo falso",
    MENOR_DE_IDADE: "Menor de idade",
    ASSEDIO: "Assédio",
    GOLPE: "Golpe",
    SPAM: "Spam",
    OUTRO: "Outro",
};

const TARGET_LABEL: Record<ReportItem["targetType"], string> = {
    USER: "Perfil",
    MEDIA: "Mídia",
    COMMENT: "Comentário",
    REVIEW: "Avaliação",
};

export interface ReportsAdminProps {
    items: ReadonlyArray<ReportItem>;
}

/**
 * Lista de denúncias pendentes pra triagem.
 *
 * Cada card mostra autor + alvo + motivo + descrição. Botões
 * "Resolver" (com nota da ação tomada) e "Descartar" (com nota
 * opcional explicando descarte).
 */
export function ReportsAdmin({
    items,
}: ReportsAdminProps): React.ReactElement {
    if (items.length === 0) {
        return (
            <EmptyState
                title="Sem denúncias"
                description="Nenhuma denúncia aguardando análise."
            />
        );
    }

    return (
        <div className="flex flex-col gap-3">
            {items.map((item) => (
                <ReportCard key={item.id} item={item} />
            ))}
        </div>
    );
}

function ReportCard({
    item,
}: {
    item: ReportItem;
}): React.ReactElement {
    const router = useRouter();
    const [acting, setActing] = React.useState(false);
    const [erro, setErro] = React.useState<string | null>(null);
    const [modal, setModal] = React.useState<
        "resolver" | "descartar" | null
    >(null);
    const [resolucao, setResolucao] = React.useState("");

    const submit = async (
        action: "resolver" | "descartar",
    ): Promise<void> => {
        if (action === "resolver" && resolucao.trim().length === 0) {
            setErro("Descreva a ação tomada.");
            return;
        }
        setActing(true);
        setErro(null);
        try {
            const r = await fetch(
                `/api/admin/reports/${item.id}/${action}`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        resolucao: resolucao.trim() || undefined,
                    }),
                },
            );
            if (!r.ok) {
                setErro("Erro ao processar.");
                return;
            }
            setModal(null);
            setResolucao("");
            router.refresh();
        } finally {
            setActing(false);
        }
    };

    return (
        <>
            <Card>
                <div className="flex flex-col gap-3 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="primary">
                            {TARGET_LABEL[item.targetType]}
                        </Badge>
                        <Badge tone="neutral">
                            {MOTIVO_LABEL[item.motivo]}
                        </Badge>
                        <span className="text-xs text-text-secondary">
                            por {item.reporterNome} (@
                            {item.reporterIdentificador}) ·{" "}
                            {new Date(item.criadaEmISO).toLocaleString(
                                "pt-BR",
                            )}
                        </span>
                    </div>

                    <div className="flex flex-col gap-1 text-sm">
                        <span className="text-text-secondary">
                            <span className="font-medium text-text-primary">
                                Alvo:
                            </span>{" "}
                            <code className="rounded bg-surface-muted px-1 py-0.5 text-xs">
                                {item.targetId}
                            </code>
                        </span>
                        {item.descricao ? (
                            <p className="rounded-lg bg-surface-muted px-3 py-2 text-text-primary">
                                {item.descricao}
                            </p>
                        ) : (
                            <span className="text-xs italic text-text-disabled">
                                Sem descrição.
                            </span>
                        )}
                    </div>

                    {erro ? (
                        <InlineAlert tone="danger">{erro}</InlineAlert>
                    ) : null}

                    <div className="flex flex-wrap items-center gap-2">
                        <Button
                            type="button"
                            variant="primary"
                            size="md"
                            onClick={() => setModal("resolver")}
                            disabled={acting}
                        >
                            Resolver
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            size="md"
                            onClick={() => setModal("descartar")}
                            disabled={acting}
                        >
                            Descartar
                        </Button>
                    </div>
                </div>
            </Card>

            <Modal
                open={modal !== null}
                onClose={() => (acting ? undefined : setModal(null))}
                title={modal === "resolver" ? "Resolver denúncia" : "Descartar denúncia"}
                size="sm"
            >
                <div className="flex flex-col gap-3 px-5 py-4">
                    <p className="text-sm text-text-secondary">
                        {modal === "resolver"
                            ? "Descreva a ação tomada (ex: perfil banido, mídia removida)."
                            : "Opcional: explique por que está descartando."}
                    </p>
                    <textarea
                        value={resolucao}
                        onChange={(e) => setResolucao(e.target.value)}
                        rows={3}
                        maxLength={500}
                        disabled={acting}
                        className="resize-none rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
                    />
                </div>
                <footer className="flex flex-none flex-col-reverse items-stretch gap-2 border-t border-neutral-200 px-5 py-3 sm:flex-row sm:items-center sm:justify-end">
                    <Button
                        type="button"
                        variant="ghost"
                        size="md"
                        onClick={() => setModal(null)}
                        disabled={acting}
                    >
                        Cancelar
                    </Button>
                    <Button
                        type="button"
                        variant={modal === "resolver" ? "primary" : "danger"}
                        size="md"
                        onClick={() => modal && void submit(modal)}
                        loading={acting}
                    >
                        Confirmar
                    </Button>
                </footer>
            </Modal>
        </>
    );
}
