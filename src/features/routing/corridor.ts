// Stations along a route: which ones can be reached without leaving the trip
// by much. Pure; the route line comes from /api/parcours.
//
// A station 3 km (as the crow flies) from the line is at most a ~6-8 km detour
// by road; farther than that, a station near the destination or the start is
// almost always cheaper overall. The real detour is measured afterwards, by
// road (Mapbox Matrix), for the best candidates only.
import type { LatLng } from "@/features/geo/geo";
import { createLine, projectOnLine, type Position } from "@/features/navigation/geometry";
import type { NearbyStation } from "@/features/stations/nearby";
import type { FuelType, Station } from "@/features/stations/types";

export const CORRIDOR_METERS = 3_000;

/** `distanceMeters` (from NearbyStation) is here the straight-line distance to the route line. */
export interface StationAlongRoute extends NearbyStation {
  /** Meters from the start of the route to the station's closest point on it */
  distanceAlongMeters: number;
}

/** Degrees of latitude per meter; longitude degrees are wider apart near the equator. */
const DEGREES_PER_METER = 1 / 111_320;

/**
 * Stations selling `fuel` within `corridorMeters` of the route line, in route
 * order (start → destination).
 *
 * Two passes, so a 500 km trip stays fast on a phone: a bounding box around the
 * route discards most of the 2 500 stations with two comparisons each, then the
 * exact distance to the line is computed for the rest.
 */
export function stationsAlongRoute(
  stations: Station[],
  geometry: Position[],
  fuel: FuelType,
  corridorMeters = CORRIDOR_METERS,
): StationAlongRoute[] {
  if (geometry.length < 2) return [];
  const line = createLine(geometry);

  const lats = geometry.map(([, lat]) => lat);
  const lngs = geometry.map(([lng]) => lng);
  const north = Math.max(...lats);
  const south = Math.min(...lats);
  const latMargin = corridorMeters * DEGREES_PER_METER;
  // Longitude degrees shrink with latitude: use the widest margin of the box.
  const lngMargin = latMargin / Math.cos((Math.max(Math.abs(north), Math.abs(south)) * Math.PI) / 180);
  const box = {
    north: north + latMargin,
    south: south - latMargin,
    east: Math.max(...lngs) + lngMargin,
    west: Math.min(...lngs) - lngMargin,
  };

  const results: StationAlongRoute[] = [];
  for (const station of stations) {
    const price = station.prices[fuel];
    if (price === null) continue;
    if (station.lat > box.north || station.lat < box.south || station.lng > box.east || station.lng < box.west) {
      continue;
    }
    const projection = projectOnLine(line, station satisfies LatLng);
    if (projection.distanceFromLine <= corridorMeters) {
      results.push({
        station,
        price,
        distanceMeters: projection.distanceFromLine,
        distanceAlongMeters: projection.distanceAlong,
      });
    }
  }
  return results.sort((a, b) => a.distanceAlongMeters - b.distanceAlongMeters);
}
