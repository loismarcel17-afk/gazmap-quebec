// Trip planning (PLAN.md task 18): the browser side of /api/adresses,
// /api/parcours and /api/parcours/detours. The last two are account-only; each
// function returns null when unavailable (signed out, offline, Mapbox down).
//
// Privacy: the departure, the destination and what is typed in the address
// field go to our server and Mapbox for the calculation only (never stored).
import type { AddressSuggestion } from "@/features/places/geocoding";
import type { LatLng } from "@/features/geo/geo";
import type { Position } from "@/features/navigation/geometry";
import type { RouteDistances } from "@/features/recommendation/rank";
import { MAX_ROUTE_CANDIDATES } from "@/features/routing/route-matrix";
import type { Station } from "@/features/stations/types";
import { postSignedIn } from "./signed-in-fetch";

export interface PlannedRoute {
  geometry: Position[];
  distanceMeters: number;
  durationSeconds: number;
}

const point = ({ lat, lng }: LatLng) => ({ lat, lng });

/** Street addresses matching `text` (open to everyone: also used by the map's search box). */
export async function searchAddresses(text: string, near: LatLng | null): Promise<AddressSuggestion[] | null> {
  try {
    const response = await fetch("/api/adresses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q: text, near: near && point(near) }),
    });
    if (!response.ok) return null;
    return ((await response.json()) as { results: AddressSuggestion[] }).results;
  } catch {
    return null;
  }
}

export async function fetchPlannedRoute(origin: LatLng, destination: LatLng): Promise<PlannedRoute | null> {
  const answer = await postSignedIn<{ route: PlannedRoute }>("/api/parcours", {
    origin: point(origin),
    destination: point(destination),
  });
  return answer?.route ?? null;
}

/** Road distance A → station → B for the 23 best candidates (two Matrix calls on the server). */
export async function fetchRouteDetours(
  origin: LatLng,
  destination: LatLng,
  stations: Station[],
): Promise<RouteDistances | null> {
  const candidates = stations.slice(0, MAX_ROUTE_CANDIDATES).map(({ id, lat, lng }) => ({ id, lat, lng }));
  if (candidates.length === 0) return null;
  return postSignedIn<RouteDistances>("/api/parcours/detours", {
    origin: point(origin),
    destination: point(destination),
    stations: candidates,
  });
}
