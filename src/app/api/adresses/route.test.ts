import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

let client = 0;
const post = (body: unknown) =>
  POST(
    new Request("http://localhost/api/adresses", {
      method: "POST",
      headers: { "x-forwarded-for": `198.51.100.${++client}` },
      body: JSON.stringify(body),
    }),
  );

const MAPBOX_ANSWER = {
  features: [{ geometry: { coordinates: [-71.2123, 46.8111] }, properties: { full_address: "1000 Rue Saint-Jean, Québec" } }],
};

beforeEach(() => {
  vi.stubEnv("MAPBOX_DIRECTIONS_TOKEN", "pk.secret");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("POST /api/adresses", () => {
  it("returns suggestions, never cached", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json(MAPBOX_ANSWER)));
    const response = await post({ q: "1000 rue Saint-Jean" });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ results: [{ lat: 46.8111, lng: -71.2123, label: "1000 Rue Saint-Jean, Québec" }] });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("limits each visitor to 40 searches a minute (open without an account)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json(MAPBOX_ANSWER)));
    const fromOneVisitor = () =>
      POST(
        new Request("http://localhost/api/adresses", {
          method: "POST",
          headers: { "x-forwarded-for": "203.0.113.7" },
          body: JSON.stringify({ q: "1000 rue Saint-Jean" }),
        }),
      );
    for (let i = 0; i < 40; i++) expect((await fromOneVisitor()).status).toBe(200);
    expect((await fromOneVisitor()).status).toBe(429);
  });

  it("rejects too short a query", async () => {
    expect((await post({ q: "ab" })).status).toBe(400);
  });

  it("answers 503 when Mapbox fails, without logging what was typed", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 500 })));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await post({ q: "1000 rue Saint-Jean" })).status).toBe(503);
    const logged = JSON.stringify(log.mock.calls);
    expect(logged).not.toContain("Saint-Jean");
    expect(logged).not.toContain("pk.secret");
  });
});
