import { describe, expect, it } from "vitest";
import { boundsAround, circleRing, destination, distanceMeters } from "./geo";

const MONTREAL = { lat: 45.5017, lng: -73.5673 };
const QUEBEC = { lat: 46.8139, lng: -71.208 };

describe("distanceMeters", () => {
  it("is zero for the same point", () => {
    expect(distanceMeters(MONTREAL, MONTREAL)).toBe(0);
  });

  it("matches the known Montréal–Québec distance (~233 km straight line)", () => {
    expect(distanceMeters(MONTREAL, QUEBEC) / 1000).toBeCloseTo(233, 0);
  });

  it("is symmetric", () => {
    expect(distanceMeters(MONTREAL, QUEBEC)).toBeCloseTo(distanceMeters(QUEBEC, MONTREAL), 6);
  });
});

describe("destination", () => {
  it("lands at the requested distance", () => {
    for (const bearing of [0, 45, 90, 200]) {
      expect(distanceMeters(MONTREAL, destination(MONTREAL, 10_000, bearing))).toBeCloseTo(10_000, 3);
    }
  });
});

describe("circleRing", () => {
  it("is closed and every point is on the circle", () => {
    const ring = circleRing(MONTREAL, 5_000, 16);
    expect(ring).toHaveLength(17);
    expect(ring[0]).toEqual(ring[16]);
    for (const [lng, lat] of ring) {
      expect(distanceMeters(MONTREAL, { lat, lng })).toBeCloseTo(5_000, 3);
    }
  });
});

describe("boundsAround", () => {
  it("contains the center and is wider in degrees of longitude than latitude at Québec latitudes", () => {
    const [[west, south], [east, north]] = boundsAround(MONTREAL, 10_000);
    expect(west).toBeLessThan(MONTREAL.lng);
    expect(east).toBeGreaterThan(MONTREAL.lng);
    expect(south).toBeLessThan(MONTREAL.lat);
    expect(north).toBeGreaterThan(MONTREAL.lat);
    // Meridians converge toward the pole: 10 km spans more degrees of longitude.
    expect(east - west).toBeGreaterThan(north - south);
  });
});
