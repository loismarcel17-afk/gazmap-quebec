// The trip in progress, saved on the device so guidance resumes where it was
// when the user leaves the page and comes back. localStorage only, try/catch
// (CLAUDE.md); expires with the 2-hour trip limit.
import type { Route } from "@/features/routing/directions";
import { MAX_TRIP_DURATION_MS } from "./position-watch";

const KEY = "gazmap-trip";

export interface StoredTrip {
  version: 1;
  stationId: string;
  route: Route;
  startedAt: number;
  spoken: string[];
  /** History record (signed-in users), so a resumed trip isn't counted twice */
  tripId?: string | null;
}

export function saveTrip(trip: Omit<StoredTrip, "version">): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ version: 1, ...trip }));
  } catch {
    // Not saved: guidance still works, it just won't resume after leaving.
  }
}

/** The saved trip to this station, if recent and well-formed. */
export function loadTrip(stationId: string, now = Date.now()): StoredTrip | null {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const trip = JSON.parse(raw) as Partial<StoredTrip>;
    const valid =
      trip.version === 1 &&
      trip.stationId === stationId &&
      typeof trip.startedAt === "number" &&
      now - trip.startedAt < MAX_TRIP_DURATION_MS &&
      Array.isArray(trip.spoken) &&
      Array.isArray(trip.route?.geometry) &&
      trip.route.geometry.length >= 2 &&
      Array.isArray(trip.route.steps);
    if (valid) return trip as StoredTrip;
  } catch {
    // corrupted: fall through
  }
  clearTrip();
  return null;
}

export function clearTrip(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // nothing to do
  }
}
