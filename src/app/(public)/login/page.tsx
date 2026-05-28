"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";

import {
    AtIcon,
    AuthCard,
    Button,
    Input,
    LockIcon,
    PasswordInput,
} from "@/components";
import { buildAuthUrl, sanitizarNext } from "@/domain/redirect";

/**
 * Página `/login`.
 *
 * UI do Sistema_de_Autenticacao para Cliente e Acompanhante. Consome a
 * Biblioteca_de_Componentes (`AuthCard`, `Input`, `PasswordInput`,
 * `Button`, ícones) e delega a verificação de credenciais ao route
 * handler `POST /api/auth/login`.
 *
 * O campo de identificação aceita **email** ou **nome de usuário** (com
 * ou sem `@` à esquerda); o handler delega a normalização ao serviço
 * `login()` em `src/server/auth/login.ts`. A propriedade de
 * indistinguibilidade (Requirements 1.2 e 1.3) é preservada na UI: para
 * qualquer falha de credencial reportada pelo servidor, exibimos
 * exatamente "Login ou senha inválidos", sem distinguir email
 * inexistente de senha incorreta. Em rate limit (HTTP 429) mostramos
 * "Muitas tentativas. Tente novamente em 15 minutos." (Requirement 1.8).
 *
 * Usamos `window.location.href` em vez de `router.push` porque o cookie
 * de sessão é gravado pelo handler na resposta dessa requisição e
 * queremos uma navegação completa para que o middleware veja o cookie
 * já no próximo request.
 */
export default function LoginPage(): React.ReactElement {
    return (
        <React.Suspense fallback={<LoginFallback />}>
            <LoginForm />
        </React.Suspense>
    );
}

function LoginFallback(): React.ReactElement {
    return (
        <AuthCard
            title="Bem-vindo de volta"
            subtitle={
                <>
                    Entre com seu email ou{" "}
                    <span className="font-medium">@usuário</span>
                </>
            }
        >
            <div
                aria-hidden="true"
                className="flex flex-col gap-4 opacity-50"
            >
                <div className="h-10 rounded-2xl bg-neutral-100" />
                <div className="h-10 rounded-2xl bg-neutral-100" />
                <div className="h-10 rounded-2xl bg-[color:var(--accent-soft)]" />
            </div>
        </AuthCard>
    );
}

function LoginForm(): React.ReactElement {
    const searchParams = useSearchParams();
    const nextRaw = searchParams?.get("next") ?? null;
    const safeNext = sanitizarNext(nextRaw, { proibidos: ["/login"] });

    const [loginValue, setLoginValue] = React.useState("");
    const [password, setPassword] = React.useState("");
    const [loginError, setLoginError] = React.useState(false);
    const [passwordError, setPasswordError] = React.useState(false);
    const [submitting, setSubmitting] = React.useState(false);
    const [formError, setFormError] = React.useState<string | null>(null);

    /**
     * Roteia o usuário recém-autenticado.
     *
     * Quando há `?next=<url>` válido na query, redireciona pra ele.
     * Caso contrário, cai no destino default por `userType`:
     *   - `CLIENTE` → home pública `/`.
     *   - `ACOMPANHANTE` → `/acompanhante` (layout decide entre
     *     área principal e `/acompanhante/selecao-plano` conforme
     *     plano vigente).
     */
    function redirectAfterLogin(userType: string): void {
        if (safeNext !== null) {
            window.location.href = safeNext;
            return;
        }
        if (userType === "CLIENTE") {
            window.location.href = "/";
            return;
        }
        if (userType === "ACOMPANHANTE") {
            window.location.href = "/acompanhante";
            return;
        }
        setFormError("Login ou senha inválidos");
    }

    async function handleSubmit(
        event: React.FormEvent<HTMLFormElement>,
    ): Promise<void> {
        event.preventDefault();
        if (submitting) {
            return;
        }

        const trimmedLogin = loginValue.trim();
        const isLoginEmpty = trimmedLogin.length === 0;
        const isPasswordEmpty = password.length === 0;

        setLoginError(isLoginEmpty);
        setPasswordError(isPasswordEmpty);

        if (isLoginEmpty || isPasswordEmpty) {
            setFormError("Preencha seus dados para continuar.");
            return;
        }

        setFormError(null);
        setSubmitting(true);

        try {
            const response = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    login: trimmedLogin,
                    password,
                }),
            });

            if (response.status === 429) {
                setFormError(
                    "Muitas tentativas. Tente novamente em 15 minutos.",
                );
                return;
            }

            if (!response.ok) {
                setFormError("Login ou senha inválidos");
                return;
            }

            const payload = (await response.json().catch(() => null)) as
                | { userType?: unknown }
                | null;

            if (payload === null || typeof payload.userType !== "string") {
                setFormError("Login ou senha inválidos");
                return;
            }

            redirectAfterLogin(payload.userType);
        } catch {
            setFormError("Login ou senha inválidos");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <AuthCard
            title="Bem-vindo de volta"
            subtitle={
                <>
                    Entre com seu email ou{" "}
                    <span className="font-medium">@usuário</span>
                </>
            }
            footer={
                <div className="flex flex-col items-center gap-1.5">
                    <span>
                        Sem conta ainda?{" "}
                        <a
                            href={buildAuthUrl("/cadastro", safeNext)}
                            className="font-medium text-[color:var(--accent-deep)] hover:text-primary-800"
                        >
                            Criar conta
                        </a>
                    </span>
                    <a
                        href="/recuperar-senha"
                        className="text-xs text-text-secondary hover:text-text-primary"
                    >
                        Esqueci minha senha
                    </a>
                </div>
            }
        >
            <form
                onSubmit={handleSubmit}
                noValidate
                className="flex flex-col gap-4"
                aria-describedby={formError ? "login-form-error" : undefined}
            >
                <Input
                    label="Email ou nome de usuário"
                    type="text"
                    name="login"
                    autoComplete="username"
                    placeholder="seu@email.com  ou  @usuario"
                    value={loginValue}
                    onChange={(event) => {
                        setLoginValue(event.target.value);
                        if (loginError) setLoginError(false);
                    }}
                    error={loginError}
                    errorMessage={
                        loginError ? "Informe seu email ou usuário." : undefined
                    }
                    disabled={submitting}
                    leadingIcon={<AtIcon size={16} />}
                    required
                />

                <PasswordInput
                    label="Senha"
                    name="password"
                    autoComplete="current-password"
                    placeholder="Sua senha"
                    value={password}
                    onChange={(event) => {
                        setPassword(event.target.value);
                        if (passwordError) setPasswordError(false);
                    }}
                    error={passwordError}
                    errorMessage={
                        passwordError ? "Informe sua senha." : undefined
                    }
                    disabled={submitting}
                    leadingIcon={<LockIcon size={16} />}
                    required
                />

                {formError !== null && (
                    <p
                        id="login-form-error"
                        role="alert"
                        className="rounded-md border border-danger-200 bg-danger-50 px-3 py-2 text-xs text-danger-700 animate-fade-in-soft"
                    >
                        {formError}
                    </p>
                )}

                <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    loading={submitting}
                    className="mt-1 w-full"
                >
                    {submitting ? "Entrando…" : "Entrar"}
                </Button>
            </form>
        </AuthCard>
    );
}
