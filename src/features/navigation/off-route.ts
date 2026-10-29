// Off-route detection: decides when to ask for a new route.
//
// One GPS fix far from the line proves nothing (GPS jumps near buildings), so we
// wait for 3 consecutive fixes more than 50 m away. Then at most one reroute
// every 15 s: each reroute is a request to Mapbox (cost, and a position sent).

export const OFF_ROUTE_METERS = 50;
export const OFF_ROUTE_FIXES = 3;
export const REROUTE_INTERVAL_MS = 15_000;
/** A fix less precise than this can't tell on-route from off-route: ignore it. */
export const MAX_USABLE_ACCURACY_METERS = 100;

export interface OffRouteState {
  consecutiveOff: number;
  lastRerouteAt: number | null;
}

export const INITIAL_OFF_ROUTE: OffRouteState = { consecutiveOff: 0, lastRerouteAt: null };

/**
 * @param distanceFromLine meters between the fix and the route
 * @param accuracy GPS accuracy radius in meters (from the Geolocation API)
 * @param now current time in ms (passed in, so tests control the clock)
 */
export function updateOffRoute(
  state: OffRouteState,
  distanceFromLine: number,
  accuracy: number,
  now: number,
): { state: OffRouteState; reroute: boolean } {
  if (!(accuracy <= MAX_USABLE_ACCURACY_METERS)) return { state, reroute: false };

  const consecutiveOff = distanceFromLine > OFF_ROUTE_METERS ? state.consecutiveOff + 1 : 0;
  const waitedEnough = state.lastRerouteAt === null || now - state.lastRerouteAt >= REROUTE_INTERVAL_MS;

  if (consecutiveOff >= OFF_ROUTE_FIXES && waitedEnough) {
    // Start counting again: if the new route doesn't fit either, 3 more fixes are needed.
    return { state: { consecutiveOff: 0, lastRerouteAt: now }, reroute: true };
  }
  return { state: { ...state, consecutiveOff }, reroute: false };
}
