"use client";

/**
 * Página de cadastro de Cliente (`/cadastro/cliente`).
 *
 * Implementa a UI descrita pelo design (`Sistema_de_Cadastro_Cliente`)
 * para os Requirements 2.1, 2.2, 2.9 e 2.10. Reusa estritamente os
 * primitivos da Biblioteca_de_Componentes (Requirement 6.2):
 * `AuthCard`, `Button`, `Input`, `PasswordInput`, `AvatarUpload` e os
 * ícones expostos pelo barrel.
 *
 * # Foto_de_Perfil opcional
 *
 * O Cliente pode (opcionalmente) anexar uma Foto_de_Perfil. O fluxo
 * espelha o do Onboarding_Acompanhante:
 *
 *   1. O usuário seleciona uma imagem em `<AvatarUpload>`.
 *   2. A página faz `POST /api/cadastro/cliente/foto` (rota dedicada de
 *      staging) com o `File`. O endpoint valida MIME/tamanho via
 *      `stageProfilePhoto` e devolve uma `stagedKey`.
 *   3. A `stagedKey` + `mimeType` + `sizeBytes` viram inputs `hidden`
 *      no `<form>` da Server Action.
 *   4. A Server Action passa o trio para `registrar(...)`, que dentro
 *      da transação atômica cria a `Media`/`ClientProfile.fotoPerfilId`
 *      e, pós-commit, promove o staged para `committed/<userId>/profile.<ext>`
 *      via `commitProfilePhoto`.
 *
 * Quando o usuário não escolhe foto, os hidden inputs ficam vazios e
 * `registrar` segue o caminho sem foto — diferente do Onboarding_Acompanhante,
 * onde a foto é obrigatória.
 *
 * Como Server Actions só ficam disponíveis a partir de um Client
 * Component via `useActionState`, este arquivo é `"use client"` e
 * consome a action do arquivo irmão `actions.ts`.
 */

import * as React from "react";
import { useActionState } from "react";
import { useSearchParams } from "next/navigation";

import {
    AtIcon,
    AuthCard,
    AvatarUpload,
    Button,
    Input,
    LockIcon,
    MailIcon,
    PasswordInput,
    UserIcon,
} from "@/components";
import { buildAuthUrl, sanitizarNext } from "@/domain/redirect";

import {
    registrarClienteAction,
    type CadastroClienteFormState,
} from "./actions";

const INITIAL_STATE: CadastroClienteFormState = {};

/**
 * Estado do upload de Foto_de_Perfil mantido localmente para a página.
 * Quando `stagedKey !== null`, os hidden inputs do `<form>` carregam o
 * trio (`stagedKey`, `mimeType`, `sizeBytes`) que a Server Action
 * encaminha para `registrar()`.
 */
type FotoUploadState = {
    /** Chave devolvida pelo endpoint de staging, `null` quando não há foto. */
    stagedKey: string | null;
    /** MIME type do `File` selecionado (eco do upload). */
    mimeType: string | null;
    /** Tamanho em bytes do `File` selecionado. */
    sizeBytes: number | null;
    /** Mensagem de erro quando o staging falhou. */
    error: string | null;
    /** `true` enquanto o upload está em curso. */
    pending: boolean;
};

const FOTO_INITIAL: FotoUploadState = {
    stagedKey: null,
    mimeType: null,
    sizeBytes: null,
    error: null,
    pending: false,
};

const FOTO_ACCEPT = "image/jpeg,image/png,image/webp";

/**
 * Wrapper Suspense pro Next 15. `useSearchParams()` em rota
 * estática precisa de boundary explícita; sem ele o build fica
 * em CSR-bailout. Mantemos o conteúdo real em
 * {@link CadastroClienteForm} pra o boundary ficar mínimo.
 */
export default function CadastroClientePage(): React.ReactElement {
    return (
        <React.Suspense fallback={<CadastroClienteFallback />}>
            <CadastroClienteForm />
        </React.Suspense>
    );
}

/**
 * Skeleton enquanto o componente que lê `?next` é hidratado.
 * Mantém o `AuthCard` no lugar pra evitar layout shift.
 */
function CadastroClienteFallback(): React.ReactElement {
    return (
        <AuthCard
            title="Criar conta de Cliente"
            subtitle="Leva menos de 1 minuto."
        >
            <div
                aria-hidden="true"
                className="flex flex-col gap-4 opacity-50"
            >
                <div className="h-24 rounded-2xl bg-neutral-100" />
                <div className="h-10 rounded-2xl bg-neutral-100" />
                <div className="h-10 rounded-2xl bg-neutral-100" />
                <div className="h-10 rounded-2xl bg-neutral-100" />
                <div className="h-10 rounded-2xl bg-neutral-100" />
                <div className="h-10 rounded-2xl bg-[color:var(--accent-soft)]" />
            </div>
        </AuthCard>
    );
}

function CadastroClienteForm(): React.ReactElement {
    const searchParams = useSearchParams();
    const safeNext = sanitizarNext(searchParams?.get("next") ?? null, {
        proibidos: ["/cadastro", "/login"],
    });

    const [state, formAction, pending] = useActionState(
        registrarClienteAction,
        INITIAL_STATE,
    );

    const fieldErrors = state.fieldErrors ?? {};
    const values = state.values ?? {};
    const [foto, setFoto] = React.useState<FotoUploadState>(FOTO_INITIAL);

    /**
     * Faz o upload da foto selecionada para o endpoint de staging.
     * O endpoint valida MIME/tamanho e devolve a `stagedKey` que será
     * anexada ao submit. Quando o usuário cancela a seleção (file ===
     * null) o estado volta ao inicial.
     */
    async function handleFotoChange(file: File | null): Promise<void> {
        if (file === null) {
            setFoto(FOTO_INITIAL);
            return;
        }

        setFoto({
            stagedKey: null,
            mimeType: file.type,
            sizeBytes: file.size,
            error: null,
            pending: true,
        });

        const body = new FormData();
        body.append("foto", file);

        try {
            const response = await fetch("/api/cadastro/cliente/foto", {
                method: "POST",
                body,
            });
            const payload = (await response.json().catch(() => null)) as
                | { ok?: boolean; stagedKey?: unknown; reason?: unknown }
                | null;

            if (
                response.ok &&
                payload !== null &&
                payload.ok === true &&
                typeof payload.stagedKey === "string" &&
                payload.stagedKey.length > 0
            ) {
                setFoto({
                    stagedKey: payload.stagedKey,
                    mimeType: file.type,
                    sizeBytes: file.size,
                    error: null,
                    pending: false,
                });
                return;
            }

            const reason = payload?.reason;
            const message =
                reason === "FOTO_INVALIDA"
                    ? "Foto inválida: use JPEG, PNG ou WEBP de até 10 MB."
                    : "Não foi possível enviar a foto. Tente novamente.";
            setFoto({
                stagedKey: null,
                mimeType: null,
                sizeBytes: null,
                error: message,
                pending: false,
            });
        } catch {
            setFoto({
                stagedKey: null,
                mimeType: null,
                sizeBytes: null,
                error: "Não foi possível enviar a foto. Tente novamente.",
                pending: false,
            });
        }
    }

    const fotoError =
        foto.error ?? (fieldErrors.fotoPerfil as string | undefined);
    const submitDisabled = foto.pending;

    return (
        <AuthCard
            title="Criar conta de Cliente"
            subtitle="Leva menos de 1 minuto."
            footer={
                <>
                    Já tem conta?{" "}
                    <a
                        href={buildAuthUrl("/login", safeNext)}
                        className="font-medium text-[color:var(--accent-deep)] hover:text-primary-800"
                    >
                        Entrar
                    </a>
                </>
            }
        >
            <form
                action={formAction}
                className="flex flex-col gap-4"
                noValidate
            >
                <AvatarUpload
                    name="foto"
                    label="Foto de perfil (opcional)"
                    accept={FOTO_ACCEPT}
                    hint={
                        foto.pending
                            ? "Enviando foto…"
                            : "JPEG, PNG ou WEBP até 10 MB"
                    }
                    error={Boolean(fotoError)}
                    errorMessage={fotoError}
                    disabled={pending}
                    onChange={(file) => {
                        void handleFotoChange(file);
                    }}
                />

                {/* Hidden inputs propagam o staging para a Server Action.
                    Permanecem vazios quando o usuário não escolhe foto. */}
                {safeNext !== null ? (
                    <input type="hidden" name="next" value={safeNext} />
                ) : null}
                <input
                    type="hidden"
                    name="fotoStagedKey"
                    value={foto.stagedKey ?? ""}
                />
                <input
                    type="hidden"
                    name="fotoMimeType"
                    value={foto.mimeType ?? ""}
                />
                <input
                    type="hidden"
                    name="fotoSizeBytes"
                    value={foto.sizeBytes ?? ""}
                />

                <Input
                    label="Nome completo"
                    name="nome"
                    type="text"
                    autoComplete="name"
                    placeholder="Como você se chama?"
                    defaultValue={values.nome ?? ""}
                    error={Boolean(fieldErrors.nome)}
                    errorMessage={fieldErrors.nome}
                    leadingIcon={<UserIcon size={16} />}
                    required
                />
                <Input
                    label="Email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="seu@email.com"
                    defaultValue={values.email ?? ""}
                    error={Boolean(fieldErrors.email)}
                    errorMessage={fieldErrors.email}
                    leadingIcon={<MailIcon size={16} />}
                    required
                />
                <Input
                    label="Nome de usuário"
                    name="identificador"
                    type="text"
                    autoComplete="username"
                    placeholder="seu_usuario"
                    defaultValue={values.identificador ?? ""}
                    error={Boolean(fieldErrors.identificador)}
                    errorMessage={fieldErrors.identificador}
                    hint="3 a 30 caracteres. Letras, números e underscore."
                    leadingIcon={<AtIcon size={16} />}
                    required
                />
                <PasswordInput
                    label="Senha"
                    name="senha"
                    autoComplete="new-password"
                    placeholder="Crie uma senha"
                    error={Boolean(fieldErrors.senha)}
                    errorMessage={fieldErrors.senha}
                    hint="Entre 8 e 128 caracteres."
                    leadingIcon={<LockIcon size={16} />}
                    disabled={pending}
                    required
                />

                <div className="mt-1">
                    <Button
                        type="submit"
                        loading={pending}
                        disabled={submitDisabled}
                        className="w-full"
                    >
                        {pending ? "Criando conta…" : "Criar minha conta"}
                    </Button>
                </div>
            </form>
        </AuthCard>
    );
}
