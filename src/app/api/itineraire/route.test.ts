import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MONTREAL_DIRECTIONS_RESPONSE, START, STATION } from "@/features/navigation/fixtures/montreal-route";

// The station lookup reads Supabase: replace it so the test needs no database.
const fetchStationLocation = vi.fn();
vi.mock("@/lib/station-location", () => ({ fetchStationLocation: (id: string) => fetchStationLocation(id) }));

const { POST } = await import("./route");

const post = (body: unknown) =>
  POST(new Request("http://localhost/api/itineraire", { method: "POST", body: JSON.stringify(body) }));

beforeEach(() => {
  vi.stubEnv("MAPBOX_DIRECTIONS_TOKEN", "pk.secret");
  fetchStationLocation.mockResolvedValue({ ...STATION, name: "Station test", brand: "Shell" });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  fetchStationLocation.mockReset();
});

describe("POST /api/itineraire", () => {
  it("returns the trimmed route to the station", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => Response.json(MONTREAL_DIRECTIONS_RESPONSE));
    vi.stubGlobal("fetch", fetchMock);

    const response = await post({ origin: START, stationId: "abc" });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.route.distanceMeters).toBe(1000);
    expect(body.route.steps).toHaveLength(3);
    expect(fetchStationLocation).toHaveBeenCalledWith("abc");
    // The destination is the station from the database, not something the client sent.
    expect(String(fetchMock.mock.calls[0][0])).toContain(`${STATION.lng.toFixed(5)},${STATION.lat.toFixed(5)}`);
  });

  it("passes the heading on reroutes", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => Response.json(MONTREAL_DIRECTIONS_RESPONSE));
    vi.stubGlobal("fetch", fetchMock);
    await post({ origin: START, stationId: "abc", heading: -30 });
    expect(new URL(String(fetchMock.mock.calls[0][0])).searchParams.get("bearings")).toBe("330,45;");
  });

  it.each([
    ["no station id", { origin: START }],
    ["a bad origin", { origin: { lat: "x", lng: 0 }, stationId: "abc" }],
    ["coordinates instead of a station", { origin: START, destination: STATION }],
  ])("rejects %s", async (_, body) => {
    expect((await post(body)).status).toBe(400);
  });

  it("answers 404 for an unknown station", async () => {
    fetchStationLocation.mockResolvedValue(null);
    expect((await post({ origin: START, stationId: "nope" })).status).toBe(404);
  });

  it("answers 503 without a token", async () => {
    vi.stubEnv("MAPBOX_DIRECTIONS_TOKEN", "");
    expect((await post({ origin: START, stationId: "abc" })).status).toBe(503);
  });

  it("answers 503 when Mapbox fails, without logging coordinates or the token", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 500 })));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    expect((await post({ origin: START, stationId: "abc" })).status).toBe(503);
    const logged = log.mock.calls.flat().join(" ");
    expect(logged).toContain("500");
    expect(logged).not.toMatch(/45\.50|73\.56|pk\.secret/);
  });
});
