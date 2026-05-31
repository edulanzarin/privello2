"use client";

import type {
    LngLatBounds as MaplibreLngLatBounds,
    Map as MaplibreMap,
    MapOptions,
    Marker as MaplibreMarker,
    NavigationControl as MaplibreNavigationControl,
    StyleSpecification,
} from "maplibre-gl";

/**
 * Núcleo compartilhado dos mapas da busca (T14 + mapa de cidades).
 *
 * Centraliza o interop ESM/CJS do `maplibre-gl`, o carregamento
 * dinâmico e o estilo raster OSM — usado tanto pelo mapa de bairros
 * (`BuscaMapa`) quanto pelo mapa nacional de cidades
 * (`BuscaMapaCidades`). Evita duplicar a parte chata.
 */

export interface MaplibreModule {
    Map: new (opts: MapOptions) => MaplibreMap;
    NavigationControl: new (opts?: {
        showCompass?: boolean;
    }) => MaplibreNavigationControl;
    LngLatBounds: new () => MaplibreLngLatBounds;
    Marker: new (opts?: {
        element?: HTMLElement;
        anchor?: string;
    }) => MaplibreMarker;
}

/**
 * Resolve o módulo do maplibre lidando com os dois shapes de
 * interop (named na raiz OU aninhado em `.default`). Pura e
 * testável.
 */
export function resolveMaplibreModule(mod: unknown): MaplibreModule {
    const root = mod as { Map?: unknown; default?: unknown } | null;
    if (root && typeof root.Map === "function") {
        return root as unknown as MaplibreModule;
    }
    const inner = root?.default as { Map?: unknown } | undefined;
    if (inner && typeof inner.Map === "function") {
        return inner as unknown as MaplibreModule;
    }
    throw new Error("maplibre-gl: export 'Map' não encontrado.");
}

/**
 * Importa o maplibre dinamicamente (fora do bundle inicial) e
 * resolve o shape do módulo.
 */
export async function loadMaplibre(): Promise<MaplibreModule> {
    const mod = await import("maplibre-gl");
    return resolveMaplibreModule(mod);
}

/**
 * Estilo raster OSM (sem token de provedor). Tiles públicos do
 * OpenStreetMap — já liberados na CSP (`next.config.ts`).
 */
export function rasterStyle(): StyleSpecification {
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
        layers: [{ id: "osm", type: "raster", source: "osm" }],
    };
}

/** Centro aproximado do Brasil + zoom nacional. */
export const BRASIL_CENTER: [number, number] = [-51.9253, -14.235];
export const BRASIL_ZOOM = 3.4;
