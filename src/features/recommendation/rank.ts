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

/** Road distances for a planned trip A → B (Mapbox Matrix, see routing/route-matrix.ts). */
export interface RouteDistances {
  /** A → B, meters */
  directMeters: number;
  /** A → station → B, meters, per station id; null = no road route found */
  viaMeters: Record<string, number | null>;
}

/**
 * Typical road / straight-line ratio for getting off a route and back: used
 * until real road distances arrive. Leaving a highway for a station 1 km away
 * means an exit, a few streets and the on-ramp back: 1.4 × 2 km is a fair guess.
 */
export const OFF_ROUTE_CIRCUITY = 1.4;

/**
 * Stations along a planned trip, ordered by total fill-up cost.
 *
 * Detour = (A → station → B) − (A → B), by road when `routeDistances` has the
 * station: the CLAUDE.md formula, `Detour.kind = "route"`. Otherwise: a round
 * trip from the route line to the station, scaled by OFF_ROUTE_CIRCUITY.
 * A station right on the way costs (almost) nothing extra; one 4 km off the
 * highway has to be really cheaper to come first.
 *
 * `along` gives each station's straight-line distance to the route line
 * (NearbyStation.distanceMeters), as stationsAlongRoute returns it.
 */
export function rankAlongRoute(
  along: NearbyStation[],
  vehicle: VehicleInput = {},
  routeDistances: RouteDistances | null = null,
): RankedStation[] {
  return along
    .map((entry): RankedStation => {
      const via = routeDistances?.viaMeters[entry.station.id];
      return typeof via === "number" && routeDistances
        ? {
            ...entry,
            cost: fillUpCost(entry.price, { kind: "route", viaStationMeters: via, directMeters: routeDistances.directMeters }, vehicle),
            detourSource: "road",
          }
        : {
            ...entry,
            cost: fillUpCost(
              entry.price,
              { kind: "roundTrip", oneWayMeters: entry.distanceMeters * OFF_ROUTE_CIRCUITY },
              vehicle,
            ),
            detourSource: "estimated",
          };
    })
    .sort(
      (a, b) =>
        a.cost.total - b.cost.total ||
        a.cost.detourMeters - b.cost.detourMeters ||
        (a.station.id < b.station.id ? -1 : a.station.id > b.station.id ? 1 : 0),
    );
}
