import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signedInUser } from "@/lib/api-auth";
import { POST } from "./route";

vi.mock("@/lib/api-auth", () => ({ signedInUser: vi.fn() }));

let client = 0;
const post = (body: unknown) =>
  POST(
    new Request("http://localhost/api/parcours/detours", {
      method: "POST",
      headers: { "x-forwarded-for": `198.51.100.${++client}` },
      body: JSON.stringify(body),
    }),
  );
const BODY = {
  origin: { lat: 45.5017, lng: -73.5673 },
  destination: { lat: 46.8139, lng: -71.208 },
  stations: [{ id: "a", lat: 45.9, lng: -72.9 }],
};

beforeEach(() => {
  vi.stubEnv("MAPBOX_DIRECTIONS_TOKEN", "pk.secret");
  vi.mocked(signedInUser).mockResolvedValue("user-1");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("POST /api/parcours/detours", () => {
  it("combines the two Matrix answers into A → station → B", async () => {
    const fetchMock = vi.fn<typeof fetch>(async (url) =>
      Response.json(
        new URL(String(url)).searchParams.get("sources") === "0"
          ? { code: "Ok", distances: [[250_000, 90_000]] }
          : { code: "Ok", distances: [[161_000]] },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const response = await post(BODY);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ directMeters: 250_000, viaMeters: { a: 251_000 } });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("refuses visitors without an account before calling Mapbox", async () => {
    vi.mocked(signedInUser).mockResolvedValue(null);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect((await post(BODY)).status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid body", async () => {
    expect((await post({ ...BODY, stations: [] })).status).toBe(400);
  });

  it("answers 503 when one of the calls fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 429 })));
    expect((await post(BODY)).status).toBe(503);
  });
});
