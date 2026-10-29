// watchPosition during a trip only (CLAUDE.md): stopped on arrival, on "Stop",
// when leaving the screen, and after 2 hours at most. Positions stay on the device.
import type { Fix } from "@/features/navigation/session";

export const MAX_TRIP_DURATION_MS = 2 * 60 * 60 * 1000;

export interface WatchedFix extends Fix {
  /** Device heading in degrees, when moving; null otherwise */
  heading: number | null;
}

export type WatchError = "denied" | "unavailable";

/** Starts watching; returns the function that stops it. */
export function watchPosition(
  onFix: (fix: WatchedFix) => void,
  onError: (error: WatchError) => void,
  onExpired: () => void,
  /** Less than 2 h when resuming a trip started earlier */
  maxDurationMs = MAX_TRIP_DURATION_MS,
): () => void {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    onError("unavailable");
    return () => {};
  }
  const id = navigator.geolocation.watchPosition(
    ({ coords }) =>
      onFix({
        lat: coords.latitude,
        lng: coords.longitude,
        accuracy: coords.accuracy,
        heading: coords.heading !== null && Number.isFinite(coords.heading) ? coords.heading : null,
      }),
    (error) => onError(error.code === 1 ? "denied" : "unavailable"),
    // Navigation needs GPS precision (unlike "nearby stations").
    { enableHighAccuracy: true, maximumAge: 1_000, timeout: 20_000 },
  );
  const timer = setTimeout(() => {
    stop();
    onExpired();
  }, Math.max(0, maxDurationMs));

  function stop() {
    clearTimeout(timer);
    navigator.geolocation.clearWatch(id);
  }
  return stop;
}
