// Guidance session: for each GPS fix, decides everything at once — progress,
// off-route, what to say, arrival. Pure: the screen only carries out the
// decisions (speak, request a new route, end the trip). Testable without a browser.
import type { LatLng } from "@/features/geo/geo";
import type { Route } from "@/features/routing/directions";
import { hasArrived } from "./arrival";
import { INITIAL_OFF_ROUTE, updateOffRoute, type OffRouteState } from "./off-route";
import { computeProgress, createNavigationModel, type NavigationModel, type Progress } from "./progress";
import { dueAnnouncement } from "./voice";

export interface GuidanceState {
  model: NavigationModel;
  progress: Progress | null;
  offRoute: OffRouteState;
  /** Keys of announcements already spoken on this route */
  spoken: string[];
}

export interface Fix extends LatLng {
  /** GPS accuracy radius, meters */
  accuracy: number;
}

export interface FixOutcome {
  state: GuidanceState;
  /** Text to speak now, if any */
  speak: string | null;
  /** Ask for a new route from this fix */
  reroute: boolean;
  /** Within 50 m of the station: end the trip */
  arrived: boolean;
}

export function startGuidance(route: Route, spoken: string[] = []): GuidanceState {
  return { model: createNavigationModel(route), progress: null, offRoute: INITIAL_OFF_ROUTE, spoken };
}

export function handleFix(state: GuidanceState, fix: Fix, station: LatLng, now: number): FixOutcome {
  if (hasArrived(fix, station)) return { state, speak: null, reroute: false, arrived: true };

  const progress = computeProgress(state.model, fix, state.progress ?? undefined);
  const offRoute = updateOffRoute(state.offRoute, progress.distanceFromLine, fix.accuracy, now);
  // Off the route, the instructions no longer apply: stay silent until the new route.
  const onRoute = progress.distanceFromLine <= 50;
  const { announcement, markSpoken } = onRoute
    ? dueAnnouncement(state.model, progress, new Set(state.spoken))
    : { announcement: null, markSpoken: [] };

  return {
    state: { ...state, progress, offRoute: offRoute.state, spoken: [...state.spoken, ...markSpoken] },
    speak: announcement?.text ?? null,
    reroute: offRoute.reroute,
    arrived: false,
  };
}

/** A new route (after a reroute): fresh model and instructions, same off-route timer. */
export function replaceRoute(state: GuidanceState, route: Route): GuidanceState {
  return { ...startGuidance(route), offRoute: { ...state.offRoute, consecutiveOff: 0 } };
}
