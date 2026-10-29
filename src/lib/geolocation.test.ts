import { describe, expect, it } from "vitest";
import { GeolocationFailure, getCurrentPosition } from "./geolocation";

/** Fake navigator.geolocation that answers immediately with `outcome`. */
function fakeGeolocation(outcome: { lat: number; lng: number } | { code: number }): Geolocation {
  return {
    getCurrentPosition: (success: PositionCallback, failure?: PositionErrorCallback | null) => {
      if ("code" in outcome) failure?.({ code: outcome.code } as GeolocationPositionError);
      else success({ coords: { latitude: outcome.lat, longitude: outcome.lng } } as GeolocationPosition);
    },
  } as Geolocation;
}

describe("getCurrentPosition", () => {
  it("resolves with the position", async () => {
    await expect(getCurrentPosition(fakeGeolocation({ lat: 46.8, lng: -71.2 }))).resolves.toEqual({
      lat: 46.8,
      lng: -71.2,
    });
  });

  it.each([
    [1, "denied"],
    [2, "unavailable"],
    [3, "unavailable"],
  ])("maps error code %i to %s", async (code, reason) => {
    await expect(getCurrentPosition(fakeGeolocation({ code }))).rejects.toMatchObject({ reason });
  });

  it("fails cleanly when the browser has no geolocation", async () => {
    const result = getCurrentPosition(null);
    await expect(result).rejects.toBeInstanceOf(GeolocationFailure);
    await expect(result).rejects.toMatchObject({ reason: "unsupported" });
  });
});
