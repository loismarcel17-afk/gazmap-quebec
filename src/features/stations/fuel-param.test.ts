import { describe, expect, it } from "vitest";
import { fuelFromParam, fuelToParam } from "./fuel-param";

describe("fuel URL parameter", () => {
  it.each([
    ["regular", "ordinaire"],
    ["premium", "super"],
    ["diesel", "diesel"],
  ] as const)("%s ↔ %s", (fuel, param) => {
    expect(fuelToParam(fuel)).toBe(param);
    expect(fuelFromParam(param)).toBe(fuel);
  });

  it.each([undefined, null, "", "e85", "premium"])("falls back to regular for %j", (param) => {
    expect(fuelFromParam(param)).toBe("regular");
  });

  it("takes the first value of a repeated parameter", () => {
    expect(fuelFromParam(["super", "diesel"])).toBe("premium");
  });
});
