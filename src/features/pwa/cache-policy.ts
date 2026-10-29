// What the service worker may keep on the phone, decided per request.
// Pure (no DOM), so it's unit-tested and reusable.
//
// The rule (Loi 25): only things that are the same for every visitor are cached.
// Never cached:
// - /api/* : detours and routes carry precise positions;
// - other domains: Supabase answers hold personal data (trips, consents, the
//   session), and map tiles are under the map provider's licence.

export type CachePolicy =
  /** Built files with a hash in their name: never change, keep them. */
  | "static"
  /** Our own pages (same HTML for everyone): fresh when online, last copy offline. */
  | "page"
  /** Icons, fonts, the MapLibre worker: serve the copy, refresh in the background. */
  | "asset"
  /** Always from the network, never stored. */
  | "network-only";

export interface RequestInfo {
  url: URL;
  /** Origin of the site itself (self.location.origin) */
  origin: string;
  method: string;
  /** request.mode === "navigate" (a page load) */
  navigate: boolean;
  /** Next.js client navigation (RSC payload) */
  rsc: boolean;
}

export function cachePolicy({ url, origin, method, navigate, rsc }: RequestInfo): CachePolicy {
  if (method !== "GET" || url.origin !== origin) return "network-only";
  const path = url.pathname;
  if (path.startsWith("/api/")) return "network-only";
  if (path.startsWith("/_next/static/")) return "static";
  if (navigate || rsc) return "page";
  if (path.startsWith("/maplibre/") || path.startsWith("/icons/") || /\.(?:png|svg|ico|woff2?)$/.test(path)) {
    return "asset";
  }
  return "network-only";
}
