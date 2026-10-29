import { describe, expect, it } from "vitest";
import { EMPTY_PROFILE, fuelForModel, sanitizeProfile, vehicleInput, type ChosenModel } from "./profile";

const CIVIC: ChosenModel = {
  id: 42,
  modelYear: 2026,
  make: "Honda",
  model: "Civic Sedan",
  engineL: 2,
  transmission: "AV7",
  fuelType: "X",
  combinedLPer100Km: 6.7,
};

describe("fuelForModel", () => {
  it.each([
    ["X", "regular"],
    ["Z", "premium"],
    ["D", "diesel"],
  ] as const)("NRCan %s → %s", (code, fuel) => {
    expect(fuelForModel({ ...CIVIC, fuelType: code })).toBe(fuel);
  });

  it("is null without a vehicle", () => {
    expect(fuelForModel(null)).toBeNull();
  });
});

describe("vehicleInput", () => {
  it("feeds the fill-up calculation", () => {
    expect(vehicleInput({ model: CIVIC, tankCapacityL: 47, currentLevel: 0.25 })).toEqual({
      tankCapacityL: 47,
      currentLevel: 0.25,
      consumptionLPer100Km: 6.7,
    });
  });

  it("leaves unknowns to the calculation's defaults", () => {
    expect(vehicleInput(EMPTY_PROFILE)).toEqual({
      tankCapacityL: null,
      currentLevel: null,
      consumptionLPer100Km: null,
    });
  });
});

describe("sanitizeProfile", () => {
  it("keeps a valid profile as is", () => {
    const profile = { model: CIVIC, tankCapacityL: 47, currentLevel: 0.5 };
    expect(sanitizeProfile(profile)).toEqual(profile);
  });

  it.each([
    ["nothing", undefined],
    ["null", null],
    ["a string", "Civic"],
    ["an empty object", {}],
  ])("returns an empty profile for %s", (_, stored) => {
    expect(sanitizeProfile(stored)).toEqual(EMPTY_PROFILE);
  });

  it("drops only the invalid parts", () => {
    expect(sanitizeProfile({ model: CIVIC, tankCapacityL: 5000, currentLevel: 1.5 })).toEqual({
      model: CIVIC,
      tankCapacityL: null,
      currentLevel: null,
    });
    expect(sanitizeProfile({ model: { ...CIVIC, fuelType: "E" }, tankCapacityL: 60, currentLevel: 0 })).toEqual({
      model: null,
      tankCapacityL: 60,
      currentLevel: 0,
    });
  });

  it("drops extra fields it doesn't know", () => {
    const sanitized = sanitizeProfile({ model: { ...CIVIC, secret: "x" }, tankCapacityL: 47, currentLevel: 0 });
    expect(sanitized.model).toEqual(CIVIC);
  });
});
