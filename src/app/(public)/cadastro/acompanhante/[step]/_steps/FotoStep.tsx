"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState } from "react";

import { AvatarUpload, Button } from "@/components";

import {
    UPLOAD_FOTO_INITIAL,
    type UploadFotoState,
} from "../../action-state";
import { uploadFotoAction } from "../../actions";

/**
 * Step 6 — Foto_de_Perfil (Requirement 3.10).
 *
 * Reusa {@link AvatarUpload} como entrada principal. Ao chegar nesta
 * tela, três cenários:
 *
 * 1. **Sem foto**: avatar mostra placeholder. Clicar abre o seletor;
 *    enviar dispara a Server Action `uploadFotoAction`, que valida
 *    MIME/tamanho, grava em `staged/<uuid>` no R2 e atualiza a coluna
 *    `staged_key` do `OnboardingDraft`.
 * 2. **Com foto já enviada nesta sessão**: o `AvatarUpload` mostra o
 *    preview local via `URL.createObjectURL`.
 * 3. **Com foto já enviada e usuário voltou ao passo**: o `stagedKey`
 *    está persistido no draft. Passamos `initialPreviewUrl` apontando
 *    para `/api/storage/<stagedKey>` (que serve do R2 dev/local) para
 *    que a UI exiba a imagem real, sem o usuário ter de "achar" que
 *    perdeu a foto. O botão Continuar avança direto, e a Acompanhante
 *    pode opcionalmente substituir a foto antes.
 *
 * Em sucesso (`state.ok`), navega para o próximo passo.
 */

export interface FotoStepProps {
    nextPath: string;
    previousPath: string | null;
    /**
     * Chave do objeto staged no R2 quando o draft já tem foto enviada.
     * `null` quando ainda não houve upload.
     */
    stagedKey: string | null;
}

export function FotoStep({
    nextPath,
    previousPath,
    stagedKey,
}: FotoStepProps): React.ReactElement {
    const [state, formAction, pending] = useActionState<
        UploadFotoState,
        FormData
    >(uploadFotoAction, UPLOAD_FOTO_INITIAL);

    const router = useRouter();
    React.useEffect(() => {
        if (state.ok === true) {
            router.push(nextPath);
        }
    }, [state.ok, nextPath, router]);

    const hasStagedKey = stagedKey !== null;
    const initialPreviewUrl = stagedKey ? `/api/storage/${stagedKey}` : null;

    /**
     * Quando `hasStagedKey === true`, o submit pode acontecer sem que
     * a Acompanhante escolha um novo arquivo (ela já enviou antes).
     * Nesse caso o `<form>` envia um `<input type="file">` vazio, o
     * que faz a action retornar erro de validação. Para evitar isso,
     * tratamos o submit "sem novo arquivo" como simples avanço para o
     * próximo passo, sem tocar no R2.
     */
    function handleSubmit(e: React.FormEvent<HTMLFormElement>): void {
        if (!hasStagedKey) return;
        const form = e.currentTarget;
        const input = form.querySelector<HTMLInputElement>("input[name='foto']");
        if (input && (input.files?.length ?? 0) === 0) {
            // Avança sem reenviar.
            e.preventDefault();
            router.push(nextPath);
        }
    }

    return (
        <form
            action={formAction}
            onSubmit={handleSubmit}
            className="flex flex-col gap-5"
            noValidate
        >
            <AvatarUpload
                name="foto"
                accept="image/jpeg,image/png,image/webp"
                error={Boolean(state.error)}
                errorMessage={state.error}
                hint={
                    hasStagedKey
                        ? "Foto enviada. Clique para trocar ou continue."
                        : "JPEG, PNG ou WEBP até 10 MB."
                }
                required={!hasStagedKey}
                initialPreviewUrl={initialPreviewUrl}
            />

            <div className="flex w-full items-center justify-between gap-3">
                {previousPath !== null ? (
                    <Link
                        href={previousPath}
                        className="text-xs font-medium text-text-secondary hover:text-text-primary"
                    >
                        Voltar
                    </Link>
                ) : (
                    <span />
                )}
                <Button type="submit" loading={pending}>
                    {pending ? "Enviando." : "Continuar"}
                </Button>
            </div>
        </form>
    );
}
