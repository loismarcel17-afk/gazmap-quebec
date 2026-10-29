import { describe, expect, it } from "vitest";
import {
  consumption,
  DEFAULT_CONSUMPTION_L_PER_100KM,
  DEFAULT_LITRES,
  detourMeters,
  fillUpCost,
  litresToBuy,
} from "./fill-up-cost";

describe("litresToBuy", () => {
  it("fills what's missing in the tank", () => {
    expect(litresToBuy({ tankCapacityL: 60, currentLevel: 0.25 })).toBe(45);
    expect(litresToBuy({ tankCapacityL: 50, currentLevel: 0 })).toBe(50);
  });

  it("buys nothing when the tank is full", () => {
    expect(litresToBuy({ tankCapacityL: 60, currentLevel: 1 })).toBe(0);
  });

  it("clamps a level slightly outside 0–1 instead of buying negative litres", () => {
    expect(litresToBuy({ tankCapacityL: 60, currentLevel: 1.02 })).toBe(0);
    expect(litresToBuy({ tankCapacityL: 60, currentLevel: -0.1 })).toBe(60);
  });

  it.each([
    ["no vehicle", undefined],
    ["empty vehicle", {}],
    ["unknown capacity", { currentLevel: 0.5 }],
    ["unknown level", { tankCapacityL: 60 }],
    ["null values", { tankCapacityL: null, currentLevel: null }],
    ["zero capacity", { tankCapacityL: 0, currentLevel: 0.5 }],
    ["negative capacity", { tankCapacityL: -60, currentLevel: 0.5 }],
    ["NaN level", { tankCapacityL: 60, currentLevel: Number.NaN }],
    ["infinite capacity", { tankCapacityL: Number.POSITIVE_INFINITY, currentLevel: 0.5 }],
  ])("defaults to 40 L with %s", (_, vehicle) => {
    expect(litresToBuy(vehicle)).toBe(DEFAULT_LITRES);
  });
});

describe("consumption", () => {
  it("uses the vehicle's consumption", () => {
    expect(consumption({ consumptionLPer100Km: 7.2 })).toBe(7.2);
  });

  it.each([
    ["no vehicle", undefined],
    ["unknown", { consumptionLPer100Km: null }],
    ["zero", { consumptionLPer100Km: 0 }],
    ["negative", { consumptionLPer100Km: -5 }],
    ["NaN", { consumptionLPer100Km: Number.NaN }],
  ])("defaults to 9.5 L/100 km with %s", (_, vehicle) => {
    expect(consumption(vehicle)).toBe(DEFAULT_CONSUMPTION_L_PER_100KM);
  });
});

describe("detourMeters", () => {
  it("is the extra distance of the route via the station", () => {
    expect(detourMeters({ kind: "route", viaStationMeters: 12_400, directMeters: 10_000 })).toBe(2_400);
  });

  it("is zero when the station is on the way", () => {
    expect(detourMeters({ kind: "route", viaStationMeters: 10_000, directMeters: 10_000 })).toBe(0);
  });

  it("is never negative (routing noise)", () => {
    expect(detourMeters({ kind: "route", viaStationMeters: 9_990, directMeters: 10_000 })).toBe(0);
  });

  it("is a round trip when there is no route", () => {
    expect(detourMeters({ kind: "roundTrip", oneWayMeters: 3_000 })).toBe(6_000);
  });

  it("treats invalid distances as no detour", () => {
    expect(detourMeters({ kind: "roundTrip", oneWayMeters: Number.NaN })).toBe(0);
  });
});

describe("fillUpCost", () => {
  it("applies the CLAUDE.md formula (worked example)", () => {
    // 185.9 ¢/L, 40 L, 3 km away (6 km round trip), 9.5 L/100 km:
    //   fuel   = 1859 × 40                  = 74 360 tenths of a cent (74,36 $)
    //   detour = 6 km × 9.5 / 100 = 0.57 L  → 0.57 × 1859 = 1 059.63 (1,06 $)
    //   total  = 75 419.63 (75,42 $)
    const cost = fillUpCost(1859, { kind: "roundTrip", oneWayMeters: 3_000 });
    expect(cost.litres).toBe(40);
    expect(cost.detourMeters).toBe(6_000);
    expect(cost.detourLitres).toBeCloseTo(0.57, 10);
    expect(cost.fuelCost).toBe(74_360);
    expect(cost.detourCost).toBeCloseTo(1_059.63, 6);
    expect(cost.total).toBeCloseTo(75_419.63, 6);
  });

  it("uses the vehicle's tank and consumption", () => {
    // 60 L tank at 1/4 → 45 L; 7 L/100 km; 2 km detour by route
    const cost = fillUpCost(
      1829,
      { kind: "route", viaStationMeters: 12_000, directMeters: 10_000 },
      { tankCapacityL: 60, currentLevel: 0.25, consumptionLPer100Km: 7 },
    );
    expect(cost.litres).toBe(45);
    expect(cost.fuelCost).toBe(1829 * 45);
    expect(cost.detourLitres).toBeCloseTo(0.14, 10);
    expect(cost.total).toBeCloseTo(1829 * 45 + 0.14 * 1829, 6);
  });

  it("costs only the fuel when the station is on the way", () => {
    const cost = fillUpCost(1859, { kind: "route", viaStationMeters: 5_000, directMeters: 5_000 });
    expect(cost.detourCost).toBe(0);
    expect(cost.total).toBe(cost.fuelCost);
  });

  it("does not round: two nearly equal options stay distinguishable", () => {
    const a = fillUpCost(1859, { kind: "roundTrip", oneWayMeters: 3_000 });
    const b = fillUpCost(1859, { kind: "roundTrip", oneWayMeters: 3_001 });
    expect(b.total).toBeGreaterThan(a.total);
    expect(b.total - a.total).toBeLessThan(1); // less than a tenth of a cent apart
  });

  it("shows why the cheapest price per litre is not always the cheapest fill-up", () => {
    // 1 ¢/L cheaper, but 15 km away vs. 1 km:
    const far = fillUpCost(1849, { kind: "roundTrip", oneWayMeters: 15_000 });
    const near = fillUpCost(1859, { kind: "roundTrip", oneWayMeters: 1_000 });
    // far:  1849 × 40 + 30 km × 0.095 × 1849 = 73 960 + 5 269.65 = 79 229.65
    // near: 1859 × 40 +  2 km × 0.095 × 1859 = 74 360 +   353.21 = 74 713.21
    expect(far.total).toBeCloseTo(79_229.65, 6);
    expect(near.total).toBeCloseTo(74_713.21, 6);
    expect(near.total).toBeLessThan(far.total);
  });
});
