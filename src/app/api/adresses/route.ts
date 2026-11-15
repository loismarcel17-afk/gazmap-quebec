// POST /api/adresses — street address suggestions (Mapbox Geocoding): the search
// box of the map (everyone, decision of 2026-11-15) and trip planning (accounts).
// Open without an account, so the per-visitor and per-instance limits are what
// cap the bill; the browser only calls it for text that looks like a street
// (looksLikeStreetAddress) or that no town / postal code matches.
// What the user typed goes to Mapbox to be geocoded; it is never logged nor stored.
import { geocodingUrl, parseAddressQuery, parseGeocoding } from "@/features/places/geocoding";
import { API_LIMITS, rateLimited } from "@/lib/api-limits";
import { fetchMapbox, noStoreJson } from "@/lib/mapbox-fetch";

const TIMEOUT_MS = 4_000;

export async function POST(request: Request): Promise<Response> {
  const limited = rateLimited(API_LIMITS.adresses, request);
  if (limited) return limited;

  const query = parseAddressQuery(await request.json().catch(() => null));
  if (!query) return noStoreJson({ error: "invalid_request" }, 400);

  const token = process.env.MAPBOX_DIRECTIONS_TOKEN;
  if (!token) return noStoreJson({ error: "geocoding_unavailable" }, 503);

  try {
    return noStoreJson({ results: parseGeocoding(await fetchMapbox(geocodingUrl(query, token), "Geocoding", TIMEOUT_MS)) });
  } catch {
    return noStoreJson({ error: "geocoding_unavailable" }, 503);
  }
}
