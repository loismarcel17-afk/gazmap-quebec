// Where the driver is along the route, and what comes next.
import type { LatLng } from "@/features/geo/geo";
import type { Maneuver, Route } from "@/features/routing/directions";
import { bearingOfSegment, createLine, projectOnLine, type Line } from "./geometry";

/** A route prepared for guidance: computed once, used for every GPS position. */
export interface NavigationModel {
  route: Route;
  line: Line;
  /** Meters from the start of the line where each step begins */
  stepStarts: number[];
}

export interface Progress {
  distanceAlong: number;
  distanceFromLine: number;
  /** Meters left to the destination, along the route */
  remainingMeters: number;
  /** Seconds left, from Mapbox's per-step durations (traffic-aware) */
  remainingSeconds: number;
  stepIndex: number;
  /** Meters to the next maneuver (end of the current step) */
  distanceToManeuver: number;
  /** What to show in the banner; null on the last step */
  nextManeuver: { maneuver: Maneuver; text: string } | null;
  /** Direction of travel along the route, degrees from north */
  bearing: number;
}

export function createNavigationModel(route: Route): NavigationModel {
  const line = createLine(route.geometry);
  // Step distances come from Mapbox; our flattened line length differs by a few
  // meters. Scale step boundaries to the line so they line up exactly.
  const stepsTotal = route.steps.reduce((sum, step) => sum + step.distanceMeters, 0);
  const scale = stepsTotal > 0 ? line.length / stepsTotal : 1;
  const stepStarts: number[] = [];
  let start = 0;
  for (const step of route.steps) {
    stepStarts.push(start);
    start += step.distanceMeters * scale;
  }
  return { route, line, stepStarts };
}

export function computeProgress(model: NavigationModel, position: LatLng, previous?: Progress): Progress {
  const { route, line, stepStarts } = model;
  const projection = projectOnLine(line, position, previous?.distanceAlong ?? 0);
  const along = projection.distanceAlong;

  // Last step whose start is behind us. Zero-length steps (arrive) are skipped
  // until we're really at the end.
  let stepIndex = 0;
  for (let i = 0; i < stepStarts.length; i++) {
    if (stepStarts[i] <= along && (route.steps[i].distanceMeters > 0 || along >= line.length)) stepIndex = i;
  }
  const stepEnd = stepIndex + 1 < stepStarts.length ? stepStarts[stepIndex + 1] : line.length;
  const step = route.steps[stepIndex];

  // Remaining time: the unfinished part of the current step + all later steps.
  const stepLength = stepEnd - stepStarts[stepIndex];
  const leftInStep = stepLength > 0 ? (stepEnd - along) / stepLength : 0;
  const laterSeconds = route.steps.slice(stepIndex + 1).reduce((sum, s) => sum + s.durationSeconds, 0);

  return {
    distanceAlong: along,
    distanceFromLine: projection.distanceFromLine,
    remainingMeters: Math.max(0, line.length - along),
    remainingSeconds: Math.max(0, leftInStep * step.durationSeconds + laterSeconds),
    stepIndex,
    distanceToManeuver: Math.max(0, stepEnd - along),
    nextManeuver: step.banner ? { maneuver: step.banner.maneuver, text: step.banner.text } : null,
    bearing: bearingOfSegment(line, projection.segmentIndex),
  };
}
