// Runs a guided trip: GPS, route requests, voice, screen lock, arrival.
//
// Plain TypeScript, not React: the screen subscribes to it. Browser services are
// passed in ("dependencies"), so tests drive it with a fake GPS and a fake voice.
import type { LatLng } from "@/features/geo/geo";
import type { Position } from "@/features/navigation/geometry";
import { hasArrived } from "@/features/navigation/arrival";
import { MAX_USABLE_ACCURACY_METERS } from "@/features/navigation/off-route";
import type { Progress } from "@/features/navigation/progress";
import { handleFix, replaceRoute, startGuidance, type GuidanceState } from "@/features/navigation/session";
import type { Route } from "@/features/routing/directions";
import { MAX_TRIP_DURATION_MS, type WatchedFix, type WatchError } from "./position-watch";
import type { StoredTrip } from "./trip-storage";
import type { ScreenWakeLock } from "./wake-lock";

export type FallbackReason = "unsupported" | "denied" | "unavailable" | "expired";

export interface GuidanceSnapshot {
  phase: "notice" | "locating" | "routing" | "guiding" | "fallback" | "ended";
  fallbackReason: FallbackReason | null;
  /** A saved trip to this station can be resumed */
  resumable: boolean;
  geometry: Position[] | null;
  position: LatLng | null;
  /** Map orientation, degrees from north */
  bearing: number;
  progress: Progress | null;
  /** Estimated arrival time (ms since epoch), from the remaining duration */
  arrivalAt: number | null;
  rerouting: boolean;
  weakGps: boolean;
  wakeLockRefused: boolean;
  muted: boolean;
}

export interface GuidanceDependencies {
  watchPosition: (
    onFix: (fix: WatchedFix) => void,
    onError: (error: WatchError) => void,
    onExpired: () => void,
    maxDurationMs: number,
  ) => () => void;
  /** null = no route (routing unavailable, network…) */
  fetchRoute: (origin: LatLng, stationId: string, heading?: number) => Promise<Route | null>;
  wakeLock: ScreenWakeLock;
  speak: (text: string) => void;
  stopSpeaking: () => void;
  loadTrip: (stationId: string) => StoredTrip | null;
  saveTrip: (trip: Omit<StoredTrip, "version">) => void;
  clearTrip: () => void;
  now: () => number;
  /** Arrived → feedback card (with the trip's history id, if any); stopped → back to the map */
  onEnd: (reason: "arrived" | "stopped", tripId: string | null) => void;
  startedMessage: string;
  /** Records the trip in the user's history; null if not signed in (or it failed). */
  recordStart: () => Promise<string | null>;
  recordEnd: (tripId: string, status: "arrived" | "cancelled") => void;
}

export interface GuidanceController {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => GuidanceSnapshot;
  start: () => Promise<void>;
  stop: () => void;
  toggleMute: () => void;
  /** Page visible again: the browser dropped the wake lock while hidden */
  onVisible: () => void;
  /** Screen unmounted: stop GPS and wake lock, keep the trip saved for resuming */
  dispose: () => void;
}

export function createGuidanceController(
  stationId: string,
  station: LatLng,
  deps: GuidanceDependencies,
): GuidanceController {
  let snapshot: GuidanceSnapshot = {
    phase: "notice",
    fallbackReason: null,
    resumable: deps.loadTrip(stationId) !== null,
    geometry: null,
    position: null,
    bearing: 0,
    progress: null,
    arrivalAt: null,
    rerouting: false,
    weakGps: false,
    wakeLockRefused: false,
    muted: false,
  };
  const listeners = new Set<() => void>();
  let session: GuidanceState | null = null;
  let stopWatching: (() => void) | null = null;
  let startedAt = 0;
  let routing = false;
  // History record of this trip. A promise: "Stop" may come before it's created.
  let tripId: Promise<string | null> = Promise.resolve(null);
  let savedTripId: string | null = null;

  // New object on every change: React compares snapshots by identity.
  function update(changes: Partial<GuidanceSnapshot>) {
    snapshot = { ...snapshot, ...changes };
    listeners.forEach((listener) => listener());
  }

  // Read through a function: after an `await`, TypeScript would otherwise assume
  // the phase is still what it checked before, though update() may have changed it.
  const phase = (): GuidanceSnapshot["phase"] => snapshot.phase;
  const isOver = () => phase() === "ended" || phase() === "fallback";

  function save() {
    if (session) {
      deps.saveTrip({ stationId, route: session.model.route, startedAt, spoken: session.spoken, tripId: savedTripId });
    }
  }

  function release() {
    stopWatching?.();
    stopWatching = null;
    void deps.wakeLock.release();
    deps.stopSpeaking();
  }

  function end(reason: "arrived" | "stopped" | "expired") {
    release();
    const status = reason === "arrived" ? "arrived" : "cancelled";
    void tripId.then((id) => id && deps.recordEnd(id, status));
    deps.clearTrip();
    session = null;
    if (reason === "expired") {
      update({ phase: "fallback", fallbackReason: "expired" });
    } else {
      update({ phase: "ended" });
      deps.onEnd(reason, savedTripId);
    }
  }

  async function requestRoute(fix: WatchedFix, heading?: number) {
    if (routing) return;
    routing = true;
    update(session ? { rerouting: true } : { phase: "routing" });
    const route = await deps.fetchRoute(fix, stationId, heading);
    routing = false;
    if (isOver()) return; // stopped meanwhile

    if (!route) {
      if (session) {
        update({ rerouting: false }); // keep guiding on the old route; will retry after 15 s
      } else {
        release();
        update({ phase: "fallback", fallbackReason: "unavailable" });
      }
      return;
    }
    session = session ? replaceRoute(session, route) : startGuidance(route);
    save();
    update({ phase: "guiding", rerouting: false, geometry: route.geometry });
    handlePosition(fix); // first instruction right away
  }

  function handlePosition(fix: WatchedFix) {
    update({ position: { lat: fix.lat, lng: fix.lng }, weakGps: !(fix.accuracy <= MAX_USABLE_ACCURACY_METERS) });

    if (!session) {
      if (hasArrived(fix, station)) end("arrived");
      else void requestRoute(fix);
      return;
    }

    const before = session.spoken.length;
    const outcome = handleFix(session, fix, station, deps.now());
    if (outcome.arrived) {
      end("arrived");
      return;
    }
    session = outcome.state;
    if (session.spoken.length !== before) save();
    if (outcome.speak && !snapshot.muted) deps.speak(outcome.speak);

    const progress = outcome.state.progress;
    const onRoute = progress !== null && progress.distanceFromLine <= 50;
    // On the route, follow the road; off it, follow the car's own heading.
    const bearing = onRoute ? progress.bearing : (fix.heading ?? progress?.bearing ?? snapshot.bearing);
    update({ progress, bearing, arrivalAt: progress ? deps.now() + progress.remainingSeconds * 1000 : null });

    if (outcome.reroute) void requestRoute(fix, fix.heading ?? undefined);
  }

  function handleWatchError(error: WatchError) {
    if (error === "denied") {
      release();
      update({ phase: "fallback", fallbackReason: "denied" });
    } else {
      update({ weakGps: true }); // temporary: the watch keeps trying
    }
  }

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => snapshot,

    async start() {
      if (phase() !== "notice") return;
      // Speak first, while still inside the user's tap: mobile browsers only
      // allow audio that starts from a user gesture.
      if (!snapshot.muted) deps.speak(deps.startedMessage);

      const stored = deps.loadTrip(stationId);
      if (stored) {
        // Resumed: same trip, same history record.
        session = startGuidance(stored.route, stored.spoken);
        startedAt = stored.startedAt;
        savedTripId = stored.tripId ?? null;
        tripId = Promise.resolve(savedTripId);
        update({ phase: "guiding", geometry: stored.route.geometry });
      } else {
        startedAt = deps.now();
        // Not awaited: guidance never waits for (or depends on) the history.
        tripId = deps.recordStart().then((id) => {
          savedTripId = id;
          save();
          return id;
        });
        update({ phase: "locating" });
      }

      const remaining = MAX_TRIP_DURATION_MS - (deps.now() - startedAt);
      stopWatching = deps.watchPosition(handlePosition, handleWatchError, () => end("expired"), remaining);

      const locked = await deps.wakeLock.acquire();
      // Stopped (or arrived) while the lock was being granted: don't keep the screen on.
      if (isOver()) {
        void deps.wakeLock.release();
        return;
      }
      update({ wakeLockRefused: !locked });
    },

    stop: () => end("stopped"),

    toggleMute() {
      if (!snapshot.muted) deps.stopSpeaking();
      update({ muted: !snapshot.muted });
    },

    onVisible() {
      if (phase() === "guiding" || phase() === "locating" || phase() === "routing") {
        void deps.wakeLock.acquire().then((locked) => update({ wakeLockRefused: !locked }));
      }
    },

    dispose: release,
  };
}
