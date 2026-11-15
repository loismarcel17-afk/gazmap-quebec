// Road detours for a planned trip A → B: for each candidate station S, the
// distance A → S → B, and A → B itself. Two Mapbox Matrix requests:
//   1. from A to [B, S1…Sn]          → A → B and every A → S
//   2. from [S1…Sn] to B             → every S → B
// That's 2n + 1 "elements" (what Mapbox bills), where a full matrix between all
// points would be (n + 2)². Pure: the HTTP calls live in /api/parcours/detours.
import type { LatLng } from "@/features/geo/geo";
import type { RouteDistances } from "@/features/recommendation/rank";
import { parsePoint, parseStations, type CandidateStation } from "./matrix";

/** 25 coordinates per Matrix request: A + B + 23 stations. */
export const MAX_ROUTE_CANDIDATES = 23;

export interface RouteDetourRequest {
  origin: LatLng;
  destination: LatLng;
  stations: CandidateStation[];
}

export function parseRouteDetourRequest(body: unknown): RouteDetourRequest | null {
  if (typeof body !== "object" || body === null) return null;
  const { origin, destination, stations } = body as Record<string, unknown>;
  const a = parsePoint(origin);
  const b = parsePoint(destination);
  const candidates = parseStations(stations, MAX_ROUTE_CANDIDATES);
  return a && b && candidates ? { origin: a, destination: b, stations: candidates } : null;
}

const point = ({ lat, lng }: LatLng) => `${lng.toFixed(5)},${lat.toFixed(5)}`;
const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i).join(";");
const BASE = "https://api.mapbox.com/directions-matrix/v1/mapbox/driving";

/** The two Matrix URLs: [from A, to B]. */
export function routeMatrixUrls(request: RouteDetourRequest, token: string): [string, string] {
  const n = request.stations.length;
  const fromOrigin = [request.origin, request.destination, ...request.stations].map(point).join(";");
  const fromParams = new URLSearchParams({
    sources: "0",
    destinations: range(1, n + 1),
    annotations: "distance",
    access_token: token,
  });
  const toDestination = [request.destination, ...request.stations].map(point).join(";");
  const toParams = new URLSearchParams({
    sources: range(1, n),
    // Mapbox refuses a 1-element matrix: with a single station, also ask S → S
    // (0 m, ignored) so the request has 2 elements.
    destinations: n === 1 ? "0;1" : "0",
    annotations: "distance",
    access_token: token,
  });
  return [`${BASE}/${fromOrigin}?${fromParams}`, `${BASE}/${toDestination}?${toParams}`];
}

/**
 * Reads both answers. Throws if they don't have the expected shape or if A → B
 * has no road route (nothing to compare with). A station is null when either
 * leg has no route (an island without a ferry, a closed road).
 */
export function parseRouteMatrix(fromOrigin: unknown, toDestination: unknown, request: RouteDetourRequest): RouteDistances {
  const n = request.stations.length;
  const row = distancesOf(fromOrigin)?.[0];
  const column = distancesOf(toDestination);
  if (!Array.isArray(row) || row.length !== n + 1 || !column || column.length !== n) {
    throw new Error("Unexpected Matrix API response");
  }
  const directMeters = meters(row[0]);
  if (directMeters === null) throw new Error("No road route between the start and the destination");

  const viaMeters: RouteDistances["viaMeters"] = {};
  request.stations.forEach((station, index) => {
    const toStation = meters(row[index + 1]);
    const fromStation = Array.isArray(column[index]) ? meters((column[index] as unknown[])[0]) : null;
    viaMeters[station.id] = toStation !== null && fromStation !== null ? toStation + fromStation : null;
  });
  return { directMeters, viaMeters };
}

function distancesOf(response: unknown): unknown[] | null {
  if (typeof response !== "object" || response === null) return null;
  const body = response as { code?: unknown; distances?: unknown };
  return body.code === "Ok" && Array.isArray(body.distances) ? body.distances : null;
}

const meters = (value: unknown): number | null => (typeof value === "number" && Number.isFinite(value) ? value : null);
