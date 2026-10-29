"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useMemo, useRef } from "react";
import MapView, { AttributionControl, Layer, Marker, Source, type MapRef } from "react-map-gl/maplibre";
import type { LatLng } from "@/features/geo/geo";
import type { Position } from "@/features/navigation/geometry";
import { t } from "@/lib/i18n";
import { MAP_STYLE_URL } from "@/lib/map";
import "@/lib/maplibre-worker";

interface GuidanceMapProps {
  station: LatLng;
  /** Route line, once known */
  geometry: Position[] | null;
  /** Current position; null before the first fix */
  position: LatLng | null;
  /** Direction of travel, degrees from north */
  bearing: number;
  /** Follow the driver (guiding) or show the whole trip (before starting) */
  follow: boolean;
}

export default function GuidanceMap({ station, geometry, position, bearing, follow }: GuidanceMapProps) {
  const mapRef = useRef<MapRef>(null);

  const line = useMemo(
    () =>
      geometry && {
        type: "Feature" as const,
        geometry: { type: "LineString" as const, coordinates: geometry },
        properties: {},
      },
    [geometry],
  );

  // Driving: center on the driver, map turned so "up" = direction of travel,
  // tilted for perspective. Smooth moves between fixes (~1 per second).
  useEffect(() => {
    if (!follow || !position) return;
    mapRef.current?.easeTo({
      center: [position.lng, position.lat],
      bearing,
      pitch: 50,
      zoom: 16.5,
      // Driver in the lower third, so more of the road ahead is visible.
      offset: [0, 120],
      duration: 900,
    });
  }, [follow, position, bearing]);

  // Not driving yet: show the whole route (or just the station).
  useEffect(() => {
    if (follow) return;
    const map = mapRef.current;
    if (!map) return;
    const points = geometry ?? (position ? [[position.lng, position.lat] as Position] : []);
    const all = [...points, [station.lng, station.lat] as Position];
    const lngs = all.map((p) => p[0]);
    const lats = all.map((p) => p[1]);
    map.fitBounds(
      [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ],
      { padding: { top: 80, bottom: 320, left: 40, right: 40 }, maxZoom: 16, duration: 600 },
    );
  }, [follow, geometry, position, station]);

  return (
    <MapView
      ref={mapRef}
      initialViewState={{ longitude: station.lng, latitude: station.lat, zoom: 14 }}
      mapStyle={MAP_STYLE_URL}
      style={{ position: "absolute", inset: 0 }}
      attributionControl={false}
    >
      {line && (
        <Source id="trip-route" type="geojson" data={line}>
          {/* White casing under a blue line: readable on any background. */}
          <Layer
            id="trip-route-casing"
            type="line"
            layout={{ "line-cap": "round", "line-join": "round" }}
            paint={{ "line-color": "#ffffff", "line-width": 12 }}
          />
          <Layer
            id="trip-route-line"
            type="line"
            layout={{ "line-cap": "round", "line-join": "round" }}
            paint={{ "line-color": "#1d4ed8", "line-width": 7 }}
          />
        </Source>
      )}

      <Marker longitude={station.lng} latitude={station.lat} anchor="bottom">
        <svg aria-hidden viewBox="0 0 24 32" className="h-10 w-8 drop-shadow">
          <path d="M12 31s10-11 10-19A10 10 0 0 0 2 12c0 8 10 19 10 19z" fill="#0b0b0b" />
          <circle cx="12" cy="12" r="4" fill="#ffffff" />
        </svg>
      </Marker>

      {position && (
        // rotationAlignment "map": the arrow keeps pointing along the road as the map turns.
        <Marker longitude={position.lng} latitude={position.lat} rotation={bearing} rotationAlignment="map">
          <svg aria-hidden viewBox="0 0 40 40" className="size-11 drop-shadow-lg">
            <circle cx="20" cy="20" r="18" fill="#ffffff" />
            <path d="M20 7l9 24-9-5-9 5z" fill="#1d4ed8" />
          </svg>
        </Marker>
      )}

      <AttributionControl position="bottom-right" compact customAttribution={t.map.source} />
    </MapView>
  );
}
