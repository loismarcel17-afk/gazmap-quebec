// POST /api/parcours — route line from A to B, to find the stations on the way.
// Signed-in users only (each call is billed). Returns the line, its length and
// duration: no turn-by-turn instructions (guidance asks /api/itineraire later).
// Coordinates are never logged.
import { parsePoint } from "@/features/routing/matrix";
import { parseDirections, routeOverviewUrl } from "@/features/routing/directions";
import { simplifyLine } from "@/features/routing/simplify";
import { signedInUser } from "@/lib/api-auth";
import { API_LIMITS, rateLimited } from "@/lib/api-limits";
import { fetchMapbox, noStoreJson } from "@/lib/mapbox-fetch";

const TIMEOUT_MS = 8_000;

export async function POST(request: Request): Promise<Response> {
  const limited = rateLimited(API_LIMITS.parcours, request);
  if (limited) return limited;
  if (!(await signedInUser(request))) return noStoreJson({ error: "sign_in_required" }, 401);

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const origin = parsePoint(body?.origin);
  const destination = parsePoint(body?.destination);
  if (!origin || !destination) return noStoreJson({ error: "invalid_request" }, 400);

  const token = process.env.MAPBOX_DIRECTIONS_TOKEN;
  if (!token) return noStoreJson({ error: "routing_unavailable" }, 503);

  try {
    const route = parseDirections(await fetchMapbox(routeOverviewUrl(origin, destination, token), "Directions", TIMEOUT_MS));
    const { geometry, distanceMeters, durationSeconds } = route;
    // Thousands of points → a few hundred, within 50 m of the road: lighter for the phone.
    return noStoreJson({ route: { geometry: simplifyLine(geometry), distanceMeters, durationSeconds } });
  } catch {
    // Mapbox down, or no road between the two points (an island, another continent).
    return noStoreJson({ error: "routing_unavailable" }, 503);
  }
}
