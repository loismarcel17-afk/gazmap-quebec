// POST /api/parcours/detours — for a planned trip A → B and up to 23 stations:
// the road distance A → station → B of each, and A → B. Two Mapbox Matrix calls
// (routing/route-matrix.ts). Signed-in users only; coordinates never logged.
import { parseRouteDetourRequest, parseRouteMatrix, routeMatrixUrls } from "@/features/routing/route-matrix";
import { signedInUser } from "@/lib/api-auth";
import { API_LIMITS, rateLimited } from "@/lib/api-limits";
import { fetchMapbox, noStoreJson } from "@/lib/mapbox-fetch";

const TIMEOUT_MS = 6_000;

export async function POST(request: Request): Promise<Response> {
  const limited = rateLimited(API_LIMITS.parcoursDetours, request);
  if (limited) return limited;
  if (!(await signedInUser(request))) return noStoreJson({ error: "sign_in_required" }, 401);

  const detourRequest = parseRouteDetourRequest(await request.json().catch(() => null));
  if (!detourRequest) return noStoreJson({ error: "invalid_request" }, 400);

  const token = process.env.MAPBOX_DIRECTIONS_TOKEN;
  if (!token) return noStoreJson({ error: "routing_unavailable" }, 503);

  try {
    const [fromUrl, toUrl] = routeMatrixUrls(detourRequest, token);
    // Both at once: the answer comes as fast as the slower of the two.
    const [fromOrigin, toDestination] = await Promise.all([
      fetchMapbox(fromUrl, "Matrix", TIMEOUT_MS),
      fetchMapbox(toUrl, "Matrix", TIMEOUT_MS),
    ]);
    return noStoreJson(parseRouteMatrix(fromOrigin, toDestination, detourRequest));
  } catch {
    return noStoreJson({ error: "routing_unavailable" }, 503);
  }
}
