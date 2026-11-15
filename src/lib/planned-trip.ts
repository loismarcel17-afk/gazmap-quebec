// The destination of a planned trip, kept on this device only (localStorage,
// try/catch: CLAUDE.md), so that after the fill-up the app offers "Continue to
// <destination>". Never sent to our database. Forgotten after 12 hours, on
// arrival, or when the user stops.
import { useSyncExternalStore } from "react";
import { parsePoint } from "@/features/routing/matrix";
import type { LatLng } from "@/features/geo/geo";

const KEY = "gazmap-planned-trip";
export const PLANNED_TRIP_MAX_AGE_MS = 12 * 60 * 60 * 1000;

export interface PlannedDestination extends LatLng {
  label: string;
}

export function savePlannedDestination(destination: PlannedDestination, now = Date.now()): void {
  try {
    const { lat, lng, label } = destination;
    window.localStorage.setItem(KEY, JSON.stringify({ lat, lng, label, savedAt: now }));
  } catch {
    // Not saved: the trip to the station still works, only "continue" won't be offered.
  }
}

export function loadPlannedDestination(now = Date.now()): PlannedDestination | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw) as Record<string, unknown>;
    const position = parsePoint(stored);
    const fresh = typeof stored.savedAt === "number" && now - stored.savedAt < PLANNED_TRIP_MAX_AGE_MS;
    if (position && fresh && typeof stored.label === "string" && stored.label.length > 0) {
      return { ...position, label: stored.label };
    }
  } catch {
    // unreadable: forget it below
  }
  clearPlannedDestination();
  return null;
}

export function clearPlannedDestination(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // nothing to do
  }
}

const noSubscription = () => () => {};
// useSyncExternalStore needs the same object for the same value on every call.
let cached: { raw: string; value: PlannedDestination | null } | null = null;
function snapshot(): PlannedDestination | null {
  const value = loadPlannedDestination();
  const raw = JSON.stringify(value);
  if (cached?.raw !== raw) cached = { raw, value };
  return cached.value;
}

/** The planned destination, read on the client; undefined while rendering on the server. */
export function usePlannedDestination(): PlannedDestination | null | undefined {
  return useSyncExternalStore(noSubscription, snapshot, () => undefined);
}
