import { describe, expect, it } from "vitest";
import { destination } from "@/features/geo/geo";
import { findNearbyStations } from "./nearby";
import type { Station } from "./types";

const ORIGIN = { lat: 46.8139, lng: -71.208 };

/** A station `km` east of ORIGIN */
function station(id: string, km: number, regular: number | null): Station {
  const { lat, lng } = destination(ORIGIN, km * 1000, 90);
  return {
    id,
    name: id,
    brand: null,
    address: "",
    region: "",
    postalCode: "",
    lat,
    lng,
    prices: { regular, premium: null, diesel: null },
  };
}

describe("findNearbyStations", () => {
  it("keeps stations inside the radius, cheapest first", () => {
    const stations = [station("far", 12, 1700), station("b", 3, 1859), station("a", 8, 1829)];
    const result = findNearbyStations(stations, ORIGIN, 10_000, "regular");
    expect(result.map((r) => r.station.id)).toEqual(["a", "b"]);
    expect(result[0].price).toBe(1829);
    expect(result[0].distanceMeters).toBeCloseTo(8000, 0);
  });

  it("breaks price ties by distance", () => {
    const stations = [station("farther", 5, 1859), station("closer", 2, 1859)];
    expect(findNearbyStations(stations, ORIGIN, 10_000, "regular").map((r) => r.station.id)).toEqual([
      "closer",
      "farther",
    ]);
  });

  it("orders exact ties (same price, same place) by id, like the SQL function", () => {
    const stations = [station("b", 2, 1859), station("a", 2, 1859)];
    expect(findNearbyStations(stations, ORIGIN, 10_000, "regular").map((r) => r.station.id)).toEqual([
      "a",
      "b",
    ]);
  });

  it("skips stations that don't sell the fuel", () => {
    expect(findNearbyStations([station("x", 1, null)], ORIGIN, 10_000, "regular")).toEqual([]);
  });
});
