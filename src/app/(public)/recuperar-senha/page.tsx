"use client";

import * as React from "react";

import {
    AuthCard,
    Button,
    InlineAlert,
    Input,
    MailIcon,
} from "@/components";

/**
 * Página `/recuperar-senha` — solicitação de link de reset.
 *
 * Form simples com campo de email. Sempre exibe a mesma resposta
 * de sucesso (independente do email existir) para evitar
 * enumeração de contas — comportamento alinhado ao endpoint
 * `POST /api/auth/forgot-password`.
 */
export default function RecuperarSenhaPage(): React.ReactElement {
    const [email, setEmail] = React.useState("");
    const [submitting, setSubmitting] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [done, setDone] = React.useState(false);
    const [devToken, setDevToken] = React.useState<string | null>(null);

    async function handleSubmit(
        e: React.FormEvent<HTMLFormElement>,
    ): Promise<void> {
        e.preventDefault();
        if (submitting) return;

        const trimmed = email.trim();
        if (trimmed.length === 0) {
            setError("Informe seu email.");
            return;
        }

        setSubmitting(true);
        setError(null);

        try {
            const res = await fetch("/api/auth/forgot-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: trimmed }),
            });

            if (res.status === 429) {
                setError(
                    "Muitas solicitações para este email. Tente novamente em 1 hora.",
                );
                return;
            }
            if (!res.ok) {
                setError("Email inválido.");
                return;
            }

            const payload = (await res.json().catch(() => null)) as
                | { _devToken?: string }
                | null;
            if (payload?._devToken) {
                // Em dev, mostra o token pra testar sem email real.
                setDevToken(payload._devToken);
            }

            setDone(true);
        } catch {
            setError("Falha de rede. Tente novamente.");
        } finally {
            setSubmitting(false);
        }
    }

    if (done) {
        return (
            <AuthCard
                title="Verifique seu email"
                subtitle="Se houver uma conta com esse email, enviamos um link para redefinir a senha. O link expira em 1 hora."
                footer={
                    <a
                        href="/login"
                        className="font-medium text-accent-deep hover:text-primary-800"
                    >
                        Voltar para o login
                    </a>
                }
            >
                {devToken !== null ? (
                    <InlineAlert tone="info">
                        <span className="block text-xs">
                            <strong>Modo dev:</strong> link de redefinição
                        </span>
                        <a
                            href={`/redefinir-senha?token=${devToken}`}
                            className="mt-1 inline-block break-all text-xs text-accent-deep underline"
                        >
                            /redefinir-senha?token={devToken.slice(0, 16)}…
                        </a>
                    </InlineAlert>
                ) : null}
            </AuthCard>
        );
    }

    return (
        <AuthCard
            title="Recuperar senha"
            subtitle="Informe seu email. Enviamos um link de redefinição válido por 1 hora."
            footer={
                <a
                    href="/login"
                    className="font-medium text-accent-deep hover:text-primary-800"
                >
                    Voltar para o login
                </a>
            }
        >
            <form
                onSubmit={handleSubmit}
                noValidate
                className="flex flex-col gap-4"
            >
                <Input
                    label="Email"
                    type="email"
                    name="email"
                    autoComplete="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => {
                        setEmail(e.target.value);
                        if (error) setError(null);
                    }}
                    leadingIcon={<MailIcon size={16} />}
                    disabled={submitting}
                    required
                />

                {error !== null ? (
                    <InlineAlert tone="danger">{error}</InlineAlert>
                ) : null}

                <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    loading={submitting}
                    className="mt-1 w-full"
                >
                    {submitting ? "Enviando…" : "Enviar link"}
                </Button>
            </form>
        </AuthCard>
    );
}
