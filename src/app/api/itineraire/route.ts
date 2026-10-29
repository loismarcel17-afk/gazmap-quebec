// POST /api/itineraire — driving route with voice and banner instructions, from
// the user's position to a station. Called at the start of a trip and on reroutes
// only: positions during guidance never leave the phone.
//
// The station comes by id and is looked up here, so this route (and our Mapbox
// token) can only be used to reach a gas station, not for arbitrary trips.
// Coordinates and the token are never logged.
import { directionsUrl, parseDirections } from "@/features/routing/directions";
import { fetchStationLocation } from "@/lib/station-location";
import { API_LIMITS, rateLimited } from "@/lib/api-limits";

const TIMEOUT_MS = 8_000;

export async function POST(request: Request): Promise<Response> {
  // Each request costs a Mapbox call: refuse loops before anything else.
  const limited = rateLimited(API_LIMITS.itineraire, request);
  if (limited) return limited;

  const input = parseRouteRequest(await request.json().catch(() => null));
  if (!input) return json({ error: "invalid_request" }, 400);

  const token = process.env.MAPBOX_DIRECTIONS_TOKEN;
  if (!token) return json({ error: "routing_unavailable" }, 503);

  try {
    const station = await fetchStationLocation(input.stationId);
    if (!station) return json({ error: "station_not_found" }, 404);

    const response = await fetch(directionsUrl(input.origin, station, token, input.heading), {
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

interface RouteRequest {
  origin: { lat: number; lng: number };
  stationId: string;
  /** Current direction of travel (degrees), sent on reroutes */
  heading?: number;
}

function parseRouteRequest(body: unknown): RouteRequest | null {
  if (typeof body !== "object" || body === null) return null;
  const { origin, stationId, heading } = body as Record<string, unknown>;
  if (typeof origin !== "object" || origin === null) return null;
  const { lat, lng } = origin as Record<string, unknown>;
  const valid =
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180 &&
    typeof stationId === "string" &&
    stationId.length > 0 &&
    stationId.length <= 64;
  if (!valid) return null;
  const validHeading = typeof heading === "number" && Number.isFinite(heading) ? ((heading % 360) + 360) % 360 : undefined;
  return { origin: { lat, lng }, stationId, heading: validHeading };
}

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
