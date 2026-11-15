// Server side only: calls a Mapbox API with our token and reads the JSON.
// URLs contain the token and coordinates (or a typed address): never log them,
// only the HTTP status or the error name.

export class MapboxUnavailable extends Error {}

/** GET a Mapbox URL; throws MapboxUnavailable on timeout, network error or non-2xx. */
export async function fetchMapbox(url: string, api: string, timeoutMs: number): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), cache: "no-store" });
  } catch (failure) {
    console.error(`Mapbox ${api} request failed:`, failure instanceof Error ? failure.name : "unknown");
    throw new MapboxUnavailable(api);
  }
  if (!response.ok) {
    console.error(`Mapbox ${api} answered HTTP ${response.status}`);
    throw new MapboxUnavailable(api);
  }
  return response.json();
}

/** JSON answer that no cache (browser, CDN) may keep: personal and short-lived. */
export function noStoreJson(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
