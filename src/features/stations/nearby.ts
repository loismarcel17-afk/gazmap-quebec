import { distanceMeters, type LatLng } from "@/features/geo/geo";
import type { FuelType, Station } from "./types";

export interface NearbyStation {
  station: Station;
  /** Tenths of a cent per litre, for the requested fuel */
  price: number;
  distanceMeters: number;
}

/**
 * Stations selling `fuel` within `radiusMeters` of `origin`, cheapest first
 * (closest first when prices tie). Ranking by total fill-up cost, which
 * includes the detour, replaces this in PLAN.md task 6.
 */
export function findNearbyStations(
  stations: Station[],
  origin: LatLng,
  radiusMeters: number,
  fuel: FuelType,
): NearbyStation[] {
  const results: NearbyStation[] = [];
  for (const station of stations) {
    const price = station.prices[fuel];
    if (price === null) continue;
    const distance = distanceMeters(origin, station);
    if (distance <= radiusMeters) results.push({ station, price, distanceMeters: distance });
  }
  // Same order as the SQL function stations_near: price, exact distance, then id
  // so that exact ties always come out in the same order.
  return results.sort(
    (a, b) =>
      a.price - b.price ||
      a.distanceMeters - b.distanceMeters ||
      (a.station.id < b.station.id ? -1 : a.station.id > b.station.id ? 1 : 0),
  );
}
