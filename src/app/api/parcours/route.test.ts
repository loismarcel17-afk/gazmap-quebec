import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MONTREAL_DIRECTIONS_RESPONSE } from "@/features/navigation/fixtures/montreal-route";
import { signedInUser } from "@/lib/api-auth";
import { POST } from "./route";

vi.mock("@/lib/api-auth", () => ({ signedInUser: vi.fn() }));

let client = 0;
const post = (body: unknown) =>
  POST(
    new Request("http://localhost/api/parcours", {
      method: "POST",
      headers: { "x-forwarded-for": `198.51.100.${++client}` },
      body: JSON.stringify(body),
    }),
  );
const BODY = { origin: { lat: 45.5017, lng: -73.5673 }, destination: { lat: 46.8139, lng: -71.208 } };

beforeEach(() => {
  vi.stubEnv("MAPBOX_DIRECTIONS_TOKEN", "pk.secret");
  vi.mocked(signedInUser).mockResolvedValue("user-1");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("POST /api/parcours", () => {
  it("returns the route line, its length and duration, without instructions", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => Response.json(MONTREAL_DIRECTIONS_RESPONSE));
    vi.stubGlobal("fetch", fetchMock);
    const response = await post(BODY);
    const { route } = await response.json();
    expect(response.status).toBe(200);
    expect(route.distanceMeters).toBe(1000);
    expect(route.geometry.length).toBeGreaterThan(1);
    expect(route.steps).toBeUndefined();
    expect(new URL(String(fetchMock.mock.calls[0][0])).searchParams.get("overview")).toBe("full");
  });

  it("refuses visitors without an account", async () => {
    vi.mocked(signedInUser).mockResolvedValue(null);
    expect((await post(BODY)).status).toBe(401);
  });

  it("rejects a missing destination", async () => {
    expect((await post({ origin: BODY.origin })).status).toBe(400);
  });

  it("answers 503 when there is no route", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ code: "NoRoute", routes: [] })));
    expect((await post(BODY)).status).toBe(503);
  });
});
