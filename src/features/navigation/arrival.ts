import { distanceMeters, type LatLng } from "@/features/geo/geo";

/** Within this distance of the station, the trip is over (CLAUDE.md). */
export const ARRIVAL_METERS = 50;

/**
 * Arrival is measured to the station itself, not to the end of the route line:
 * the route may end on the street while the pumps are set back in a lot.
 */
export function hasArrived(position: LatLng, station: LatLng): boolean {
  return distanceMeters(position, station) <= ARRIVAL_METERS;
}
