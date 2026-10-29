import { describe, expect, it } from "vitest";
import { computePriceScale } from "./price-scale";
import type { Station } from "./types";

function station(regular: number | null, diesel: number | null = null): Station {
  return {
    id: String(regular),
    name: null,
    brand: null,
    address: "",
    region: "",
    postalCode: "",
    lat: 46,
    lng: -72,
    prices: { regular, premium: null, diesel },
  };
}

describe("computePriceScale", () => {
  it("returns 10th percentile, median and 90th percentile", () => {
    // 1800, 1801, …, 1899
    const stations = Array.from({ length: 100 }, (_, i) => station(1800 + i));
    expect(computePriceScale(stations, "regular")).toEqual({ low: 1809, median: 1849, high: 1889 });
  });

  it("ignores stations that don't sell the fuel", () => {
    const stations = [station(1800, 2900), station(1850, null), station(1900, 2950)];
    expect(computePriceScale(stations, "diesel")).toEqual({ low: 2900, median: 2900, high: 2950 });
  });

  it("is not thrown off by an outlier", () => {
    const stations = [...Array.from({ length: 20 }, () => station(1850)), station(4999)];
    expect(computePriceScale(stations, "regular")?.high).toBe(1850);
  });

  it("returns null when no station has a price", () => {
    expect(computePriceScale([station(null)], "regular")).toBeNull();
  });
});
