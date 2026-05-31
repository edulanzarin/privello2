"use client";

import * as React from "react";
import Link from "next/link";

import {
    Button,
    Card,
    ConfirmDialog,
    EmptyState,
    SearchIcon,
    TrashIcon,
    useModal,
    useToast,
} from "@/components";

import { buscaFiltrosParaHref } from "@/domain/busca/queryParams";
import type { SavedSearchItem } from "@/server/saved-search";

/**
 * Aba "Buscas salvas" do painel do Cliente (V3).
 *
 * Lista as buscas que o Cliente salvou na `/acompanhantes`. Cada
 * card mostra o rótulo amigável + um botão "Abrir busca" (recria
 * a URL com os mesmos filtros) e "Excluir". Quando surge um perfil
 * novo que casa com uma busca salva, o Cliente recebe alerta
 * in-site (sininho — reusa V2).
 *
 * Recebe a lista inicial do RSC e mantém estado local pra refletir
 * exclusões sem recarregar a página inteira.
 */
export interface BuscasSalvasTabProps {
    buscas: ReadonlyArray<SavedSearchItem>;
}

export function BuscasSalvasTab({
    buscas: iniciais,
}: BuscasSalvasTabProps): React.ReactElement {
    const [buscas, setBuscas] = React.useState(iniciais);

    function remover(id: string): void {
        setBuscas((prev) => prev.filter((b) => b.id !== id));
    }

    if (buscas.length === 0) {
        return (
            <EmptyState
                icon={<SearchIcon size={20} />}
                title="Nenhuma busca salva"
                description="Na busca, ajuste cidade e filtros e toque em “Salvar busca”. A gente te avisa aqui quando surgir um perfil novo que combina."
            />
        );
    }

    return (
        <div className="flex flex-col gap-3">
            {buscas.map((b) => (
                <BuscaSalvaCard key={b.id} busca={b} onRemoved={remover} />
            ))}
        </div>
    );
}

function BuscaSalvaCard({
    busca,
    onRemoved,
}: {
    busca: SavedSearchItem;
    onRemoved: (id: string) => void;
}): React.ReactElement {
    const toast = useToast();
    const dialog = useModal();
    const [excluindo, setExcluindo] = React.useState(false);

    async function excluir(): Promise<void> {
        setExcluindo(true);
        try {
            const res = await fetch(`/api/saved-searches/${busca.id}`, {
                method: "DELETE",
            });
            if (res.ok) {
                dialog.close();
                onRemoved(busca.id);
                toast.success("Busca removida.");
            } else {
                toast.danger("Não foi possível remover. Tente de novo.");
            }
        } catch {
            toast.danger("Falha de rede. Tente novamente.");
        } finally {
            setExcluindo(false);
        }
    }

    return (
        <Card>
            <div className="flex items-center gap-3">
                <span
                    aria-hidden="true"
                    className="inline-flex h-9 w-9 flex-none items-center justify-center rounded-full bg-[#ec7b5b]/12 text-[color:var(--accent-deep)]"
                >
                    <SearchIcon size={16} />
                </span>
                <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-text-primary">
                        {busca.label}
                    </p>
                    <p className="text-xs text-text-secondary">
                        Salva em{" "}
                        {new Date(busca.criadoEm).toLocaleDateString("pt-BR")}
                    </p>
                </div>
                <div className="flex flex-none items-center gap-2">
                    <Link href={buscaFiltrosParaHref(busca.filtros)}>
                        <Button type="button" variant="ghost" size="sm">
                            Abrir
                        </Button>
                    </Link>
                    <button
                        type="button"
                        onClick={dialog.open}
                        aria-label="Excluir busca salva"
                        className="flex h-8 w-8 items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-danger-50 hover:text-danger-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-danger-500/30"
                    >
                        <TrashIcon size={15} />
                    </button>
                </div>
            </div>

            <ConfirmDialog
                open={dialog.isOpen}
                onClose={dialog.close}
                onConfirm={excluir}
                title="Excluir busca salva"
                description="Você deixará de receber alertas dessa busca. Pode salvar de novo quando quiser."
                tone="danger"
                confirmLabel="Excluir"
                loading={excluindo}
            />
        </Card>
    );
}
