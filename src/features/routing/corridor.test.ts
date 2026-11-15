import { describe, expect, it } from "vitest";
import type { Position } from "@/features/navigation/geometry";
import type { Station } from "@/features/stations/types";
import { stationsAlongRoute } from "./corridor";

// A 100 km route along the 45.5° parallel, due east from Montréal-ish.
const START = { lat: 45.5, lng: -73.6 };
const KM_PER_DEGREE_LAT = 111.195;
const KM_PER_DEGREE_LNG = KM_PER_DEGREE_LAT * Math.cos((START.lat * Math.PI) / 180);
const END = { lat: START.lat, lng: START.lng + 100 / KM_PER_DEGREE_LNG };
const ROUTE: Position[] = [
  [START.lng, START.lat],
  [END.lng, END.lat],
];

function station(id: string, kmAlong: number, kmOff: number, regular: number | null = 1800): Station {
  const at = { lat: START.lat + kmOff / KM_PER_DEGREE_LAT, lng: START.lng + kmAlong / KM_PER_DEGREE_LNG };
  return {
    id,
    name: id,
    brand: null,
    address: "",
    region: "",
    postalCode: "",
    ...at,
    prices: { regular, premium: null, diesel: null },
  };
}

describe("stationsAlongRoute", () => {
  it("keeps stations within 3 km of the line, on either side, in route order", () => {
    const result = stationsAlongRoute(
      [station("far-north", 50, 5), station("km80", 80, -2.5), station("km20", 20, 0.4), station("km50", 50, 1)],
      ROUTE,
      "regular",
    );
    expect(result.map((entry) => entry.station.id)).toEqual(["km20", "km50", "km80"]);
    expect(result[0].distanceMeters).toBeCloseTo(400, -1);
    expect(result[0].distanceAlongMeters).toBeCloseTo(20_000, -2);
  });

  it("drops stations past the ends of the route, and those not selling the fuel", () => {
    const result = stationsAlongRoute(
      [station("before-start", -5, 0), station("after-end", 106, 0), station("no-regular", 30, 0, null)],
      ROUTE,
      "regular",
    );
    expect(result).toEqual([]);
  });

  it("accepts a narrower corridor", () => {
    const result = stationsAlongRoute([station("km50", 50, 1)], ROUTE, "regular", 500);
    expect(result).toEqual([]);
  });

  it("returns nothing for a degenerate line", () => {
    expect(stationsAlongRoute([station("a", 0, 0)], [ROUTE[0]], "regular")).toEqual([]);
  });
});
