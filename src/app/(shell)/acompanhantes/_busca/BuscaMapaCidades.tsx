"use client";

import * as React from "react";
import type {
    Map as MaplibreMap,
    Marker as MaplibreMarker,
} from "maplibre-gl";

import "maplibre-gl/dist/maplibre-gl.css";

import { EmptyState, MapPinIcon, UsersIcon } from "@/components";

import {
    BRASIL_CENTER,
    BRASIL_ZOOM,
    loadMaplibre,
    rasterStyle,
    type MaplibreModule,
} from "./mapaCore";

/**
 * Agregado por cidade vindo de `/api/acompanhantes/mapa-cidades`.
 */
export interface MapaCidade {
    cidadeNome: string;
    estadoSigla: string;
    lat: number;
    lng: number;
    count: number;
}

/**
 * Mapa nacional de cidades — exibido na busca quando o visitante
 * ainda NÃO escolheu cidade. Mostra um marcador por cidade com a
 * contagem de perfis ativos; clicar numa cidade filtra a busca por
 * ela (o caller navega).
 *
 * Mesma stack do {@link BuscaMapa} (maplibre dinâmico + raster OSM),
 * via `mapaCore`. Aqui o zoom máximo é menor (nível de cidade) e os
 * marcadores carregam cidade/UF.
 */
export interface BuscaMapaCidadesProps {
    /** Querystring de filtros não-geográficos (sem o `?`). */
    queryString: string;
    /** Chamado ao clicar numa cidade — o caller navega/filtra. */
    onCidadeClick: (cidadeNome: string, estadoSigla: string) => void;
}

// Zoom máximo no mapa nacional: nível de cidade, nunca rua.
const MAX_ZOOM = 11;

export function BuscaMapaCidades({
    queryString,
    onCidadeClick,
}: BuscaMapaCidadesProps): React.ReactElement {
    const containerRef = React.useRef<HTMLDivElement | null>(null);
    const mapRef = React.useRef<MaplibreMap | null>(null);
    const markersRef = React.useRef<MaplibreMarker[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [erro, setErro] = React.useState<string | null>(null);
    const [vazio, setVazio] = React.useState(false);

    const onCidadeClickRef = React.useRef(onCidadeClick);
    React.useEffect(() => {
        onCidadeClickRef.current = onCidadeClick;
    });

    React.useEffect(() => {
        let cancelado = false;
        let mapInstance: MaplibreMap | null = null;

        async function boot(): Promise<void> {
            try {
                const maplibre = await loadMaplibre();
                if (cancelado || !containerRef.current) return;

                const map = new maplibre.Map({
                    container: containerRef.current,
                    style: rasterStyle(),
                    center: BRASIL_CENTER,
                    zoom: BRASIL_ZOOM,
                    maxZoom: MAX_ZOOM,
                });
                mapInstance = map;
                mapRef.current = map;

                map.addControl(
                    new maplibre.NavigationControl({ showCompass: false }),
                    "top-right",
                );

                map.on("load", () => {
                    if (cancelado) return;
                    void carregarCidades(map, maplibre);
                });
            } catch (err) {
                if (!cancelado) {
                    console.error(
                        "[BuscaMapaCidades] falha ao iniciar o mapa",
                        err,
                    );
                    setErro("Não foi possível carregar o mapa.");
                    setLoading(false);
                }
            }
        }

        async function carregarCidades(
            map: MaplibreMap,
            maplibre: MaplibreModule,
        ): Promise<void> {
            try {
                const res = await fetch(
                    `/api/acompanhantes/mapa-cidades${
                        queryString ? `?${queryString}` : ""
                    }`,
                );
                const payload = (await res.json().catch(() => null)) as
                    | { ok: boolean; cidades: MapaCidade[] }
                    | null;
                if (cancelado) return;
                const cidades = payload?.cidades ?? [];
                if (cidades.length === 0) {
                    setVazio(true);
                    setLoading(false);
                    return;
                }

                const bounds = new maplibre.LngLatBounds();
                for (const c of cidades) {
                    const el = construirMarcadorCidade(c);
                    el.style.cursor = "pointer";
                    el.addEventListener("click", () => {
                        onCidadeClickRef.current(c.cidadeNome, c.estadoSigla);
                    });
                    const marker = new maplibre.Marker({
                        element: el,
                        anchor: "bottom",
                    })
                        .setLngLat([c.lng, c.lat])
                        .addTo(map);
                    markersRef.current.push(marker);
                    bounds.extend([c.lng, c.lat]);
                }

                if (!bounds.isEmpty()) {
                    map.fitBounds(bounds, { padding: 64, maxZoom: 9 });
                }
                setLoading(false);
            } catch {
                if (!cancelado) {
                    setErro("Não foi possível carregar as cidades no mapa.");
                    setLoading(false);
                }
            }
        }

        void boot();

        return () => {
            cancelado = true;
            for (const m of markersRef.current) m.remove();
            markersRef.current = [];
            if (mapInstance) mapInstance.remove();
            mapRef.current = null;
        };
    }, [queryString]);

    return (
        <div className="relative">
            <div
                ref={containerRef}
                className="h-[24rem] w-full overflow-hidden rounded-2xl bg-neutral-100 ring-1 ring-border sm:h-[30rem]"
                aria-label="Mapa de cidades"
            />

            {loading && !erro && !vazio ? (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <span className="rounded-full bg-surface/90 px-4 py-2 text-sm text-text-secondary shadow-sm">
                        Carregando mapa…
                    </span>
                </div>
            ) : null}

            {erro ? (
                <div className="absolute inset-0 flex items-center justify-center p-6">
                    <EmptyState
                        size="sm"
                        icon={<MapPinIcon size={20} />}
                        title="Mapa indisponível"
                        description={erro}
                    />
                </div>
            ) : null}

            {vazio && !erro ? (
                <div className="absolute inset-0 flex items-center justify-center p-6">
                    <EmptyState
                        size="sm"
                        icon={<UsersIcon size={20} />}
                        title="Nenhuma cidade no mapa"
                        description="Ainda não há perfis localizados. Use a busca por nome da cidade acima."
                    />
                </div>
            ) : null}
        </div>
    );
}

/**
 * Marcador de cidade: pílula com contagem + "Cidade/UF". Estilo
 * inline (vive fora da árvore React, dentro do canvas do maplibre).
 */
function construirMarcadorCidade(c: MapaCidade): HTMLElement {
    const wrap = document.createElement("div");
    wrap.style.display = "flex";
    wrap.style.alignItems = "center";
    wrap.style.gap = "6px";
    wrap.style.padding = "4px 10px 4px 4px";
    wrap.style.borderRadius = "9999px";
    wrap.style.background = "rgba(255,255,255,0.96)";
    wrap.style.boxShadow = "0 4px 14px -4px rgba(0,0,0,0.3)";
    wrap.style.border = "1px solid rgba(197,82,58,0.25)";
    wrap.style.fontFamily = "var(--font-inter, sans-serif)";
    wrap.style.userSelect = "none";
    wrap.style.transition = "transform 0.12s ease";

    const badge = document.createElement("span");
    badge.textContent = String(c.count);
    badge.style.display = "inline-flex";
    badge.style.alignItems = "center";
    badge.style.justifyContent = "center";
    badge.style.minWidth = "26px";
    badge.style.height = "26px";
    badge.style.padding = "0 6px";
    badge.style.borderRadius = "9999px";
    badge.style.background = "linear-gradient(135deg, #ec7b5b 0%, #c5523a 100%)";
    badge.style.color = "#fff";
    badge.style.fontSize = "13px";
    badge.style.fontWeight = "700";
    badge.style.lineHeight = "1";

    const label = document.createElement("span");
    label.textContent = `${c.cidadeNome}/${c.estadoSigla}`;
    label.style.fontSize = "12px";
    label.style.fontWeight = "600";
    label.style.color = "#3a2a25";
    label.style.maxWidth = "160px";
    label.style.whiteSpace = "nowrap";
    label.style.overflow = "hidden";
    label.style.textOverflow = "ellipsis";

    const plural = c.count === 1 ? "perfil" : "perfis";
    wrap.setAttribute(
        "aria-label",
        `${c.count} ${plural} em ${c.cidadeNome}, ${c.estadoSigla}. Clique pra filtrar.`,
    );

    wrap.appendChild(badge);
    wrap.appendChild(label);
    return wrap;
}
