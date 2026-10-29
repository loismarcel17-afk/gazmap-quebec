// Limits for the API routes that call Mapbox (paid per request). Two counters
// per route: one per visitor's address, and one for the whole server instance,
// which caps the bill even when requests come from many addresses.
import { clientAddress, createRateLimiter, type RateLimiter } from "@/features/security/rate-limit";

const MINUTE = 60_000;

interface RouteLimits {
  perClient: RateLimiter;
  perInstance: RateLimiter;
}

function limits(perClient: number, perInstance: number): RouteLimits {
  return {
    perClient: createRateLimiter({ limit: perClient, windowMs: MINUTE }),
    perInstance: createRateLimiter({ limit: perInstance, windowMs: MINUTE }),
  };
}

export const API_LIMITS = {
  // The list asks once per search, radius or fuel change: 30/min is generous.
  detours: limits(30, 600),
  // Start of a trip + reroutes (at most 1 per 15 s on the phone): 4/min in practice.
  itineraire: limits(10, 300),
};

/** null when the request may go on; otherwise the 429 answer to send. */
export function rateLimited(route: RouteLimits, request: Request): Response | null {
  const client = route.perClient.check(clientAddress(request.headers));
  // Count against the instance only requests the visitor was allowed to make.
  const result = client.allowed ? route.perInstance.check("all") : client;
  if (result.allowed) return null;
  return Response.json(
    { error: "rate_limited" },
    { status: 429, headers: { "Retry-After": String(result.retryAfterS), "Cache-Control": "no-store" } },
  );
}
