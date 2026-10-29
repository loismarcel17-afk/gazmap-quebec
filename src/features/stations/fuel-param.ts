import type { FuelType } from "./types";

// Fuel in URLs, in French (CLAUDE.md: URLs en français): /trajet/abc?carburant=super
const TO_PARAM: Record<FuelType, string> = { regular: "ordinaire", premium: "super", diesel: "diesel" };

export function fuelToParam(fuel: FuelType): string {
  return TO_PARAM[fuel];
}

/** Anything unknown or missing → regular (the most common fuel). */
export function fuelFromParam(param: string | string[] | undefined | null): FuelType {
  const value = Array.isArray(param) ? param[0] : param;
  const match = (Object.keys(TO_PARAM) as FuelType[]).find((fuel) => TO_PARAM[fuel] === value);
  return match ?? "regular";
}
