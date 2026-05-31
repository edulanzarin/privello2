"use client";

import * as React from "react";
import type {
    Map as MaplibreMap,
    Marker as MaplibreMarker,
} from "maplibre-gl";

import "maplibre-gl/dist/maplibre-gl.css";

import { Button, EmptyState, MapPinIcon, UsersIcon } from "@/components";

import {
    BRASIL_CENTER,
    BRASIL_ZOOM,
    loadMaplibre,
    rasterStyle,
    resolveMaplibreModule,
    type MaplibreModule,
} from "./mapaCore";

// Re-export pra compat com o teste unit (tests/unit/maplibre-interop).
export { resolveMaplibreModule };

/**
 * Agregado por bairro vindo de `/api/acompanhantes/mapa`.
 */
export interface MapaBairro {
    label: string;
    lat: number;
    lng: number;
    count: number;
    cidadeFallback: boolean;
}

/**
 * Mapa da busca (T14) — agregação por bairro.
 *
 * Em vez de mostrar um ponto por perfil (o que sugeriria endereço
 * exato — as Acompanhantes não informam rua), o mapa mostra **um
 * marcador por bairro com a contagem**: "3 na Água Verde", "2 na
 * Velha", etc. Perfis sem bairro caem no centro da cidade.
 *
 * Os marcadores NÃO são clicáveis (não navegam pra perfil) — o mapa
 * é só uma leitura visual de "onde tem mais gente atendendo". A
 * busca em si (clicar em perfil) é a visão em Lista.
 *
 * # Carregamento
 *
 * `maplibre-gl` (~800KB) é importado dinamicamente só quando o
 * componente monta — não entra no bundle inicial da busca. O CSS é
 * importado estaticamente (Next bundla) pra respeitar a CSP.
 */
export interface BuscaMapaProps {
    /** Querystring atual (sem o `?`) pra repassar os filtros à API. */
    queryString: string;
    /**
     * Chamado quando o usuário clica num bairro do mapa. Recebe o
     * label do bairro (ou `null` quando é o fallback de centro da
     * cidade — não filtra por bairro nesse caso). O caller filtra
     * a lista por esse bairro.
     */
    onBairroClick?: (bairro: string | null, cidadeFallback: boolean) => void;
    /** Bairro atualmente selecionado (pra destacar no mapa). */
    bairroSelecionado?: string | null;
}

// Centro/zoom nacional + interop do maplibre vêm de `./mapaCore`.

// Zoom máximo: nível de bairro/região. Nunca rua.
const MAX_ZOOM = 14;

export function BuscaMapa({
    queryString,
    onBairroClick,
    bairroSelecionado,
}: BuscaMapaProps): React.ReactElement {
    const containerRef = React.useRef<HTMLDivElement | null>(null);
    const mapRef = React.useRef<MaplibreMap | null>(null);
    const markersRef = React.useRef<MaplibreMarker[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [erro, setErro] = React.useState<string | null>(null);
    const [vazio, setVazio] = React.useState(false);

    // Ref pro callback + bairro selecionado, pra que o handler de
    // clique (registrado uma vez no boot) sempre veja o valor atual
    // sem precisar re-montar o mapa.
    const onBairroClickRef = React.useRef(onBairroClick);
    const bairroSelecionadoRef = React.useRef(bairroSelecionado);
    React.useEffect(() => {
        onBairroClickRef.current = onBairroClick;
        bairroSelecionadoRef.current = bairroSelecionado;
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
                    void carregarBairros(map, maplibre);
                });
            } catch (err) {
                if (!cancelado) {
                    console.error("[BuscaMapa] falha ao iniciar o mapa", err);
                    setErro("Não foi possível carregar o mapa.");
                    setLoading(false);
                }
            }
        }

        async function carregarBairros(
            map: MaplibreMap,
            maplibre: MaplibreModule,
        ): Promise<void> {
            try {
                const res = await fetch(
                    `/api/acompanhantes/mapa${queryString ? `?${queryString}` : ""}`,
                );
                const payload = (await res.json().catch(() => null)) as
                    | { ok: boolean; bairros: MapaBairro[] }
                    | null;
                if (cancelado) return;
                const bairros = payload?.bairros ?? [];
                if (bairros.length === 0) {
                    setVazio(true);
                    setLoading(false);
                    return;
                }

                // Marcador HTML custom por bairro: pílula com a
                // contagem + label. Clicável → filtra a lista por
                // aquele bairro.
                const bounds = new maplibre.LngLatBounds();
                for (const b of bairros) {
                    const selecionado =
                        !b.cidadeFallback &&
                        bairroSelecionadoRef.current != null &&
                        b.label.toLowerCase() ===
                            bairroSelecionadoRef.current.toLowerCase();
                    const el = construirMarcador(b, selecionado);
                    // Clique filtra (exceto fallback de cidade, que
                    // não representa um bairro específico).
                    if (!b.cidadeFallback) {
                        el.style.cursor = "pointer";
                        el.addEventListener("click", () => {
                            onBairroClickRef.current?.(b.label, false);
                        });
                    }
                    const marker = new maplibre.Marker({
                        element: el,
                        anchor: "bottom",
                    })
                        .setLngLat([b.lng, b.lat])
                        .addTo(map);
                    markersRef.current.push(marker);
                    bounds.extend([b.lng, b.lat]);
                }

                if (!bounds.isEmpty()) {
                    map.fitBounds(bounds, { padding: 72, maxZoom: 12 });
                }
                setLoading(false);
            } catch {
                if (!cancelado) {
                    setErro("Não foi possível carregar os bairros no mapa.");
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

    // ----------------------------------------------------------------
    // Geolocalização ("usar minha localização")
    // ----------------------------------------------------------------
    function usarMinhaLocalizacao(): void {
        if (typeof navigator === "undefined" || !navigator.geolocation) {
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const map = mapRef.current;
                if (!map) return;
                map.easeTo({
                    center: [pos.coords.longitude, pos.coords.latitude],
                    zoom: 12,
                });
            },
            () => {
                // Permissão negada / indisponível — silencioso.
            },
            { enableHighAccuracy: false, timeout: 8000 },
        );
    }

    return (
        <div className="relative">
            <div
                ref={containerRef}
                className="h-[28rem] w-full overflow-hidden rounded-2xl bg-neutral-100 ring-1 ring-border sm:h-[34rem]"
                aria-label="Mapa de bairros"
            />

            {/* Botão "usar minha localização" sobreposto. */}
            <div className="absolute left-3 top-3 z-10">
                <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={usarMinhaLocalizacao}
                >
                    <MapPinIcon size={14} />
                    Minha localização
                </Button>
            </div>

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
                        title="Nenhum perfil no mapa"
                        description="Ainda não há perfis localizados para estes filtros. Tente a visão em lista."
                    />
                </div>
            ) : null}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Marcador HTML por bairro (pílula: número + nome).
// ---------------------------------------------------------------------------

/**
 * Constrói o elemento DOM do marcador de um bairro. Estilo inline
 * (sem Tailwind aqui porque o elemento vive fora da árvore React,
 * dentro do canvas do maplibre). Bairros (não-fallback) são
 * clicáveis pra filtrar a lista; o `selecionado` destaca o bairro
 * filtrado no momento.
 */
function construirMarcador(b: MapaBairro, selecionado: boolean): HTMLElement {
    const wrap = document.createElement("div");
    wrap.style.display = "flex";
    wrap.style.alignItems = "center";
    wrap.style.gap = "6px";
    wrap.style.padding = "4px 10px 4px 4px";
    wrap.style.borderRadius = "9999px";
    wrap.style.background = selecionado
        ? "linear-gradient(135deg, #ec7b5b 0%, #c5523a 100%)"
        : "rgba(255,255,255,0.96)";
    wrap.style.boxShadow = selecionado
        ? "0 6px 18px -4px rgba(197,82,58,0.55)"
        : "0 4px 14px -4px rgba(0,0,0,0.3)";
    wrap.style.border = selecionado
        ? "1px solid rgba(255,255,255,0.7)"
        : "1px solid rgba(197,82,58,0.25)";
    wrap.style.fontFamily = "var(--font-inter, sans-serif)";
    wrap.style.cursor = "default";
    wrap.style.userSelect = "none";
    wrap.style.transition = "transform 0.12s ease";

    const badge = document.createElement("span");
    badge.textContent = String(b.count);
    badge.style.display = "inline-flex";
    badge.style.alignItems = "center";
    badge.style.justifyContent = "center";
    badge.style.minWidth = "26px";
    badge.style.height = "26px";
    badge.style.padding = "0 6px";
    badge.style.borderRadius = "9999px";
    badge.style.background = selecionado
        ? "rgba(255,255,255,0.95)"
        : "linear-gradient(135deg, #ec7b5b 0%, #c5523a 100%)";
    badge.style.color = selecionado ? "#c5523a" : "#fff";
    badge.style.fontSize = "13px";
    badge.style.fontWeight = "700";
    badge.style.lineHeight = "1";

    const label = document.createElement("span");
    const sufixo = b.cidadeFallback ? " (centro)" : "";
    label.textContent = `${b.label}${sufixo}`;
    label.style.fontSize = "12px";
    label.style.fontWeight = "600";
    label.style.color = selecionado ? "#fff" : "#3a2a25";
    label.style.maxWidth = "150px";
    label.style.whiteSpace = "nowrap";
    label.style.overflow = "hidden";
    label.style.textOverflow = "ellipsis";

    const plural = b.count === 1 ? "perfil" : "perfis";
    wrap.setAttribute(
        "aria-label",
        `${b.count} ${plural} em ${b.label}${
            b.cidadeFallback ? " (centro da cidade)" : ""
        }`,
    );

    wrap.appendChild(badge);
    wrap.appendChild(label);
    return wrap;
}

// ---------------------------------------------------------------------------
// Estilo raster OSM (sem token).
// ---------------------------------------------------------------------------
