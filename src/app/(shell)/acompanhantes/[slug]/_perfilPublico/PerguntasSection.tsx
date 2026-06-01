"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";

import {
    Avatar,
    Button,
    Card,
    ChatIcon,
    ConfirmDialog,
    InlineAlert,
    LinkButton,
    LockedContent,
    Paginator,
    SectionHeader,
    useModal,
} from "@/components";
import { buildAuthUrl } from "@/domain/redirect";

import type { QuestionPublica } from "@/server/questions";
import type { ViewerKind } from "./PerfilPublicoView";

/**
 * Bloco de Perguntas e Respostas (Q&A) público.
 *
 * Vem **antes** das avaliações na página — perguntas funcionam como
 * filtro/triagem (cliente pergunta antes de decidir avaliar) e por
 * isso fazem sentido logo após a galeria.
 *
 * Estrutura:
 *
 *   1. Header com contador de perguntas.
 *   2. **Sua pergunta** (Cliente Fan, não-dono): textarea + botão
 *      Perguntar. Cliente pode mandar várias.
 *   3. Lista paginada de perguntas (respondidas primeiro, depois
 *      pendentes). Cada item mostra autor, pergunta e resposta da
 *      Acompanhante (se houver).
 *
 * Cliente Grátis e anônimos veem `LockedContent` — Q&A é exclusivo
 * de Fan (mesma regra das avaliações).
 */
export interface PerguntasSectionProps {
    slug: string;
    perguntas: ReadonlyArray<QuestionPublica>;
    perguntasCount: number;
    viewerKind: ViewerKind;
    viewerIsOwner: boolean;
    viewerIsFan: boolean;
}

export function PerguntasSection({
    slug,
    perguntas,
    perguntasCount,
    viewerKind,
    viewerIsOwner,
    viewerIsFan,
}: PerguntasSectionProps): React.ReactElement {
    const pathname = usePathname();
    const router = useRouter();

    const isLocked =
        viewerKind === "anonimo" ||
        (viewerKind === "cliente" && !viewerIsFan);

    if (isLocked) {
        // Anônimos veem dois caminhos (Criar conta / Entrar).
        // Cliente Grátis vê só "Virar Fan".
        //
        // Quando há perguntas, mostramos UMA visível como amostra
        // grátis + LockedContent abaixo com o restante.
        const description =
            viewerKind === "anonimo"
                ? "Crie sua conta ou entre pra ver todas as perguntas e respostas."
                : "Vire Fan pra perguntar e ler todas as respostas.";

        const cta =
            viewerKind === "anonimo" ? (
                <div className="flex flex-col gap-1.5 sm:flex-row">
                    <Button
                        href={buildAuthUrl("/cadastro", pathname)}
                        size="sm"
                        variant="primary"
                    >
                        Criar conta
                    </Button>
                    <Button
                        href={buildAuthUrl("/login", pathname)}
                        size="sm"
                        variant="ghost"
                    >
                        Entrar
                    </Button>
                </div>
            ) : (
                <Button
                    href={buildAuthUrl("/cliente/selecao-plano", pathname)}
                    size="sm"
                >
                    Virar Fan
                </Button>
            );

        const previewPergunta = perguntas[0] ?? null;
        const restante = Math.max(
            0,
            perguntasCount - (previewPergunta ? 1 : 0),
        );

        return (
            <section className="flex flex-col gap-3">
                <SectionHeader
                    title="Perguntas e respostas"
                    trailing={
                        perguntasCount > 0 ? (
                            <span className="text-xs text-text-secondary">
                                {perguntasCount}{" "}
                                {perguntasCount === 1
                                    ? "pergunta"
                                    : "perguntas"}
                            </span>
                        ) : null
                    }
                />

                {previewPergunta ? (
                    <PerguntaCard
                        pergunta={previewPergunta}
                        onDeleted={() => router.refresh()}
                    />
                ) : null}

                <LockedContent
                    blurAmount={10}
                    title={
                        restante > 0
                            ? `+ ${restante} ${restante === 1 ? "pergunta" : "perguntas"} pra ler`
                            : "Perguntas exclusivas para Fans"
                    }
                    description={description}
                    action={cta}
                >
                    <FakePerguntasPreview />
                </LockedContent>
            </section>
        );
    }

    return (
        <section className="flex flex-col gap-3">
            <SectionHeader
                title="Perguntas e respostas"
                trailing={
                    perguntasCount > 0 ? (
                        <span className="text-xs text-text-secondary">
                            {perguntasCount}{" "}
                            {perguntasCount === 1
                                ? "pergunta"
                                : "perguntas"}
                        </span>
                    ) : null
                }
            />

            {/* Form de nova pergunta — Cliente Fan, não-dono. */}
            {viewerKind === "cliente" && !viewerIsOwner ? (
                <PerguntaForm slug={slug} />
            ) : null}

            {perguntas.length > 0 ? (
                <Paginator
                    items={perguntas}
                    pageSize={5}
                    showCounter={false}
                    loadMoreLabel="Ver mais perguntas"
                    render={(visible) => (
                        <div className="flex flex-col gap-3">
                            {visible.map((q) => (
                                <PerguntaCard
                                    key={q.id}
                                    pergunta={q}
                                    onDeleted={() => router.refresh()}
                                />
                            ))}
                        </div>
                    )}
                />
            ) : (
                <Card>
                    <div className="flex flex-col items-center gap-1.5 py-2 text-center">
                        <span
                            aria-hidden="true"
                            className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100 text-text-disabled"
                        >
                            <ChatIcon size={20} />
                        </span>
                        <span className="text-sm font-medium text-text-primary">
                            Sem perguntas ainda
                        </span>
                        <span className="text-xs text-text-secondary">
                            Faça a primeira pergunta para este perfil.
                        </span>
                    </div>
                </Card>
            )}
        </section>
    );
}

// ---------------------------------------------------------------------------
// PerguntaForm
// ---------------------------------------------------------------------------

function PerguntaForm({ slug }: { slug: string }): React.ReactElement {
    const router = useRouter();
    const [pergunta, setPergunta] = React.useState("");
    const [submitting, setSubmitting] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [success, setSuccess] = React.useState(false);
    const trimmed = pergunta.trim();
    const canSubmit = trimmed.length > 0 && trimmed.length <= 500;

    async function submit(): Promise<void> {
        if (submitting || !canSubmit) return;
        setSubmitting(true);
        setError(null);
        setSuccess(false);
        try {
            const res = await fetch(
                `/api/acompanhantes/${encodeURIComponent(slug)}/questions`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ question: trimmed }),
                },
            );
            if (res.status === 429) {
                setError(
                    "Você perguntou rápido demais. Espere um pouco e tente de novo.",
                );
                return;
            }
            if (!res.ok) {
                setError(
                    "Não foi possível enviar a pergunta. Tente novamente.",
                );
                return;
            }
            setPergunta("");
            setSuccess(true);
            router.refresh();
        } catch {
            setError("Falha de rede. Tente novamente.");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <Card>
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    void submit();
                }}
                className="flex flex-col gap-3"
            >
                <span className="text-sm font-semibold text-text-primary">
                    Faça uma pergunta
                </span>
                <textarea
                    rows={3}
                    value={pergunta}
                    onChange={(e) => setPergunta(e.target.value)}
                    placeholder="Pergunte algo. Ela responde no painel."
                    maxLength={500}
                    disabled={submitting}
                    className="block w-full resize-none rounded-md border border-neutral-200 bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-disabled shadow-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30 focus-visible:border-primary-400 disabled:cursor-not-allowed disabled:bg-neutral-50"
                />
                <div className="flex items-center justify-between text-[0.7rem] text-text-secondary">
                    <span>{trimmed.length}/500</span>
                </div>

                {error !== null ? (
                    <InlineAlert tone="danger">{error}</InlineAlert>
                ) : null}
                {success ? (
                    <InlineAlert tone="success">
                        Pergunta enviada. Quando ela responder, aparece
                        aqui.
                    </InlineAlert>
                ) : null}

                <div className="flex items-center justify-end">
                    <Button
                        type="submit"
                        variant="primary"
                        size="sm"
                        loading={submitting}
                        disabled={submitting || !canSubmit}
                    >
                        Perguntar
                    </Button>
                </div>
            </form>
        </Card>
    );
}

// ---------------------------------------------------------------------------
// PerguntaCard
// ---------------------------------------------------------------------------

function PerguntaCard({
    pergunta,
    onDeleted,
}: {
    pergunta: QuestionPublica;
    onDeleted: () => void;
}): React.ReactElement {
    const [deleting, setDeleting] = React.useState(false);
    const dialog = useModal();

    async function handleDelete(): Promise<void> {
        if (deleting) return;
        setDeleting(true);
        try {
            const res = await fetch(`/api/questions/${pergunta.id}`, {
                method: "DELETE",
            });
            if (res.ok) {
                dialog.close();
                onDeleted();
            }
        } finally {
            setDeleting(false);
        }
    }

    return (
        <Card>
            <div className="flex flex-col gap-3">
                {/* Linha da pergunta */}
                <div className="flex items-start gap-3">
                    <Avatar
                        src={pergunta.authorFotoUrl}
                        name={pergunta.authorNome}
                        size="sm"
                    />
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <div className="flex items-baseline justify-between gap-2">
                            <div className="flex flex-col gap-0.5">
                                <span className="truncate text-sm font-medium text-text-primary">
                                    {pergunta.authorNome}
                                </span>
                                <span className="text-xs text-text-secondary">
                                    @{pergunta.authorIdentificador} ·{" "}
                                    {formatRelative(pergunta.createdAt)}
                                </span>
                            </div>
                            {pergunta.isMine ? (
                                <LinkButton
                                    onClick={dialog.open}
                                    tone="danger"
                                    disabled={deleting}
                                >
                                    Excluir
                                </LinkButton>
                            ) : null}
                        </div>
                        <p className="whitespace-pre-line text-sm leading-relaxed text-text-primary">
                            {pergunta.question}
                        </p>
                    </div>
                </div>

                {/* Resposta */}
                {pergunta.answer !== null && pergunta.answeredAt !== null ? (
                    <div className="ml-11 rounded-2xl border border-accent/15 bg-accent-soft/50 px-3 py-2">
                        <span className="text-[0.65rem] font-semibold uppercase tracking-wider text-accent-deep">
                            Resposta ·{" "}
                            {formatRelative(pergunta.answeredAt)}
                        </span>
                        <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-text-primary">
                            {pergunta.answer}
                        </p>
                    </div>
                ) : (
                    <div className="ml-11 inline-flex items-center gap-1.5 text-xs text-text-secondary">
                        <span
                            aria-hidden="true"
                            className="inline-block h-1.5 w-1.5 rounded-full bg-warning-400"
                        />
                        Aguardando resposta
                    </div>
                )}
            </div>

            <ConfirmDialog
                open={dialog.isOpen}
                onClose={dialog.close}
                onConfirm={handleDelete}
                title="Excluir pergunta"
                description="A pergunta e a resposta (se houver) serão removidas. Esta ação não pode ser desfeita."
                tone="danger"
                confirmLabel="Excluir"
                loading={deleting}
            />
        </Card>
    );
}

function FakePerguntasPreview(): React.ReactElement {
    return (
        <div className="flex flex-col gap-3">
            {[1, 2].map((i) => (
                <Card key={i}>
                    <div className="flex flex-col gap-3">
                        <div className="flex items-start gap-3">
                            <Avatar src={null} name="•••" size="sm" />
                            <div className="flex min-w-0 flex-1 flex-col gap-1">
                                <span className="truncate text-sm font-medium text-text-primary">
                                    ••••••• ••••
                                </span>
                                <p className="text-sm leading-relaxed text-text-primary">
                                    ••••••• ••• ••••••• ••••?
                                </p>
                            </div>
                        </div>
                        <div className="ml-11 rounded-2xl border border-accent/15 bg-accent-soft/50 px-3 py-2">
                            <span className="text-[0.65rem] font-semibold uppercase tracking-wider text-accent-deep">
                                Resposta
                            </span>
                            <p className="mt-1 text-sm text-text-primary">
                                ••••••• ••• ••••••• ••••.
                            </p>
                        </div>
                    </div>
                </Card>
            ))}
        </div>
    );
}

function formatRelative(date: Date | string): string {
    const d = typeof date === "string" ? new Date(date) : date;
    const diffMs = Date.now() - d.getTime();
    const minutes = Math.floor(diffMs / 60_000);
    if (minutes < 1) return "agora";
    if (minutes < 60) return `há ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `há ${hours} ${hours === 1 ? "hora" : "horas"}`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `há ${days} ${days === 1 ? "dia" : "dias"}`;
    const weeks = Math.floor(days / 7);
    if (weeks < 5) return `há ${weeks} ${weeks === 1 ? "semana" : "semanas"}`;
    const months = Math.floor(days / 30);
    if (months < 12) return `há ${months} ${months === 1 ? "mês" : "meses"}`;
    const years = Math.floor(days / 365);
    return `há ${years} ${years === 1 ? "ano" : "anos"}`;
}
