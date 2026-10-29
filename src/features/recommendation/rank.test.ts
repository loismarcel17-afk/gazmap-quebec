import { describe, expect, it } from "vitest";
import type { NearbyStation } from "@/features/stations/nearby";
import type { Station } from "@/features/stations/types";
import { rankByTotalCost, roadCircuity } from "./rank";

function nearby(id: string, price: number, distanceMeters: number, sponsored = false): NearbyStation {
  const station: Station = {
    id,
    name: id,
    brand: null,
    address: "",
    region: "",
    postalCode: "",
    lat: 46.8,
    lng: -71.2,
    prices: { regular: price, premium: null, diesel: null },
    sponsored,
  };
  return { station, price, distanceMeters };
}

const ids = (ranked: { station: Station }[]) => ranked.map((entry) => entry.station.id);

describe("rankByTotalCost", () => {
  it("puts a slightly pricier but much closer station first", () => {
    const ranked = rankByTotalCost([nearby("cheap-far", 1849, 15_000), nearby("near", 1859, 1_000)]);
    expect(ids(ranked)).toEqual(["near", "cheap-far"]);
  });

  it("keeps the cheaper station first when the detour is small", () => {
    const ranked = rankByTotalCost([nearby("pricier", 1899, 1_000), nearby("cheaper", 1849, 2_000)]);
    expect(ids(ranked)).toEqual(["cheaper", "pricier"]);
  });

  it("depends on how much you buy: a big fill-up makes the price per litre weigh more", () => {
    const options = [nearby("cheap-far", 1829, 6_000), nearby("near", 1859, 500)];
    // 10 L: 3 ¢/L saves 30 ¢ but 11 km more costs ~2 $ → near wins
    const small = rankByTotalCost(options, { tankCapacityL: 50, currentLevel: 0.8 });
    expect(ids(small)).toEqual(["near", "cheap-far"]);
    // 80 L truck tank, 7 L/100 km: 3 ¢/L × 80 L = 2,40 $ saved > ~1,41 $ of detour → far wins
    const big = rankByTotalCost(options, { tankCapacityL: 80, currentLevel: 0, consumptionLPer100Km: 7 });
    expect(ids(big)).toEqual(["cheap-far", "near"]);
  });

  it("attaches the cost breakdown to each station", () => {
    const [first] = rankByTotalCost([nearby("a", 1859, 3_000)]);
    expect(first.cost.total).toBeCloseTo(75_419.63, 6);
    expect(first.distanceMeters).toBe(3_000);
  });

  it("breaks exact ties by distance, then by id", () => {
    const ranked = rankByTotalCost([nearby("b", 1859, 2_000), nearby("a", 1859, 2_000)]);
    expect(ids(ranked)).toEqual(["a", "b"]);
  });

  it("uses road distances when known, and says so", () => {
    // Straight line: "river" (1 km) beats "bridge" (2 km). By road, "river" is
    // 9 km away (no bridge nearby) and loses.
    const ranked = rankByTotalCost([nearby("river", 1859, 1_000), nearby("bridge", 1859, 2_000)], {}, {
      river: 9_000,
      bridge: 2_400,
    });
    expect(ids(ranked)).toEqual(["bridge", "river"]);
    expect(ranked.map((r) => r.detourSource)).toEqual(["road", "road"]);
    expect(ranked[0].cost.detourMeters).toBe(4_800); // round trip by road
    expect(ranked[0].distanceMeters).toBe(2_000); // straight-line distance kept for display / ties
  });

  it("scales missing road distances by the local road/straight ratio, so they aren't favored", () => {
    // b is 3 km away straight, 3.6 km by road (ratio 1.2); a has no road distance.
    const ranked = rankByTotalCost([nearby("a", 1859, 1_000), nearby("b", 1859, 3_000)], {}, { a: null, b: 3_600 });
    const a = ranked.find((r) => r.station.id === "a")!;
    expect(a.detourSource).toBe("estimated");
    expect(a.cost.detourMeters).toBeCloseTo(2 * 1_000 * 1.2, 6);
    expect(ranked.find((r) => r.station.id === "b")?.detourSource).toBe("road");
  });

  it("uses the straight line when no road distance is known at all (no Mapbox token)", () => {
    const ranked = rankByTotalCost([nearby("a", 1859, 1_000)]);
    expect(ranked[0].detourSource).toBe("straightLine");
    expect(ranked[0].cost.detourMeters).toBe(2_000);
  });

  it("never lets a sponsored station move up or down", () => {
    const plain = [nearby("a", 1899, 1_000), nearby("b", 1849, 2_000), nearby("c", 1879, 500)];
    const withSponsor = plain.map((entry) => (entry.station.id === "a" ? nearby("a", 1899, 1_000, true) : entry));
    expect(ids(rankByTotalCost(withSponsor))).toEqual(ids(rankByTotalCost(plain)));
    expect(rankByTotalCost(withSponsor).find((r) => r.station.id === "a")?.station.sponsored).toBe(true);
  });

  it("returns an empty list for no stations", () => {
    expect(rankByTotalCost([])).toEqual([]);
  });

  it("does not modify its input", () => {
    const input = [nearby("far", 1849, 15_000), nearby("near", 1859, 1_000)];
    rankByTotalCost(input);
    expect(ids(input)).toEqual(["far", "near"]);
  });
});

describe("roadCircuity", () => {
  it("is the median road/straight ratio", () => {
    const stations = [nearby("a", 1, 1_000), nearby("b", 1, 1_000), nearby("c", 1, 1_000)];
    expect(roadCircuity(stations, { a: 1_100, b: 1_300, c: 5_000 })).toBeCloseTo(1.3, 6);
  });

  it("is null without any road distance", () => {
    expect(roadCircuity([nearby("a", 1, 1_000)], { a: null })).toBeNull();
  });

  it("is never below 1 (a road can't beat the straight line)", () => {
    expect(roadCircuity([nearby("a", 1, 1_000)], { a: 990 })).toBe(1);
  });
});
