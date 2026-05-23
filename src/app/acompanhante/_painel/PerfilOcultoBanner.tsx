"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Button, EyeOffIcon, InlineAlert } from "@/components";

/**
 * Banner persistente exibido no topo do painel privado da Acompanhante
 * quando o perfil está oculto. Recém-cadastradas começam com o perfil
 * desligado (`perfilVisivel: false` por default no `finalizar`),
 * para que possam configurar mídias, áudio, valores etc. antes de
 * aparecer nas buscas.
 *
 * O banner some assim que o perfil é ativado. Como a visibilidade
 * também tem um Switch dedicado em `ConfiguracoesTab`, este componente
 * é apenas um atalho — não é a única via para ligar o perfil. Mas
 * fica visível em todas as abas, então a Acompanhante não precisa
 * "descobrir" a aba Configurações pra publicar.
 *
 * Reutiliza o endpoint `POST /api/acompanhante/visibilidade` (mesmo
 * usado pelo Switch em ConfiguracoesTab) com `{ visivel: true }`,
 * mantendo uma única fonte de verdade pra mutação. Em sucesso, chama
 * `router.refresh()` para que o RSC drag o novo valor de `perfilVisivel`
 * e o banner suma sem nenhum trabalho de estado local extra.
 */
export interface PerfilOcultoBannerProps {
    /**
     * Flag persistida do `AcompanhanteProfile`. Quando `true`, o
     * banner não renderiza. Quando `false`, aparece com CTA de
     * ativação. Vindo do RSC (page.tsx), portanto sempre fresh.
     */
    perfilVisivel: boolean;
}

export function PerfilOcultoBanner({
    perfilVisivel,
}: PerfilOcultoBannerProps): React.ReactElement | null {
    const router = useRouter();
    const [pending, setPending] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    if (perfilVisivel) return null;

    async function ativar(): Promise<void> {
        if (pending) return;
        setPending(true);
        setError(null);
        try {
            const res = await fetch("/api/acompanhante/visibilidade", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ visivel: true }),
            });
            if (!res.ok) {
                setError("Não foi possível ativar agora. Tente novamente.");
                return;
            }
            router.refresh();
        } catch {
            setError("Falha de rede. Tente novamente.");
        } finally {
            setPending(false);
        }
    }

    return (
        <InlineAlert
            tone="warning"
            icon={<EyeOffIcon size={14} />}
            action={
                <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    loading={pending}
                    onClick={() => void ativar()}
                >
                    Ativar
                </Button>
            }
        >
            <span className="font-medium">Perfil oculto.</span>{" "}
            <span>
                Ele não aparece nas buscas. Ative quando estiver tudo
                pronto.
            </span>
            {error !== null ? (
                <span className="mt-1 block text-danger-700">{error}</span>
            ) : null}
        </InlineAlert>
    );
}
