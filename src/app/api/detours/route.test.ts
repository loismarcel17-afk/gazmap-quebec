import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signedInUser } from "@/lib/api-auth";
import { POST } from "./route";

vi.mock("@/lib/api-auth", () => ({ signedInUser: vi.fn() }));

const BODY = {
  origin: { lat: 45.5017, lng: -73.5673 },
  stations: [
    { id: "a", lat: 45.51, lng: -73.56 },
    { id: "b", lat: 45.49, lng: -73.58 },
  ],
};

const post = (body: unknown) =>
  POST(new Request("http://localhost/api/detours", { method: "POST", body: JSON.stringify(body) }));

beforeEach(() => {
  vi.mocked(signedInUser).mockResolvedValue("user-1");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("POST /api/detours", () => {
  it("returns road distances from Mapbox", async () => {
    vi.stubEnv("MAPBOX_DIRECTIONS_TOKEN", "pk.test");
    const fetchMock = vi.fn(async () => Response.json({ code: "Ok", distances: [[0, 1830.4, 2675.1]] }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await post(BODY);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ distances: { a: 1830.4, b: 2675.1 } });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("refuses visitors without an account (401) without calling Mapbox", async () => {
    vi.stubEnv("MAPBOX_DIRECTIONS_TOKEN", "pk.test");
    vi.mocked(signedInUser).mockResolvedValue(null);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await post(BODY);

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "sign_in_required" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid body without calling Mapbox", async () => {
    vi.stubEnv("MAPBOX_DIRECTIONS_TOKEN", "pk.test");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    expect((await post({ origin: { lat: 999, lng: 0 }, stations: [] })).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("answers 503 without a token, so the client falls back to straight lines", async () => {
    vi.stubEnv("MAPBOX_DIRECTIONS_TOKEN", "");
    expect((await post(BODY)).status).toBe(503);
  });

  it("answers 503 when Mapbox fails, and never logs coordinates or the token", async () => {
    vi.stubEnv("MAPBOX_DIRECTIONS_TOKEN", "pk.secret");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("rate limited", { status: 429 })));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    expect((await post(BODY)).status).toBe(503);

    const logged = log.mock.calls.flat().join(" ");
    expect(logged).toContain("429");
    expect(logged).not.toMatch(/45\.5|73\.5|pk\.secret/);
  });

  it("answers 503 on a network error or timeout", async () => {
    vi.stubEnv("MAPBOX_DIRECTIONS_TOKEN", "pk.test");
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new DOMException("The operation timed out", "TimeoutError");
    }));
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect((await post(BODY)).status).toBe(503);
  });

  it("refuses a loop from one address before calling Mapbox (429 + Retry-After)", async () => {
    vi.stubEnv("MAPBOX_DIRECTIONS_TOKEN", "pk.test");
    const fetchMock = vi.fn(async () => Response.json({ code: "Ok", distances: [[0, 1830.4, 2675.1]] }));
    vi.stubGlobal("fetch", fetchMock);
    const fromLoop = () =>
      POST(
        new Request("http://localhost/api/detours", {
          method: "POST",
          headers: { "x-forwarded-for": "198.51.100.23" },
          body: JSON.stringify(BODY),
        }),
      );

    const statuses = [];
    for (let i = 0; i < 31; i++) statuses.push((await fromLoop()).status);

    expect(statuses.slice(0, 30).every((status) => status === 200)).toBe(true);
    const refused = await fromLoop();
    expect(statuses[30]).toBe(429);
    expect(refused.headers.get("Retry-After")).toMatch(/^\d+$/);
    expect(fetchMock).toHaveBeenCalledTimes(30); // the refused ones never reached Mapbox
  });
});
