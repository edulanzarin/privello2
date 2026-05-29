"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import {
    Avatar,
    Button,
    Card,
    ChatIcon,
    ConfirmDialog,
    EmptyState,
    FilterChips,
    InlineAlert,
    LinkButton,
    Paginator,
    SectionHeader,
    useModal,
    type FilterChipsOption,
} from "@/components";

import type { QuestionPublica } from "@/server/questions";

/**
 * Aba "Perguntas" do painel da Acompanhante.
 *
 * Centraliza a interação Q&A com Clientes Fan: lista perguntas
 * recebidas com filtro Pendentes/Respondidas, formulário inline
 * para responder/editar, e ação de excluir resposta sem perder a
 * pergunta.
 *
 * Estrutura:
 *
 *   1. SectionHeader com badge do total pendente.
 *   2. FilterChips (Tudo / Pendentes / Respondidas).
 *   3. Paginator de cards. Cada card mostra autor, pergunta,
 *      resposta atual (se houver) e botão "Responder"/"Editar
 *      resposta".
 */
export interface PerguntasTabProps {
    perguntas: ReadonlyArray<QuestionPublica>;
}

type Filtro = "tudo" | "pendentes" | "respondidas";

export function PerguntasTab({
    perguntas,
}: PerguntasTabProps): React.ReactElement {
    const [filtro, setFiltro] = React.useState<Filtro>("pendentes");

    const totalPendentes = perguntas.filter((p) => p.answeredAt === null)
        .length;
    const totalRespondidas = perguntas.length - totalPendentes;

    const opcoes: ReadonlyArray<FilterChipsOption> = [
        {
            value: "tudo",
            label: "Tudo",
            count: perguntas.length,
        },
        {
            value: "pendentes",
            label: "Pendentes",
            count: totalPendentes,
        },
        {
            value: "respondidas",
            label: "Respondidas",
            count: totalRespondidas,
        },
    ];

    const filtered = React.useMemo(() => {
        if (filtro === "pendentes") {
            return perguntas.filter((p) => p.answeredAt === null);
        }
        if (filtro === "respondidas") {
            return perguntas.filter((p) => p.answeredAt !== null);
        }
        return perguntas;
    }, [filtro, perguntas]);

    return (
        <div className="flex flex-col gap-4">
            <SectionHeader
                title="Perguntas"
                subtitle="Respostas aparecem direto no seu perfil público."
            />

            <FilterChips
                options={opcoes}
                value={filtro}
                onChange={(v) => setFiltro(v as Filtro)}
                aria-label="Filtrar perguntas"
                layout="fixed"
            />

            {filtered.length > 0 ? (
                <Paginator
                    items={filtered}
                    pageSize={5}
                    showCounter={false}
                    loadMoreLabel="Ver mais"
                    render={(visible) => (
                        <div className="flex flex-col gap-3">
                            {visible.map((p) => (
                                <PerguntaPainelCard
                                    key={p.id}
                                    pergunta={p}
                                />
                            ))}
                        </div>
                    )}
                />
            ) : (
                <Card padding="none">
                    <EmptyState
                        size="sm"
                        icon={<ChatIcon size={20} />}
                        title={emptyTitle(filtro)}
                        description={emptyDescription(filtro)}
                    />
                </Card>
            )}
        </div>
    );
}

function emptyTitle(filtro: Filtro): string {
    if (filtro === "pendentes") return "Nenhuma pergunta pendente";
    if (filtro === "respondidas") return "Nenhuma pergunta respondida";
    return "Você ainda não recebeu perguntas";
}

function emptyDescription(filtro: Filtro): string {
    if (filtro === "pendentes")
        return "Você está em dia. Quando alguém perguntar, aparece aqui.";
    if (filtro === "respondidas")
        return "Suas respostas aparecem aqui depois que você responde uma pergunta.";
    return "Apenas Clientes Fan podem perguntar.";
}

// ---------------------------------------------------------------------------
// PerguntaPainelCard
// ---------------------------------------------------------------------------

function PerguntaPainelCard({
    pergunta,
}: {
    pergunta: QuestionPublica;
}): React.ReactElement {
    const router = useRouter();
    const [editing, setEditing] = React.useState(false);
    const [answer, setAnswer] = React.useState(pergunta.answer ?? "");
    const [submitting, setSubmitting] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const deleteDialog = useModal();

    const trimmed = answer.trim();
    const canSubmit = trimmed.length > 0 && trimmed.length <= 2000;

    async function submit(): Promise<void> {
        if (!canSubmit) return;
        setSubmitting(true);
        setError(null);
        try {
            const res = await fetch(`/api/questions/${pergunta.id}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ answer: trimmed }),
            });
            if (!res.ok) {
                setError("Não foi possível salvar. Tente novamente.");
                return;
            }
            setEditing(false);
            router.refresh();
        } catch {
            setError("Falha de rede. Tente novamente.");
        } finally {
            setSubmitting(false);
        }
    }

    async function deleteAnswer(): Promise<void> {
        setSubmitting(true);
        setError(null);
        try {
            const res = await fetch(`/api/questions/${pergunta.id}`, {
                method: "DELETE",
            });
            if (!res.ok) {
                setError("Não foi possível remover. Tente novamente.");
                return;
            }
            setAnswer("");
            setEditing(false);
            deleteDialog.close();
            router.refresh();
        } catch {
            setError("Falha de rede. Tente novamente.");
        } finally {
            setSubmitting(false);
        }
    }

    const isAnswered = pergunta.answer !== null;

    return (
        <Card>
            <div className="flex flex-col gap-3">
                {/* Pergunta */}
                <div className="flex items-start gap-3">
                    <Avatar
                        src={pergunta.authorFotoUrl}
                        name={pergunta.authorNome}
                        size="sm"
                    />
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="truncate text-sm font-medium text-text-primary">
                            {pergunta.authorNome}
                        </span>
                        <span className="text-xs text-text-secondary">
                            @{pergunta.authorIdentificador} ·{" "}
                            {formatRelative(pergunta.createdAt)}
                        </span>
                        <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-text-primary">
                            {pergunta.question}
                        </p>
                    </div>
                </div>

                {/* Resposta — read-only quando há e não está editando */}
                {isAnswered && !editing ? (
                    <div className="ml-11 rounded-2xl border border-[#ec7b5b]/15 bg-[#fff0eb]/50 px-3 py-2">
                        <div className="mb-1 flex items-center justify-between gap-2">
                            <span className="text-[0.65rem] font-semibold uppercase tracking-wider text-[color:var(--accent-deep)]">
                                Sua resposta ·{" "}
                                {pergunta.answeredAt
                                    ? formatRelative(pergunta.answeredAt)
                                    : ""}
                            </span>
                            <div className="flex items-center gap-2">
                                <LinkButton
                                    onClick={() => setEditing(true)}
                                    disabled={submitting}
                                >
                                    Editar
                                </LinkButton>
                                <LinkButton
                                    onClick={deleteDialog.open}
                                    tone="danger"
                                    disabled={submitting}
                                >
                                    Remover
                                </LinkButton>
                            </div>
                        </div>
                        <p className="whitespace-pre-line text-sm leading-relaxed text-text-primary">
                            {pergunta.answer}
                        </p>
                    </div>
                ) : null}

                {/* Form de resposta — quando pendente OU editando */}                {!isAnswered || editing ? (
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            void submit();
                        }}
                        className="ml-11 flex flex-col gap-2"
                    >
                        <textarea
                            rows={3}
                            value={answer}
                            onChange={(e) => setAnswer(e.target.value)}
                            placeholder={
                                isAnswered
                                    ? "Atualize sua resposta."
                                    : "Sua resposta…"
                            }
                            maxLength={2000}
                            disabled={submitting}
                            autoFocus={editing}
                            className="block w-full resize-none rounded-md border border-neutral-200 bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-disabled shadow-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30 focus-visible:border-primary-400 disabled:cursor-not-allowed disabled:bg-neutral-50"
                        />
                        <div className="flex items-center justify-between text-[0.7rem] text-text-secondary">
                            <span>{trimmed.length}/2000</span>
                        </div>
                        {error !== null ? (
                            <InlineAlert tone="danger">{error}</InlineAlert>
                        ) : null}
                        <div className="flex items-center justify-end gap-2">
                            {editing ? (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        setEditing(false);
                                        setAnswer(pergunta.answer ?? "");
                                    }}
                                    disabled={submitting}
                                >
                                    Cancelar
                                </Button>
                            ) : null}
                            <Button
                                type="submit"
                                variant="primary"
                                size="sm"
                                loading={submitting}
                                disabled={submitting || !canSubmit}
                            >
                                {isAnswered ? "Salvar" : "Responder"}
                            </Button>
                        </div>
                    </form>
                ) : null}
            </div>

            <ConfirmDialog
                open={deleteDialog.isOpen}
                onClose={deleteDialog.close}
                onConfirm={deleteAnswer}
                title="Remover resposta"
                description="A pergunta continua visível, mas sua resposta será apagada. Você pode responder de novo a qualquer momento."
                tone="danger"
                confirmLabel="Remover"
                loading={submitting}
            />
        </Card>
    );
}

function formatRelative(date: Date | string): string {
    const d = typeof date === "string" ? new Date(date) : date;
    const diff = Date.now() - d.getTime();
    const min = Math.floor(diff / 60_000);
    if (min < 1) return "agora";
    if (min < 60) return `há ${min}min`;
    const h = Math.floor(min / 60);
    if (h < 24) return `há ${h}h`;
    const days = Math.floor(h / 24);
    if (days < 7) return `há ${days}d`;
    const weeks = Math.floor(days / 7);
    if (weeks < 5) return `há ${weeks}sem`;
    const months = Math.floor(days / 30);
    if (months < 12) return `há ${months}m`;
    const years = Math.floor(days / 365);
    return `há ${years}a`;
}
