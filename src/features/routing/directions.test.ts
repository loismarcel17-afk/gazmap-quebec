import { describe, expect, it } from "vitest";
import { MONTREAL_DIRECTIONS_RESPONSE, START, STATION } from "@/features/navigation/fixtures/montreal-route";
import { directionsUrl, parseDirections } from "./directions";

describe("directionsUrl", () => {
  it("asks for everything guidance needs, in French", () => {
    const url = new URL(directionsUrl(START, STATION, "pk.test"));
    expect(url.pathname).toMatch(/^\/directions\/v5\/mapbox\/driving-traffic\/-73\.56860,45\.50650;/);
    expect(Object.fromEntries(url.searchParams)).toEqual({
      steps: "true",
      voice_instructions: "true",
      banner_instructions: "true",
      language: "fr",
      voice_units: "metric",
      geometries: "geojson",
      overview: "full",
      access_token: "pk.test",
    });
  });

  it("keeps the current direction of travel when rerouting", () => {
    const url = new URL(directionsUrl(START, STATION, "pk.test", 61.4));
    expect(url.searchParams.get("bearings")).toBe("61,45;");
  });
});

describe("parseDirections", () => {
  const route = parseDirections(MONTREAL_DIRECTIONS_RESPONSE);

  it("keeps the line, totals and steps", () => {
    expect(route.distanceMeters).toBe(1000);
    expect(route.durationSeconds).toBe(132);
    expect(route.geometry.length).toBeGreaterThan(10);
    expect(route.steps).toHaveLength(3);
  });

  it("keeps per step: maneuver, street, banner for the next maneuver, voice instructions", () => {
    expect(route.steps[0]).toEqual({
      distanceMeters: 600,
      durationSeconds: 72,
      maneuver: { type: "depart", modifier: null },
      name: "Rue Sainte-Catherine Est",
      banner: { text: "Boulevard Saint-Laurent", maneuver: { type: "turn", modifier: "left" } },
      voice: [
        expect.objectContaining({ distanceAlongGeometry: 600 }),
        expect.objectContaining({ distanceAlongGeometry: 200 }),
        { distanceAlongGeometry: 40, announcement: "Tournez à gauche sur Boulevard Saint-Laurent." },
      ],
    });
  });

  it("drops what the client doesn't need (SSML, uuid, weights…)", () => {
    const json = JSON.stringify(route);
    expect(json).not.toContain("ssml");
    expect(json).not.toContain("uuid");
    expect(json).not.toContain("weight");
  });

  it.each([
    ["no route found", { code: "NoRoute", routes: [] }],
    ["an error", { code: "InvalidInput", message: "bad" }],
    ["a broken geometry", { code: "Ok", routes: [{ geometry: { coordinates: [[1]] }, legs: [{ steps: [] }] }] }],
    ["garbage", 42],
  ])("throws on %s", (_, response) => {
    expect(() => parseDirections(response)).toThrow();
  });
});
