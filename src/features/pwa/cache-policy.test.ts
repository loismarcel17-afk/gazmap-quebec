import { describe, expect, it } from "vitest";
import { cachePolicy, type RequestInfo } from "./cache-policy";

const ORIGIN = "https://gazmap.ca";
const request = (url: string, extra: Partial<RequestInfo> = {}): RequestInfo => ({
  url: new URL(url, ORIGIN),
  origin: ORIGIN,
  method: "GET",
  navigate: false,
  rsc: false,
  ...extra,
});

describe("cachePolicy", () => {
  it("never caches our API: routes and detours carry precise positions", () => {
    expect(cachePolicy(request("/api/itineraire?from=45.50,-73.56&to=s1"))).toBe("network-only");
    expect(cachePolicy(request("/api/detours", { method: "POST" }))).toBe("network-only");
  });

  it("never caches other domains: Supabase personal data, map tiles", () => {
    expect(cachePolicy(request("https://abc.supabase.co/rest/v1/trips?select=*"))).toBe("network-only");
    expect(cachePolicy(request("https://abc.supabase.co/auth/v1/token"))).toBe("network-only");
    expect(cachePolicy(request("https://api.maptiler.com/tiles/v3/10/300/370.pbf"))).toBe("network-only");
  });

  it("keeps built files and pages for offline use", () => {
    expect(cachePolicy(request("/_next/static/chunks/app-1a2b3c.js"))).toBe("static");
    expect(cachePolicy(request("/", { navigate: true }))).toBe("page");
    expect(cachePolicy(request("/vehicule?_rsc=xyz", { rsc: true }))).toBe("page");
  });

  it("serves icons and the map worker from the cache", () => {
    expect(cachePolicy(request("/icons/icon-192.png"))).toBe("asset");
    expect(cachePolicy(request("/maplibre/maplibre-gl-worker.js"))).toBe("asset");
  });

  it("does not cache anything else, nor anything sent with POST", () => {
    expect(cachePolicy(request("/", { method: "POST", navigate: true }))).toBe("network-only");
    expect(cachePolicy(request("/robots.txt"))).toBe("network-only");
  });
});
