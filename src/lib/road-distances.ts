import type { LatLng } from "@/features/geo/geo";
import { MAX_DESTINATIONS, type RoadDistances } from "@/features/routing/matrix";
import type { Station } from "@/features/stations/types";
import { postSignedIn } from "./signed-in-fetch";

/**
 * Road distances from `origin` to the first 24 stations, through our API route.
 * Returns null when routing is unavailable (no Mapbox token, Mapbox down,
 * offline, signed out): callers then rank with straight-line distances.
 *
 * Privacy: this sends the position to our server (and, through it, to Mapbox).
 * Only call it after the user asked for nearby stations, and say so in the UI.
 */
export async function fetchRoadDistances(origin: LatLng, stations: Station[]): Promise<RoadDistances | null> {
  const candidates = stations.slice(0, MAX_DESTINATIONS).map(({ id, lat, lng }) => ({ id, lat, lng }));
  if (candidates.length === 0) return {};
  const answer = await postSignedIn<{ distances: RoadDistances }>("/api/detours", {
    origin: { lat: origin.lat, lng: origin.lng },
    stations: candidates,
  });
  return answer?.distances ?? null;
}
