"use client";

/**
 * "Vistos recentemente" (W1) — histórico local dos últimos perfis
 * que o usuário abriu. Persistido só no `localStorage` do browser
 * (privacidade: o servidor nunca sabe o histórico de navegação de
 * quem está só olhando). Sem PII — guarda apenas dados públicos do
 * card (slug, nome, foto, cidade).
 *
 * Cap em {@link MAX_ITEMS} itens, dedupe por `identificador`, mais
 * recentes primeiro.
 */

import * as React from "react";

const STORAGE_KEY = "privello:vistos-recentemente";
const MAX_ITEMS = 12;

/**
 * Item do histórico — espelha o mínimo público pra renderizar um
 * card sem ida ao servidor.
 */
export interface PerfilVisto {
    identificador: string;
    nome: string;
    fotoUrl: string | null;
    cidadeNome: string;
    estadoSigla: string;
    verificada: boolean;
    /** Epoch ms de quando foi visto (pra ordenar/expirar no futuro). */
    vistoEm: number;
}

function ler(): PerfilVisto[] {
    if (typeof window === "undefined") return [];
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw) as unknown;
        if (!Array.isArray(parsed)) return [];
        // Filtra entradas malformadas (defesa contra dados antigos).
        return parsed.filter(
            (x): x is PerfilVisto =>
                typeof x === "object" &&
                x !== null &&
                typeof (x as PerfilVisto).identificador === "string" &&
                typeof (x as PerfilVisto).nome === "string",
        );
    } catch {
        return [];
    }
}

function escrever(items: ReadonlyArray<PerfilVisto>): void {
    if (typeof window === "undefined") return;
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
        // quota/modo privado — ignora.
    }
}

/**
 * Registra um perfil como "visto agora". Move pro topo (dedupe por
 * `identificador`) e corta no cap. Idempotente por chamada.
 */
export function registrarVisto(
    perfil: Omit<PerfilVisto, "vistoEm">,
): void {
    const atual = ler().filter(
        (p) => p.identificador !== perfil.identificador,
    );
    const novo: PerfilVisto = { ...perfil, vistoEm: Date.now() };
    escrever([novo, ...atual].slice(0, MAX_ITEMS));
}

/**
 * Hook que lê o histórico no mount (client-only). Retorna lista
 * ordenada (mais recente primeiro) e um `limpar()`. Renderiza
 * vazio no SSR/primeiro paint pra evitar mismatch de hidratação.
 */
export function useVistosRecentemente(): {
    vistos: ReadonlyArray<PerfilVisto>;
    limpar: () => void;
} {
    const [vistos, setVistos] = React.useState<ReadonlyArray<PerfilVisto>>([]);

    React.useEffect(() => {
        setVistos(ler());
    }, []);

    const limpar = React.useCallback(() => {
        escrever([]);
        setVistos([]);
    }, []);

    return { vistos, limpar };
}
