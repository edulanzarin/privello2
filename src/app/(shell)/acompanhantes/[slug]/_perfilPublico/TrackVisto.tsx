"use client";

import * as React from "react";

import { registrarVisto, type PerfilVisto } from "@/lib/recentlyViewed";

/**
 * Componente invisível que registra o perfil atual em "vistos
 * recentemente" (W1) ao montar no browser. Não renderiza nada.
 *
 * Fica no perfil público — quando o visitante abre `/acompanhantes/
 * [slug]`, grava os dados públicos do card no localStorage pra o
 * rail "Vistos recentemente" do painel do Cliente.
 */
export function TrackVisto(props: Omit<PerfilVisto, "vistoEm">): null {
    React.useEffect(() => {
        registrarVisto(props);
        // Registra uma vez por montagem por slug — props estáveis
        // dentro de uma página.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [props.identificador]);
    return null;
}
