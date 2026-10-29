import type { LatLng } from "@/features/geo/geo";
import { MAX_DESTINATIONS, type RoadDistances } from "@/features/routing/matrix";
import type { Station } from "@/features/stations/types";

/**
 * Road distances from `origin` to the first 24 stations, through our API route.
 * Returns null when routing is unavailable (no Mapbox token, Mapbox down,
 * offline): callers then rank with straight-line distances.
 *
 * Privacy: this sends the position to our server (and, through it, to Mapbox).
 * Only call it after the user asked for nearby stations, and say so in the UI.
 */
export async function fetchRoadDistances(origin: LatLng, stations: Station[]): Promise<RoadDistances | null> {
  const candidates = stations.slice(0, MAX_DESTINATIONS).map(({ id, lat, lng }) => ({ id, lat, lng }));
  if (candidates.length === 0) return {};
  try {
    const response = await fetch("/api/detours", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ origin: { lat: origin.lat, lng: origin.lng }, stations: candidates }),
    });
    if (!response.ok) return null;
    const { distances } = (await response.json()) as { distances: RoadDistances };
    return distances;
  } catch {
    return null;
  }
}
