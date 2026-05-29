"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import {
    Badge,
    Button,
    Card,
    EmptyState,
    InlineAlert,
    SectionHeader,
    ShieldIcon,
    VerifiedBadge,
    VerifiedBadgeIcon,
} from "@/components";

import { formatRelativeTime } from "@/components/primitives/formatRelativeTime";

/**
 * Estado da verificação consumido pela UI.
 *
 * Espelha `VerificacaoStatus` do service — duplicado aqui pra
 * manter o componente client desacoplado do server module.
 */
interface VerificacaoStatusUI {
    status: "PENDENTE" | "APROVADA" | "REJEITADA";
    submetidaEm: string;
    revisadaEm: string | null;
    motivoRejeicao: string | null;
}

export interface VerificacaoTabProps {
    /**
     * Status atual lido na server-component da página. `null` quando
     * a Acompanhante ainda nunca enviou pedido.
     */
    status: VerificacaoStatusUI | null;
}

/**
 * Aba "Verificação" do painel da Acompanhante.
 *
 * # UX por estado
 *
 * - **Sem pedido (`null`)**: hero introdutório + form pra enviar
 *   selfie + documento.
 * - **`PENDENTE`**: "Em análise" — desabilita reenvio.
 * - **`APROVADA`**: card verde "Verificada" com selo. Não
 *   permite reenvio (não há razão pra refazer).
 * - **`REJEITADA`**: alerta com `motivoRejeicao` + form pra
 *   reenviar.
 *
 * # Form
 *
 * Dois inputs `type=file` (selfie + documento), preview de cada
 * arquivo selecionado, botão "Enviar". Submit faz `POST
 * /api/verificacao` com FormData. Após sucesso, dá `router.refresh`
 * pra carregar o novo status.
 */
export function VerificacaoTab({
    status,
}: VerificacaoTabProps): React.ReactElement {
    const router = useRouter();

    const [selfie, setSelfie] = React.useState<File | null>(null);
    const [documento, setDocumento] = React.useState<File | null>(null);
    const [enviando, setEnviando] = React.useState(false);
    const [erro, setErro] = React.useState<string | null>(null);

    const podeReenviar =
        status === null || status.status === "REJEITADA";
    const aprovada = status?.status === "APROVADA";
    const pendente = status?.status === "PENDENTE";
    const rejeitada = status?.status === "REJEITADA";

    const handleSubmit = async (
        e: React.FormEvent<HTMLFormElement>,
    ): Promise<void> => {
        e.preventDefault();
        if (!selfie || !documento || enviando) return;
        setEnviando(true);
        setErro(null);
        try {
            const formData = new FormData();
            formData.append("selfie", selfie);
            formData.append("documento", documento);
            const response = await fetch("/api/verificacao", {
                method: "POST",
                body: formData,
            });
            const json = (await response.json().catch(() => null)) as
                | { ok?: boolean; reason?: string }
                | null;
            if (!response.ok || !json?.ok) {
                const reason = json?.reason ?? "PERSISTENCIA";
                if (reason === "MIDIA_INVALIDA") {
                    setErro(
                        "Imagens inválidas. Envie JPG, PNG ou WebP.",
                    );
                } else if (reason === "TIPO_INVALIDO") {
                    setErro("Apenas imagens são aceitas.");
                } else {
                    setErro("Erro ao enviar. Tente novamente.");
                }
                return;
            }
            setSelfie(null);
            setDocumento(null);
            router.refresh();
        } catch {
            setErro("Erro de conexão. Tente novamente.");
        } finally {
            setEnviando(false);
        }
    };

    return (
        <div className="flex flex-col gap-5">
            <SectionHeader
                title="Verificação de identidade"
                subtitle="Mostre que é você de verdade. Após aprovação, seu perfil ganha um selo de identidade verificada."
                icon={<ShieldIcon size={18} />}
            />

            {aprovada ? (
                <Card>
                    <div className="flex flex-col items-center gap-3 px-4 py-6 text-center">
                        <VerifiedBadge size="lg" />
                        <div className="flex flex-col gap-1">
                            <span className="text-base font-semibold text-text-primary">
                                Identidade verificada
                            </span>
                            <span className="text-xs text-text-secondary">
                                Aprovada{" "}
                                {status?.revisadaEm
                                    ? formatRelativeTime(
                                          new Date(status.revisadaEm),
                                      )
                                    : ""}
                            </span>
                        </div>
                        <Badge tone="primary" icon={<VerifiedBadgeIcon size={12} />}>
                            Verificada
                        </Badge>
                    </div>
                </Card>
            ) : null}

            {pendente ? (
                <InlineAlert tone="info">
                    Seu pedido foi enviado e está em análise. Vamos
                    revisar e voltar com a decisão em breve.
                </InlineAlert>
            ) : null}

            {rejeitada && status ? (
                <InlineAlert tone="warning">
                    <div className="flex flex-col gap-1">
                        <span className="font-semibold">
                            Pedido rejeitado
                        </span>
                        {status.motivoRejeicao ? (
                            <span>{status.motivoRejeicao}</span>
                        ) : null}
                        <span className="text-[11px] opacity-80">
                            Você pode reenviar com novas fotos abaixo.
                        </span>
                    </div>
                </InlineAlert>
            ) : null}

            {podeReenviar ? (
                <Card>
                    <form
                        onSubmit={(e) => void handleSubmit(e)}
                        className="flex flex-col gap-4 p-4"
                    >
                        <div className="flex flex-col gap-2 text-sm text-text-secondary">
                            <p>
                                Envie duas fotos:
                            </p>
                            <ol className="ml-4 list-decimal space-y-1 text-xs">
                                <li>
                                    <strong className="text-text-primary">
                                        Selfie segurando o documento
                                    </strong>{" "}
                                    — seu rosto + documento aberto na
                                    mesma foto.
                                </li>
                                <li>
                                    <strong className="text-text-primary">
                                        Foto do documento
                                    </strong>{" "}
                                    — apenas a frente do RG/CNH/passaporte.
                                </li>
                            </ol>
                            <p className="text-xs">
                                As fotos são privadas e usadas apenas
                                pela equipe de moderação. Não aparecem
                                no seu perfil.
                            </p>
                        </div>

                        <FotoInput
                            label="Selfie com documento"
                            value={selfie}
                            onChange={setSelfie}
                            disabled={enviando}
                        />

                        <FotoInput
                            label="Foto do documento"
                            value={documento}
                            onChange={setDocumento}
                            disabled={enviando}
                        />

                        {erro ? (
                            <InlineAlert tone="danger">{erro}</InlineAlert>
                        ) : null}

                        <Button
                            type="submit"
                            variant="primary"
                            size="md"
                            loading={enviando}
                            disabled={
                                !selfie || !documento || enviando
                            }
                        >
                            {rejeitada ? "Reenviar" : "Enviar para análise"}
                        </Button>
                    </form>
                </Card>
            ) : null}

            {!podeReenviar && !aprovada ? (
                <EmptyState
                    title="Aguardando análise"
                    description="Seu pedido está na fila. Volte mais tarde."
                />
            ) : null}
        </div>
    );
}

/**
 * Input de arquivo (foto) com preview inline. Mantido como mini-
 * componente local porque o `FileUpload` primitivo é mais
 * complexo do que precisamos aqui.
 */
function FotoInput({
    label,
    value,
    onChange,
    disabled,
}: {
    label: string;
    value: File | null;
    onChange: (file: File | null) => void;
    disabled: boolean;
}): React.ReactElement {
    const inputId = React.useId();
    const previewUrl = React.useMemo(
        () => (value ? URL.createObjectURL(value) : null),
        [value],
    );
    React.useEffect(() => {
        return () => {
            if (previewUrl) URL.revokeObjectURL(previewUrl);
        };
    }, [previewUrl]);

    return (
        <label
            htmlFor={inputId}
            className="flex flex-col gap-2"
        >
            <span className="text-xs font-medium text-text-primary">
                {label}
            </span>
            <div
                className={[
                    "relative flex aspect-[4/3] cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed",
                    value
                        ? "border-[#ec7b5b]/40 bg-[#fff0eb]/30"
                        : "border-border bg-surface-muted hover:border-[#ec7b5b]/40",
                    disabled ? "pointer-events-none opacity-60" : "",
                ].join(" ")}
            >
                {previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={previewUrl}
                        alt={label}
                        className="h-full w-full object-cover"
                    />
                ) : (
                    <span className="text-xs text-text-secondary">
                        Toque para escolher uma foto
                    </span>
                )}
            </div>
            <input
                id={inputId}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    onChange(file);
                }}
                disabled={disabled}
                className="sr-only"
            />
        </label>
    );
}
