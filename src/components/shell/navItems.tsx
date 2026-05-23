import * as React from "react";

import {
    EyeIcon,
    HomeIcon,
    PlayCircleIcon,
    UserIcon,
    UsersIcon,
} from "../icons";
import type { BottomNavItem } from "../primitives/BottomNav";

/**
 * Tipo de usuário para fins de navegação. `null` representa anônimo.
 *
 * Mantido neste módulo (e não em domínio) porque a UI de navegação só
 * precisa diferenciar três casos discretos. O mapeamento real para
 * `UserType` do Prisma é responsabilidade da camada de auth.
 */
export type NavUserType = "CLIENTE" | "ACOMPANHANTE" | null;

/**
 * Opções aceitas por {@link buildNavItems}.
 *
 * Refatorado para aceitar um objeto (em vez de positional `userType`)
 * porque a barra cresceu para depender do `identificador` do usuário
 * autenticado em alguns casos. Manter um único parâmetro nomeado
 * facilita adicionar mais opções sem quebrar consumidores.
 */
export interface BuildNavItemsOptions {
    userType: NavUserType;
    /**
     * `identificador` (`@`) do usuário autenticado, usado para montar
     * o link "Perfil público" da Acompanhante. Não-utilizado nos
     * outros casos.
     */
    identificador?: string;
}

/**
 * Constrói os itens do {@link BottomNav} adaptados ao `userType`
 * resolvido do request atual.
 *
 * # Cliente e anônimo
 *
 * Veem as 4 abas de descoberta + conta:
 *
 * - **Anônimo**: aba "Conta" vira "Entrar" e leva para `/login` (a
 *   página de login tem um link pra `/cadastro` quando o visitante
 *   ainda não tem conta).
 * - **Cliente**: aba "Conta" leva para `/cliente`.
 *
 * # Acompanhante
 *
 * Vê apenas 2 abas: **Conta** e **Perfil público**. As demais
 * (Início, Acompanhantes, Reels) são ocultadas porque a Acompanhante
 * autenticada não consome o feed do produto — quem consome é o
 * Cliente. As duas abas cobrem o uso real:
 *
 * - **Conta** (`/acompanhante`): painel privado de gestão.
 * - **Perfil público** (`/acompanhantes/<identificador>`): mesma
 *   visão que os Clientes têm — ferramenta de auto-revisão. Depende
 *   do `identificador` ser fornecido nas opções; se ausente, a aba
 *   é omitida defensivamente.
 */
export function buildNavItems(
    options: BuildNavItemsOptions | NavUserType,
): ReadonlyArray<BottomNavItem> {
    // Compatibilidade retroativa: aceita `userType` direto também.
    const opts: BuildNavItemsOptions =
        typeof options === "object" || options === null
            ? options !== null && "userType" in (options as object)
                ? (options as BuildNavItemsOptions)
                : { userType: options as NavUserType }
            : { userType: options };

    if (opts.userType === "ACOMPANHANTE") {
        return buildAcompanhanteItems(opts.identificador);
    }

    return buildPublicItems(opts.userType);
}

function buildAcompanhanteItems(
    identificador: string | undefined,
): ReadonlyArray<BottomNavItem> {
    // "Perfil público" sempre aparece, mesmo que a query do
    // identificador tenha falhado por algum motivo. Nesses casos
    // raros caímos no índice geral `/acompanhantes` em vez de
    // sumir com a aba — é menos confuso.
    const perfilHref = identificador
        ? `/acompanhantes/${identificador}`
        : "/acompanhantes";

    return [
        {
            href: perfilHref,
            label: "Perfil público",
            icon: <EyeIcon size={20} />,
        },
        {
            href: "/acompanhante",
            label: "Conta",
            icon: <UserIcon size={20} />,
        },
    ];
}

function buildPublicItems(
    userType: NavUserType,
): ReadonlyArray<BottomNavItem> {
    const accountItem: BottomNavItem =
        userType === "CLIENTE"
            ? {
                href: "/cliente",
                label: "Conta",
                icon: <UserIcon size={20} />,
            }
            : {
                href: "/login",
                label: "Entrar",
                icon: <UserIcon size={20} />,
                match: ["/login", "/cadastro"],
            };

    return [
        {
            href: "/",
            label: "Início",
            icon: <HomeIcon size={20} />,
        },
        {
            href: "/acompanhantes",
            label: "Acompanhantes",
            icon: <UsersIcon size={20} />,
        },
        {
            href: "/reels",
            label: "Reels",
            icon: <PlayCircleIcon size={20} />,
        },
        accountItem,
    ];
}
