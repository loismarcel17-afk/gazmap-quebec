// Road distances from one origin to several stations, via the Mapbox Matrix API
// (one request for up to 24 stations, where the Directions API would need 24).
// Pure: builds the request and reads the answer; the HTTP call lives in the API route.
import type { LatLng } from "@/features/geo/geo";

/** Mapbox Matrix "driving" profile: at most 25 coordinates, so origin + 24 stations. */
export const MAX_DESTINATIONS = 24;

export interface DetourRequest {
  origin: LatLng;
  stations: { id: string; lat: number; lng: number }[];
}

/** One-way road distance in meters per station id; null = no road route found. */
export type RoadDistances = Record<string, number | null>;

const isLat = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= -90 && value <= 90;
const isLng = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= -180 && value <= 180;

/** Validates the browser's request body: anything can be POSTed to a public API route. */
export function parseDetourRequest(body: unknown): DetourRequest | null {
  if (typeof body !== "object" || body === null) return null;
  const { origin, stations } = body as Record<string, unknown>;
  if (typeof origin !== "object" || origin === null) return null;
  const { lat, lng } = origin as Record<string, unknown>;
  if (!isLat(lat) || !isLng(lng)) return null;
  if (!Array.isArray(stations) || stations.length === 0 || stations.length > MAX_DESTINATIONS) return null;

  const parsed: DetourRequest["stations"] = [];
  for (const station of stations) {
    if (typeof station !== "object" || station === null) return null;
    const { id, lat: stationLat, lng: stationLng } = station as Record<string, unknown>;
    if (typeof id !== "string" || id.length === 0 || id.length > 64) return null;
    if (!isLat(stationLat) || !isLng(stationLng)) return null;
    parsed.push({ id, lat: stationLat, lng: stationLng });
  }
  return { origin: { lat, lng }, stations: parsed };
}

/**
 * Matrix API URL: coordinates are "lng,lat" separated by ";", the origin first.
 * sources=0 → only distances FROM the origin; annotations=distance → meters.
 */
export function matrixUrl(request: DetourRequest, token: string): string {
  // 5 decimals ≈ 1 m: enough for routing, no need to send more precision than that.
  const point = ({ lat, lng }: LatLng) => `${lng.toFixed(5)},${lat.toFixed(5)}`;
  const coordinates = [request.origin, ...request.stations].map(point).join(";");
  const params = new URLSearchParams({ sources: "0", annotations: "distance", access_token: token });
  return `https://api.mapbox.com/directions-matrix/v1/mapbox/driving/${coordinates}?${params}`;
}

/** Reads distances[0][1..n] (row 0 = from the origin; column 0 = the origin itself). */
export function parseMatrixDistances(response: unknown, request: DetourRequest): RoadDistances {
  const row =
    typeof response === "object" && response !== null && (response as { code?: unknown }).code === "Ok"
      ? (response as { distances?: unknown }).distances
      : undefined;
  const fromOrigin = Array.isArray(row) && Array.isArray(row[0]) ? (row[0] as unknown[]) : null;
  if (!fromOrigin || fromOrigin.length !== request.stations.length + 1) {
    throw new Error("Unexpected Matrix API response");
  }

  const distances: RoadDistances = {};
  request.stations.forEach((station, index) => {
    const meters = fromOrigin[index + 1];
    distances[station.id] = typeof meters === "number" && Number.isFinite(meters) ? meters : null;
  });
  return distances;
}
