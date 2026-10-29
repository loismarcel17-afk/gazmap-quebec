// Total cost of a fill-up: fuel bought + fuel burned to get there (CLAUDE.md, "Règles métier").
//
//   litres     = tank capacity × (1 − current level)        default 40 L if unknown
//   detour km  = route via station − direct route           default: round trip from the position
//   detour $   = detour km × consumption L/100 km / 100 × station price
//   total      = station price × litres + detour $
//
// Money is in TENTHS OF A CENT, the same unit as prices (1859 = 185.9 ¢/L), and is
// never rounded here: sorting uses exact values, rounding happens only for display.

/** Litres bought when the tank size or level is unknown. */
export const DEFAULT_LITRES = 40;
/** L/100 km when no vehicle is known (CLAUDE.md). */
export const DEFAULT_CONSUMPTION_L_PER_100KM = 9.5;

export interface VehicleInput {
  /** Tank capacity in litres */
  tankCapacityL?: number | null;
  /** Current level, 0 (empty) to 1 (full) */
  currentLevel?: number | null;
  /** Combined consumption from the NRCan ratings */
  consumptionLPer100Km?: number | null;
}

/** How far out of the way the station is. */
export type Detour =
  /** Real routes (PLAN.md task 8): extra distance = via station − direct. */
  | { kind: "route"; viaStationMeters: number; directMeters: number }
  /** No destination / no routing: drive to the station and back. */
  | { kind: "roundTrip"; oneWayMeters: number };

export interface FillUpCost {
  litres: number;
  detourMeters: number;
  /** Litres burned by the detour */
  detourLitres: number;
  /** price × litres, tenths of a cent */
  fuelCost: number;
  /** detour litres × price, tenths of a cent */
  detourCost: number;
  /** fuelCost + detourCost, tenths of a cent */
  total: number;
}

const isUsable = (value: number | null | undefined): value is number =>
  typeof value === "number" && Number.isFinite(value);

/** Litres to buy: what's missing in the tank, or 40 L if we don't know the tank. */
export function litresToBuy(vehicle: VehicleInput = {}): number {
  const { tankCapacityL, currentLevel } = vehicle;
  if (!isUsable(tankCapacityL) || tankCapacityL <= 0 || !isUsable(currentLevel)) return DEFAULT_LITRES;
  // A level slightly out of [0, 1] (rounding in a slider) must not give negative litres.
  const level = Math.min(1, Math.max(0, currentLevel));
  return tankCapacityL * (1 - level);
}

/** Consumption in L/100 km, or the default if unknown or nonsensical. */
export function consumption(vehicle: VehicleInput = {}): number {
  const value = vehicle.consumptionLPer100Km;
  return isUsable(value) && value > 0 ? value : DEFAULT_CONSUMPTION_L_PER_100KM;
}

/** Extra meters driven because of the station. Never negative. */
export function detourMeters(detour: Detour): number {
  const meters =
    detour.kind === "route" ? detour.viaStationMeters - detour.directMeters : 2 * detour.oneWayMeters;
  // Routing engines can return a "via" route a few meters shorter than the direct
  // one: a detour is never a gain.
  return isUsable(meters) ? Math.max(0, meters) : 0;
}

export function fillUpCost(priceTenths: number, detour: Detour, vehicle: VehicleInput = {}): FillUpCost {
  const litres = litresToBuy(vehicle);
  const extraMeters = detourMeters(detour);
  const detourLitres = (extraMeters / 1000) * (consumption(vehicle) / 100);
  const fuelCost = priceTenths * litres;
  const detourCost = detourLitres * priceTenths;
  return {
    litres,
    detourMeters: extraMeters,
    detourLitres,
    fuelCost,
    detourCost,
    total: fuelCost + detourCost,
  };
}
