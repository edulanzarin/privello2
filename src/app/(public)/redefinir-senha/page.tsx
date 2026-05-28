"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";

import {
    AuthCard,
    Button,
    InlineAlert,
    LockIcon,
    PasswordInput,
} from "@/components";

/**
 * Página `/redefinir-senha?token=<raw>` — consome o token de
 * reset e troca a senha.
 *
 * Token vem na query string (gerado por `criarTokenResetSenha`).
 * Após sucesso, redireciona para `/login` — o usuário entra com
 * a senha nova.
 */
export default function RedefinirSenhaPage(): React.ReactElement {
    return (
        <React.Suspense fallback={<RedefinirFallback />}>
            <RedefinirForm />
        </React.Suspense>
    );
}

function RedefinirFallback(): React.ReactElement {
    return (
        <AuthCard title="Redefinir senha" subtitle="Carregando…">
            <div aria-hidden="true" className="flex flex-col gap-4 opacity-50">
                <div className="h-10 rounded-2xl bg-neutral-100" />
                <div className="h-10 rounded-2xl bg-neutral-100" />
                <div className="h-10 rounded-2xl bg-[color:var(--accent-soft)]" />
            </div>
        </AuthCard>
    );
}

function RedefinirForm(): React.ReactElement {
    const searchParams = useSearchParams();
    const token = searchParams?.get("token") ?? "";

    const [password, setPassword] = React.useState("");
    const [confirm, setConfirm] = React.useState("");
    const [submitting, setSubmitting] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [done, setDone] = React.useState(false);

    if (token.length === 0) {
        return (
            <AuthCard
                title="Link inválido"
                subtitle="O link de redefinição está incompleto. Solicite um novo."
                footer={
                    <a
                        href="/recuperar-senha"
                        className="font-medium text-[color:var(--accent-deep)] hover:text-primary-800"
                    >
                        Solicitar novo link
                    </a>
                }
            >
                <InlineAlert tone="danger">
                    Token ausente na URL.
                </InlineAlert>
            </AuthCard>
        );
    }

    async function handleSubmit(
        e: React.FormEvent<HTMLFormElement>,
    ): Promise<void> {
        e.preventDefault();
        if (submitting) return;

        if (password.length < 8 || password.length > 128) {
            setError("Senha deve ter entre 8 e 128 caracteres.");
            return;
        }
        if (password !== confirm) {
            setError("As senhas não coincidem.");
            return;
        }

        setSubmitting(true);
        setError(null);
        try {
            const res = await fetch("/api/auth/reset-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token, password }),
            });

            if (res.status === 410) {
                setError(
                    "Este link expirou ou já foi usado. Solicite um novo.",
                );
                return;
            }
            if (!res.ok) {
                setError("Não foi possível redefinir a senha.");
                return;
            }

            setDone(true);
            // Pequeno delay e redireciona pra login.
            setTimeout(() => {
                window.location.href = "/login";
            }, 1500);
        } catch {
            setError("Falha de rede. Tente novamente.");
        } finally {
            setSubmitting(false);
        }
    }

    if (done) {
        return (
            <AuthCard
                title="Senha redefinida"
                subtitle="Pronto. Te levamos pra tela de login em instantes."
            >
                <InlineAlert tone="success">
                    Suas sessões antigas foram encerradas por segurança.
                    Use a nova senha pra entrar.
                </InlineAlert>
            </AuthCard>
        );
    }

    return (
        <AuthCard
            title="Redefinir senha"
            subtitle="Crie uma senha nova com pelo menos 8 caracteres."
            footer={
                <a
                    href="/login"
                    className="font-medium text-[color:var(--accent-deep)] hover:text-primary-800"
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
                <PasswordInput
                    label="Nova senha"
                    name="password"
                    autoComplete="new-password"
                    placeholder="Mínimo 8 caracteres"
                    value={password}
                    onChange={(e) => {
                        setPassword(e.target.value);
                        if (error) setError(null);
                    }}
                    leadingIcon={<LockIcon size={16} />}
                    disabled={submitting}
                    required
                />
                <PasswordInput
                    label="Confirmar senha"
                    name="confirm"
                    autoComplete="new-password"
                    placeholder="Digite novamente"
                    value={confirm}
                    onChange={(e) => {
                        setConfirm(e.target.value);
                        if (error) setError(null);
                    }}
                    leadingIcon={<LockIcon size={16} />}
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
                    {submitting ? "Salvando…" : "Redefinir senha"}
                </Button>
            </form>
        </AuthCard>
    );
}
