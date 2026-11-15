// POST /api/itineraire — driving route with voice and banner instructions, from
// the user's position to a station. Called at the start of a trip and on reroutes
// only: positions during guidance never leave the phone.
//
// Two kinds of target:
// - a station, by id, looked up here: open to everyone, and our Mapbox token can
//   only be used to reach a gas station;
// - a free destination ({ lat, lng }): the last leg of a planned trip, after the
//   fill-up (PLAN.md task 18). Signed-in users only, so the token can't serve as
//   a free routing service for anonymous scripts.
// Coordinates and the token are never logged.
import type { LatLng } from "@/features/geo/geo";
import { directionsUrl, parseDirections } from "@/features/routing/directions";
import { parsePoint } from "@/features/routing/matrix";
import { signedInUser } from "@/lib/api-auth";
import { fetchStationLocation } from "@/lib/station-location";
import { API_LIMITS, rateLimited } from "@/lib/api-limits";

const TIMEOUT_MS = 8_000;

export async function POST(request: Request): Promise<Response> {
  // Each request costs a Mapbox call: refuse loops before anything else.
  const limited = rateLimited(API_LIMITS.itineraire, request);
  if (limited) return limited;

  const input = parseRouteRequest(await request.json().catch(() => null));
  if (!input) return json({ error: "invalid_request" }, 400);

  if ("destination" in input && !(await signedInUser(request))) return json({ error: "sign_in_required" }, 401);

  const token = process.env.MAPBOX_DIRECTIONS_TOKEN;
  if (!token) return json({ error: "routing_unavailable" }, 503);

  try {
    const target = "destination" in input ? input.destination : await fetchStationLocation(input.stationId);
    if (!target) return json({ error: "station_not_found" }, 404);

    const response = await fetch(directionsUrl(input.origin, target, token, input.heading), {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (!response.ok) {
      console.error(`Mapbox Directions answered HTTP ${response.status}`);
      return json({ error: "routing_unavailable" }, 503);
    }
    return json({ route: parseDirections(await response.json()) });
  } catch (failure) {
    console.error("Route request failed:", failure instanceof Error ? failure.name : "unknown");
    return json({ error: "routing_unavailable" }, 503);
  }
}

type RouteRequest = {
  origin: LatLng;
  /** Current direction of travel (degrees), sent on reroutes */
  heading?: number;
} & ({ stationId: string } | { destination: LatLng });

function parseRouteRequest(body: unknown): RouteRequest | null {
  if (typeof body !== "object" || body === null) return null;
  const { origin, stationId, destination, heading } = body as Record<string, unknown>;
  const start = parsePoint(origin);
  if (!start) return null;
  const validHeading = typeof heading === "number" && Number.isFinite(heading) ? ((heading % 360) + 360) % 360 : undefined;
  if (typeof stationId === "string" && stationId.length > 0 && stationId.length <= 64) {
    return { origin: start, stationId, heading: validHeading };
  }
  const end = stationId === undefined ? parsePoint(destination) : null;
  return end ? { origin: start, destination: end, heading: validHeading } : null;
}

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
