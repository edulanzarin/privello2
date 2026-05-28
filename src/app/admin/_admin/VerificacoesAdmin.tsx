"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import {
    Button,
    Card,
    EmptyState,
    InlineAlert,
    Modal,
    SectionHeader,
} from "@/components";

interface VerificacaoItem {
    id: string;
    userIdentificador: string;
    userNome: string;
    submetidaEmISO: string;
}

export interface VerificacoesAdminProps {
    items: ReadonlyArray<VerificacaoItem>;
}

/**
 * Lista de verificações pendentes pra triagem.
 *
 * Cada card mostra nome/identificador + as duas fotos (selfie +
 * documento) servidas via `/api/admin/verificacoes/[id]/foto`.
 * Botões "Aprovar" e "Rejeitar" disparam os endpoints
 * correspondentes. Rejeitar abre modal com textarea pra motivo.
 */
export function VerificacoesAdmin({
    items,
}: VerificacoesAdminProps): React.ReactElement {
    if (items.length === 0) {
        return (
            <EmptyState
                title="Sem pendências"
                description="Nenhuma verificação aguardando análise."
            />
        );
    }

    return (
        <div className="flex flex-col gap-4">
            {items.map((item) => (
                <VerificacaoCard key={item.id} item={item} />
            ))}
        </div>
    );
}

function VerificacaoCard({
    item,
}: {
    item: VerificacaoItem;
}): React.ReactElement {
    const router = useRouter();
    const [acting, setActing] = React.useState(false);
    const [erro, setErro] = React.useState<string | null>(null);
    const [rejectOpen, setRejectOpen] = React.useState(false);
    const [motivo, setMotivo] = React.useState("");

    const aprovar = async (): Promise<void> => {
        setActing(true);
        setErro(null);
        try {
            const r = await fetch(
                `/api/admin/verificacoes/${item.id}/aprovar`,
                { method: "POST" },
            );
            if (!r.ok) {
                setErro("Erro ao aprovar.");
                return;
            }
            router.refresh();
        } finally {
            setActing(false);
        }
    };

    const rejeitar = async (): Promise<void> => {
        if (motivo.trim().length === 0) {
            setErro("Informe o motivo da rejeição.");
            return;
        }
        setActing(true);
        setErro(null);
        try {
            const r = await fetch(
                `/api/admin/verificacoes/${item.id}/rejeitar`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ motivo: motivo.trim() }),
                },
            );
            if (!r.ok) {
                setErro("Erro ao rejeitar.");
                return;
            }
            setRejectOpen(false);
            router.refresh();
        } finally {
            setActing(false);
        }
    };

    return (
        <>
            <Card>
                <div className="flex flex-col gap-4 p-4">
                    <SectionHeader
                        title={item.userNome}
                        subtitle={`@${item.userIdentificador} · enviada ${new Date(
                            item.submetidaEmISO,
                        ).toLocaleString("pt-BR")}`}
                    />

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <FotoAdmin
                            label="Selfie com documento"
                            url={`/api/admin/verificacoes/${item.id}/foto?tipo=selfie`}
                        />
                        <FotoAdmin
                            label="Documento"
                            url={`/api/admin/verificacoes/${item.id}/foto?tipo=documento`}
                        />
                    </div>

                    {erro ? (
                        <InlineAlert tone="danger">{erro}</InlineAlert>
                    ) : null}

                    <div className="flex flex-wrap items-center gap-2">
                        <Button
                            type="button"
                            variant="primary"
                            size="md"
                            onClick={() => void aprovar()}
                            loading={acting}
                        >
                            Aprovar
                        </Button>
                        <Button
                            type="button"
                            variant="danger"
                            size="md"
                            onClick={() => setRejectOpen(true)}
                            disabled={acting}
                        >
                            Rejeitar
                        </Button>
                    </div>
                </div>
            </Card>

            <Modal
                open={rejectOpen}
                onClose={() => (acting ? undefined : setRejectOpen(false))}
                title="Rejeitar verificação"
                size="sm"
            >
                <div className="flex flex-col gap-3 px-5 py-4">
                    <p className="text-sm text-text-secondary">
                        Informe o motivo. A Acompanhante verá esse
                        texto e poderá reenviar.
                    </p>
                    <textarea
                        value={motivo}
                        onChange={(e) => setMotivo(e.target.value)}
                        rows={3}
                        maxLength={500}
                        disabled={acting}
                        className="resize-none rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
                        placeholder="Ex: Foto borrada, documento ilegível, suspeita de fraude…"
                    />
                </div>
                <footer className="flex flex-none flex-col-reverse items-stretch gap-2 border-t border-neutral-200 px-5 py-3 sm:flex-row sm:items-center sm:justify-end">
                    <Button
                        type="button"
                        variant="ghost"
                        size="md"
                        onClick={() => setRejectOpen(false)}
                        disabled={acting}
                    >
                        Cancelar
                    </Button>
                    <Button
                        type="button"
                        variant="danger"
                        size="md"
                        onClick={() => void rejeitar()}
                        loading={acting}
                    >
                        Rejeitar
                    </Button>
                </footer>
            </Modal>
        </>
    );
}

function FotoAdmin({
    label,
    url,
}: {
    label: string;
    url: string;
}): React.ReactElement {
    return (
        <figure className="flex flex-col gap-1">
            <span className="text-xs font-medium text-text-secondary">
                {label}
            </span>
            <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="overflow-hidden rounded-lg border border-border"
            >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src={url}
                    alt={label}
                    className="aspect-[4/3] w-full object-cover"
                />
            </a>
        </figure>
    );
}
