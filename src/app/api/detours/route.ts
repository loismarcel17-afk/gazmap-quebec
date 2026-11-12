// POST /api/detours — one-way road distances from the user to up to 24 stations.
// For signed-in users only: calculating the fill-up needs an account, and each
// call costs a Mapbox request.
// Server side only: the Mapbox token never reaches the browser (CLAUDE.md).
// Mapbox sees this server's address, not the visitor's. Coordinates are never logged.
import { matrixUrl, parseDetourRequest, parseMatrixDistances } from "@/features/routing/matrix";
import { signedInUser } from "@/lib/api-auth";
import { API_LIMITS, rateLimited } from "@/lib/api-limits";

const TIMEOUT_MS = 5_000;

export async function POST(request: Request): Promise<Response> {
  // Each request costs a Mapbox call: refuse loops before anything else.
  const limited = rateLimited(API_LIMITS.detours, request);
  if (limited) return limited;
  if (!(await signedInUser(request))) return json({ error: "sign_in_required" }, 401);

  const body = await request.json().catch(() => null);
  const detourRequest = parseDetourRequest(body);
  if (!detourRequest) return json({ error: "invalid_request" }, 400);

  const token = process.env.MAPBOX_DIRECTIONS_TOKEN;
  // No token (local dev without a Mapbox account): the client falls back to
  // straight-line round trips.
  if (!token) return json({ error: "routing_unavailable" }, 503);

  try {
    const response = await fetch(matrixUrl(detourRequest, token), {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (!response.ok) {
      // Status only: the URL contains coordinates and the token.
      console.error(`Mapbox Matrix answered HTTP ${response.status}`);
      return json({ error: "routing_unavailable" }, 503);
    }
    const distances = parseMatrixDistances(await response.json(), detourRequest);
    return json({ distances });
  } catch (failure) {
    console.error("Mapbox Matrix request failed:", failure instanceof Error ? failure.name : "unknown");
    return json({ error: "routing_unavailable" }, 503);
  }
}

function json(body: unknown, status = 200): Response {
  // A user's distances are personal and short-lived: never cache them anywhere.
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
