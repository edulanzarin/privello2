"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type {
    GeoJSONSource,
    Map as MaplibreMap,
    StyleSpecification,
} from "maplibre-gl";

import "maplibre-gl/dist/maplibre-gl.css";

import { Button, EmptyState, MapPinIcon, UsersIcon } from "@/components";

/**
 * Pin serializado vindo de `/api/acompanhantes/mapa`.
 */
export interface MapaPin {
    identificador: string;
    nome: string;
    fotoUrl: string | null;
    lat: number;
    lng: number;
    planoExibicao: "BOOST" | "PREMIUM" | "BASICO";
    verificada: boolean;
}

/**
 * Mapa interativo da busca (T14).
 *
 * Usa Maplibre GL com tiles raster do OpenStreetMap (sem token) e
 * clustering nativo via GeoJSON source. Clicar num pin individual
 * navega pro perfil; clicar num cluster dá zoom.
 *
 * # Carregamento
 *
 * O `maplibre-gl` (~800KB) é importado dinamicamente só quando o
 * componente monta — não entra no bundle inicial da busca. O CSS é
 * importado estaticamente (Next bundla) pra respeitar a CSP (sem
 * `<link>` externo).
 *
 * # Privacidade
 *
 * As coordenadas vêm com jitter aplicado server-side (centroide do
 * bairro/cidade + ruído). O mapa nunca mostra endereço exato — é
 * uma vitrine aproximada de "quem atende nessa região".
 */
export interface BuscaMapaProps {
    /** Querystring atual (sem o `?`) pra repassar os filtros à API. */
    queryString: string;
}

// Centro aproximado do Brasil (fallback quando não há pins nem
// geolocalização) + zoom nacional.
const BRASIL_CENTER: [number, number] = [-51.9253, -14.235];
const BRASIL_ZOOM = 3.4;

export function BuscaMapa({ queryString }: BuscaMapaProps): React.ReactElement {
    const router = useRouter();
    const containerRef = React.useRef<HTMLDivElement | null>(null);
    const mapRef = React.useRef<MaplibreMap | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [erro, setErro] = React.useState<string | null>(null);
    const [vazio, setVazio] = React.useState(false);

    // ----------------------------------------------------------------
    // Boot do mapa (uma vez por mount / mudança de filtros).
    // ----------------------------------------------------------------
    React.useEffect(() => {
        let cancelado = false;
        let mapInstance: MaplibreMap | null = null;

        async function boot(): Promise<void> {
            try {
                const maplibre = await import("maplibre-gl");
                const MapCtor = maplibre.Map;

                if (cancelado || !containerRef.current) return;

                const map = new MapCtor({
                    container: containerRef.current,
                    style: rasterStyle(),
                    center: BRASIL_CENTER,
                    zoom: BRASIL_ZOOM,
                });
                mapInstance = map;
                mapRef.current = map;

                map.addControl(
                    new maplibre.NavigationControl({ showCompass: false }),
                    "top-right",
                );

                map.on("load", () => {
                    if (cancelado) return;
                    void carregarPins(map);
                });
            } catch {
                if (!cancelado) {
                    setErro("Não foi possível carregar o mapa.");
                    setLoading(false);
                }
            }
        }

        async function carregarPins(map: MaplibreMap): Promise<void> {
            try {
                const res = await fetch(
                    `/api/acompanhantes/mapa${queryString ? `?${queryString}` : ""}`,
                );
                const payload = (await res.json().catch(() => null)) as
                    | { ok: boolean; pins: MapaPin[] }
                    | null;
                if (cancelado) return;
                const pins = payload?.pins ?? [];
                if (pins.length === 0) {
                    setVazio(true);
                    setLoading(false);
                    return;
                }

                const maplibre = await import("maplibre-gl");

                map.addSource("perfis", {
                    type: "geojson",
                    data: {
                        type: "FeatureCollection",
                        features: pins.map((p) => ({
                            type: "Feature",
                            geometry: {
                                type: "Point",
                                coordinates: [p.lng, p.lat],
                            },
                            properties: {
                                slug: p.identificador,
                                nome: p.nome,
                            },
                        })),
                    },
                    cluster: true,
                    clusterMaxZoom: 13,
                    clusterRadius: 50,
                });

                map.addLayer({
                    id: "clusters",
                    type: "circle",
                    source: "perfis",
                    filter: ["has", "point_count"],
                    paint: {
                        "circle-color": "#ec7b5b",
                        "circle-opacity": 0.85,
                        "circle-radius": [
                            "step",
                            ["get", "point_count"],
                            18,
                            10,
                            24,
                            50,
                            32,
                        ],
                    },
                });
                map.addLayer({
                    id: "cluster-count",
                    type: "symbol",
                    source: "perfis",
                    filter: ["has", "point_count"],
                    layout: {
                        "text-field": ["get", "point_count_abbreviated"],
                        "text-size": 13,
                    },
                    paint: { "text-color": "#ffffff" },
                });
                map.addLayer({
                    id: "pin",
                    type: "circle",
                    source: "perfis",
                    filter: ["!", ["has", "point_count"]],
                    paint: {
                        "circle-color": "#c5523a",
                        "circle-radius": 8,
                        "circle-stroke-width": 2,
                        "circle-stroke-color": "#ffffff",
                    },
                });

                // Zoom ao clicar num cluster.
                map.on("click", "clusters", (e) => {
                    const features = map.queryRenderedFeatures(e.point, {
                        layers: ["clusters"],
                    });
                    const feature = features[0];
                    if (!feature) return;
                    const clusterId = feature.properties?.cluster_id as
                        | number
                        | undefined;
                    const source = map.getSource("perfis") as
                        | GeoJSONSource
                        | undefined;
                    if (clusterId == null || !source) return;
                    void source
                        .getClusterExpansionZoom(clusterId)
                        .then((zoom) => {
                            if (feature.geometry.type !== "Point") return;
                            map.easeTo({
                                center: feature.geometry.coordinates as [
                                    number,
                                    number,
                                ],
                                zoom,
                            });
                        })
                        .catch(() => undefined);
                });

                // Navega pro perfil ao clicar num pin.
                map.on("click", "pin", (e) => {
                    const slug = e.features?.[0]?.properties?.slug;
                    if (typeof slug === "string" && slug.length > 0) {
                        router.push(`/acompanhantes/${slug}`);
                    }
                });

                for (const layer of ["clusters", "pin"]) {
                    map.on("mouseenter", layer, () => {
                        map.getCanvas().style.cursor = "pointer";
                    });
                    map.on("mouseleave", layer, () => {
                        map.getCanvas().style.cursor = "";
                    });
                }

                // Enquadra os pins.
                const bounds = new maplibre.LngLatBounds();
                for (const p of pins) {
                    bounds.extend([p.lng, p.lat]);
                }
                if (!bounds.isEmpty()) {
                    map.fitBounds(bounds, { padding: 64, maxZoom: 13 });
                }

                setLoading(false);
            } catch {
                if (!cancelado) {
                    setErro("Não foi possível carregar os perfis no mapa.");
                    setLoading(false);
                }
            }
        }

        void boot();

        return () => {
            cancelado = true;
            if (mapInstance) mapInstance.remove();
            mapRef.current = null;
        };
    }, [queryString, router]);

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
                aria-label="Mapa de perfis"
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
                        description="Ainda não há perfis geolocalizados para estes filtros. Tente a visão em lista."
                    />
                </div>
            ) : null}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Estilo raster OSM (sem token).
// ---------------------------------------------------------------------------

function rasterStyle(): StyleSpecification {
    return {
        version: 8,
        sources: {
            osm: {
                type: "raster",
                tiles: [
                    "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
                    "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
                    "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png",
                ],
                tileSize: 256,
                attribution: "© OpenStreetMap",
            },
        },
        layers: [
            {
                id: "osm",
                type: "raster",
                source: "osm",
            },
        ],
    };
}
