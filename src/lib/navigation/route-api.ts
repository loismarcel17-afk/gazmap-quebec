import type { LatLng } from "@/features/geo/geo";
import type { Route } from "@/features/routing/directions";

/**
 * Route to a station through our API route (the Mapbox token stays on the server).
 * Sends a position only here: at the start of a trip and on reroutes.
 * null = no route (no token, Mapbox down, offline): the screen falls back to Waze / Google Maps.
 */
export async function fetchTripRoute(origin: LatLng, stationId: string, heading?: number): Promise<Route | null> {
  try {
    const response = await fetch("/api/itineraire", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ origin: { lat: origin.lat, lng: origin.lng }, stationId, heading }),
    });
    if (!response.ok) return null;
    const { route } = (await response.json()) as { route: Route };
    return route;
  } catch {
    return null;
  }
}
