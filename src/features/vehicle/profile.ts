// Vehicle profile: which car, how big the tank, how full. Kept on the device only
// (no account needed); later synced for signed-in users (PLAN.md task 10).
import type { VehicleInput } from "@/features/recommendation/fill-up-cost";
import type { FuelType } from "@/features/stations/types";

/** NRCan fuel codes we keep: X regular, Z premium, D diesel. */
export type NrcanFuelType = "X" | "Z" | "D";

/** Snapshot of the chosen NRCan variant: the profile still works if the reference row changes. */
export interface ChosenModel {
  id: number;
  modelYear: number;
  make: string;
  model: string;
  engineL: number;
  transmission: string;
  fuelType: NrcanFuelType;
  combinedLPer100Km: number;
}

export interface VehicleProfile {
  model: ChosenModel | null;
  /** Litres; null = unknown (fill-up defaults to 40 L) */
  tankCapacityL: number | null;
  /** 0 (empty) to 1 (full); null = unknown */
  currentLevel: number | null;
}

export const EMPTY_PROFILE: VehicleProfile = { model: null, tankCapacityL: null, currentLevel: null };

/** Accepted tank sizes: from small cars to large pickups with an extra tank. */
export const TANK_CAPACITY_RANGE = { min: 20, max: 200 } as const;

const FUEL_BY_NRCAN_CODE: Record<NrcanFuelType, FuelType> = { X: "regular", Z: "premium", D: "diesel" };

/** NRCan fuel code → the station fuel to compare prices for. */
export function fuelForModel(model: ChosenModel | null): FuelType | null {
  return model ? FUEL_BY_NRCAN_CODE[model.fuelType] : null;
}

/** Profile → input of the fill-up cost calculation (task 6). */
export function vehicleInput(profile: VehicleProfile): VehicleInput {
  return {
    tankCapacityL: profile.tankCapacityL,
    currentLevel: profile.currentLevel,
    consumptionLPer100Km: profile.model?.combinedLPer100Km ?? null,
  };
}

/**
 * Validates data read back from localStorage. It may come from an older version
 * of the app, a browser extension or a manual edit: keep what's valid, drop the rest.
 */
export function sanitizeProfile(stored: unknown): VehicleProfile {
  if (!isObject(stored)) return EMPTY_PROFILE;

  const capacity = stored.tankCapacityL;
  const level = stored.currentLevel;
  return {
    model: sanitizeModel(stored.model),
    tankCapacityL:
      typeof capacity === "number" && capacity >= TANK_CAPACITY_RANGE.min && capacity <= TANK_CAPACITY_RANGE.max
        ? capacity
        : null,
    currentLevel: typeof level === "number" && level >= 0 && level <= 1 ? level : null,
  };
}

function sanitizeModel(value: unknown): ChosenModel | null {
  if (!isObject(value)) return null;
  const { id, modelYear, make, model, engineL, transmission, fuelType, combinedLPer100Km } = value;
  const valid =
    typeof id === "number" &&
    typeof modelYear === "number" &&
    typeof make === "string" &&
    typeof model === "string" &&
    typeof engineL === "number" &&
    typeof transmission === "string" &&
    (fuelType === "X" || fuelType === "Z" || fuelType === "D") &&
    typeof combinedLPer100Km === "number" &&
    combinedLPer100Km > 0 &&
    combinedLPer100Km <= 50;
  return valid
    ? { id, modelYear, make, model, engineL, transmission, fuelType, combinedLPer100Km }
    : null;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
