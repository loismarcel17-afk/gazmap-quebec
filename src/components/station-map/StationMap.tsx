"use client";

import type { Feature, FeatureCollection, Point, Polygon } from "geojson";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useMemo, useRef, useState } from "react";
import MapView, {
  AttributionControl,
  Layer,
  Marker,
  NavigationControl,
  Popup,
  Source,
  type MapEvent,
  type MapLayerMouseEvent,
  type MapRef,
} from "react-map-gl/maplibre";
import { boundsAround, circleRing, type LatLng } from "@/features/geo/geo";
import type { PriceScale } from "@/features/stations/price-scale";
import type { FuelType, Station } from "@/features/stations/types";
import { formatPrice } from "@/lib/format";
import { t } from "@/lib/i18n";
import { MAP_STYLE_URL, QUEBEC_BOUNDS } from "@/lib/map";
import "@/lib/maplibre-worker";
import {
  HIT_LAYER_ID,
  SOURCE_ID,
  STATIONS_LAYER_ID,
  hitLayer,
  radiusFillLayer,
  radiusLineLayer,
  selectedLayer,
  stationsLayer,
} from "./layers";

/** Which station is selected, and where the click came from. */
export interface Selection {
  id: string;
  /** "list": move the map to the station. "map": it's already on screen, don't move. */
  from: "map" | "list";
}

interface StationMapProps {
  stations: Station[];
  fuel: FuelType;
  scale: PriceScale;
  selection: Selection | null;
  onSelect: (id: string | null) => void;
  origin: LatLng | null;
  radiusMeters: number;
}

interface FeatureProps {
  id: string;
  price: number;
}

export default function StationMap({
  stations,
  fuel,
  scale,
  selection,
  onSelect,
  origin,
  radiusMeters,
}: StationMapProps) {
  // A ref gives access to the MapLibre map itself, to move the camera from code.
  const mapRef = useRef<MapRef>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Rebuilt only when the stations or the fuel change, not on every render.
  const geojson = useMemo<FeatureCollection<Point, FeatureProps>>(
    () => ({
      type: "FeatureCollection",
      features: stations.flatMap((station) => {
        const price = station.prices[fuel];
        // Stations that don't sell this fuel aren't drawn.
        if (price === null) return [];
        return [
          {
            type: "Feature",
            geometry: { type: "Point", coordinates: [station.lng, station.lat] },
            properties: { id: station.id, price },
          },
        ];
      }),
    }),
    [stations, fuel],
  );

  const radiusShape = useMemo<Feature<Polygon> | null>(
    () =>
      origin && {
        type: "Feature",
        geometry: { type: "Polygon", coordinates: [circleRing(origin, radiusMeters)] },
        properties: {},
      },
    [origin, radiusMeters],
  );

  const stationsById = useMemo(
    () => new Map(stations.map((station) => [station.id, station])),
    [stations],
  );
  const hovered = hoveredId ? stationsById.get(hoveredId) : undefined;
  const hoveredPrice = hovered?.prices[fuel];

  // New search area → frame the whole circle.
  useEffect(() => {
    if (!origin) return;
    mapRef.current?.fitBounds(boundsAround(origin, radiusMeters), {
      padding: freeArea(false),
      duration: 800,
    });
  }, [origin, radiusMeters]);

  // Station picked in the list → bring it into view, above the station sheet.
  useEffect(() => {
    const map = mapRef.current;
    const station = selection?.from === "list" ? stationsById.get(selection.id) : undefined;
    if (!map || !station) return;
    const area = freeArea(true);
    map.easeTo({
      center: [station.lng, station.lat],
      zoom: Math.max(map.getZoom(), 13),
      // Shift the target to the middle of the visible area, not the middle of the screen.
      offset: [(area.left - area.right) / 2, (area.top - area.bottom) / 2],
      duration: 600,
    });
  }, [selection, stationsById]);

  return (
    <MapView
      ref={mapRef}
      initialViewState={{ bounds: QUEBEC_BOUNDS, fitBoundsOptions: { padding: 24 } }}
      mapStyle={MAP_STYLE_URL}
      style={{ position: "absolute", inset: 0 }}
      interactiveLayerIds={[HIT_LAYER_ID]}
      cursor={hoveredId ? "pointer" : "grab"}
      attributionControl={false}
      onClick={(event) => onSelect(featureId(event))}
      onMouseMove={(event) => setHoveredId(featureId(event))}
      onMouseLeave={() => setHoveredId(null)}
      onLoad={collapseAttributionOnPhones}
    >
      <Source id={SOURCE_ID} type="geojson" data={geojson}>
        <Layer {...stationsLayer(scale)} />
        <Layer {...selectedLayer(selection?.id ?? null)} />
        <Layer {...hitLayer} />
      </Source>

      {radiusShape && (
        <Source id="search-radius" type="geojson" data={radiusShape}>
          {/* beforeId: draw the circle under the stations, not over them. */}
          <Layer {...radiusFillLayer} beforeId={STATIONS_LAYER_ID} />
          <Layer {...radiusLineLayer} beforeId={STATIONS_LAYER_ID} />
        </Source>
      )}

      {origin && (
        <Marker longitude={origin.lng} latitude={origin.lat} anchor="center">
          <span aria-hidden className="block size-4 rounded-full bg-zinc-950 shadow-md ring-4 ring-white" />
        </Marker>
      )}

      {hovered && hoveredPrice != null && (
        <Popup
          longitude={hovered.lng}
          latitude={hovered.lat}
          closeButton={false}
          closeOnClick={false}
          offset={12}
        >
          <span className="text-sm text-zinc-900">
            {hovered.brand ?? t.station.independent} · <strong>{formatPrice(hoveredPrice)}</strong>
          </span>
        </Popup>
      )}

      <NavigationControl position="top-right" showCompass={false} />
      <AttributionControl position="bottom-right" compact customAttribution={t.map.source} />
    </MapView>
  );
}

/** Like MapLibre's PaddingOptions, but every side is required. */
type Insets = { top: number; bottom: number; left: number; right: number };

/**
 * Pixels covered by the panels floating over the map (see HomeView), so the
 * camera frames what the user can actually see.
 */
function freeArea(stationSheetOpen: boolean): Insets {
  if (window.matchMedia("(min-width: 40rem)").matches) {
    // Left: sidebar (24 rem). Right: station sheet card when open.
    return { top: 40, bottom: 40, left: 420, right: stationSheetOpen ? 460 : 60 };
  }
  // Phones: fuel selector + search on top; list or station sheet at the bottom.
  return { top: 150, bottom: Math.round(window.innerHeight * 0.45) + 40, left: 24, right: 24 };
}

/**
 * MapLibre opens the compact attribution on load; on phones it would spread under
 * the bottom panel. Start it folded: the (i) button stays visible and opens it.
 */
function collapseAttributionOnPhones(event: MapEvent) {
  if (window.matchMedia("(min-width: 40rem)").matches) return;
  event.target.getContainer().querySelector(".maplibregl-compact-show")?.classList.remove("maplibregl-compact-show");
}

/** Id of the station under the pointer, or null (clicked on the map background). */
function featureId(event: MapLayerMouseEvent): string | null {
  // GeoJSON properties are untyped at runtime: check before trusting.
  const id: unknown = event.features?.[0]?.properties?.id;
  return typeof id === "string" ? id : null;
}
