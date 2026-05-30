"use client";

import * as React from "react";

/**
 * Componente "fantasma" que dispara um POST pra
 * `/api/acompanhantes/[slug]/view` no mount, registrando a
 * visualização pública e gravando o cookie de cooldown HTTP-only.
 *
 * # Por que não fazer isso no RSC?
 *
 * O Next 15 proíbe `cookies().set()` durante o render de RSC. Como a
 * gravação do cooldown depende de cookie HTTP-only, a única opção
 * legal é em Route Handler ou Server Action. Optamos por Route
 * Handler chamado pelo client porque o tracker é "fire and forget" —
 * não bloqueia render.
 *
 * Sem UI: render `null`. Roda apenas uma vez por mount (StrictMode
 * e remontagens são protegidos por `useRef`).
 */
export interface ViewTrackerProps {
    slug: string;
}

export function ViewTracker({ slug }: ViewTrackerProps): null {
    const fired = React.useRef(false);

    React.useEffect(() => {
        if (fired.current) return;
        fired.current = true;
        // Envia o referrer real do documento (a navegação que trouxe
        // o usuário até aqui) pra que o server classifique a origem
        // da visita (busca / home / direct / compartilhado). O
        // `Referer` HTTP do próprio fetch apontaria sempre pra esta
        // página, então mandamos no body.
        const referrer =
            typeof document !== "undefined" ? document.referrer : "";
        void fetch(
            `/api/acompanhantes/${encodeURIComponent(slug)}/view`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ referrer }),
            },
        ).catch(() => {
            // Silencioso — métrica não derruba UX.
        });
    }, [slug]);

    return null;
}
