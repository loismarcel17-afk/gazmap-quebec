import type { RoadDistances } from "@/features/routing/matrix";
import type { NearbyStation } from "@/features/stations/nearby";
import { fillUpCost, type FillUpCost, type VehicleInput } from "./fill-up-cost";

export interface RankedStation extends NearbyStation {
  cost: FillUpCost;
  /**
   * How the detour was measured:
   * - "road": real road distance (Mapbox);
   * - "estimated": straight line × the road/straight ratio measured on nearby stations;
   * - "straightLine": as the crow flies (no road distance at all, e.g. no Mapbox token).
   */
  detourSource: "road" | "estimated" | "straightLine";
}

/**
 * Typical "road / straight line" ratio around here: the median over stations
 * with a road distance. null if none. Median, not mean: one station behind a
 * river (ratio 5) must not inflate everyone else's detour.
 */
export function roadCircuity(nearby: NearbyStation[], roadDistances: RoadDistances): number | null {
  const ratios = nearby
    .map((entry) => {
      const road = roadDistances[entry.station.id];
      return typeof road === "number" && entry.distanceMeters > 0 ? road / entry.distanceMeters : null;
    })
    .filter((ratio): ratio is number => ratio !== null && Number.isFinite(ratio))
    .sort((a, b) => a - b);
  if (ratios.length === 0) return null;
  const middle = Math.floor(ratios.length / 2);
  // A road is never shorter than the straight line (ratio ≥ 1), whatever rounding says.
  return Math.max(1, ratios.length % 2 ? ratios[middle] : (ratios[middle - 1] + ratios[middle]) / 2);
}

/**
 * Nearby stations ordered by total fill-up cost, cheapest first.
 *
 * Detour = round trip from the position: by road when `roadDistances` has the
 * station (PLAN.md task 8). Stations without a road distance get their straight
 * line scaled by the local circuity, so they aren't favored by an optimistic
 * estimate. Ties: closer first, then by id, so the order is always the same.
 *
 * Only cost decides the order: sponsored stations are labeled, never moved (CLAUDE.md).
 */
export function rankByTotalCost(
  nearby: NearbyStation[],
  vehicle: VehicleInput = {},
  roadDistances: RoadDistances = {},
): RankedStation[] {
  const circuity = roadCircuity(nearby, roadDistances);
  return nearby
    .map((entry): RankedStation => {
      const road = roadDistances[entry.station.id];
      const [oneWayMeters, detourSource]: [number, RankedStation["detourSource"]] =
        typeof road === "number"
          ? [road, "road"]
          : circuity !== null
            ? [entry.distanceMeters * circuity, "estimated"]
            : [entry.distanceMeters, "straightLine"];
      return {
        ...entry,
        cost: fillUpCost(entry.price, { kind: "roundTrip", oneWayMeters }, vehicle),
        detourSource,
      };
    })
    .sort(
      (a, b) =>
        a.cost.total - b.cost.total ||
        a.distanceMeters - b.distanceMeters ||
        (a.station.id < b.station.id ? -1 : a.station.id > b.station.id ? 1 : 0),
    );
}
