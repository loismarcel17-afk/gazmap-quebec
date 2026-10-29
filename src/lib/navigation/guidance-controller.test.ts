import { describe, expect, it, vi } from "vitest";
import { MONTREAL_DIRECTIONS_RESPONSE, pointAlong, STATION } from "@/features/navigation/fixtures/montreal-route";
import { parseDirections, type Route } from "@/features/routing/directions";
import { createGuidanceController, type GuidanceDependencies } from "./guidance-controller";
import type { WatchedFix, WatchError } from "./position-watch";
import type { StoredTrip } from "./trip-storage";

const route = parseDirections(MONTREAL_DIRECTIONS_RESPONSE);

/** Fake browser: a GPS we move by hand, a voice that records, a clock we set. */
function fakeDeps(overrides: Partial<GuidanceDependencies> = {}) {
  let onFix: ((fix: WatchedFix) => void) | null = null;
  let onError: ((error: WatchError) => void) | null = null;
  let stored: StoredTrip | null = null;
  let clock = 0;
  const spoken: string[] = [];
  const deps: GuidanceDependencies = {
    watchPosition: vi.fn((fix, error) => {
      onFix = fix;
      onError = error;
      return () => {
        onFix = null;
      };
    }),
    fetchRoute: vi.fn(async (): Promise<Route | null> => route),
    wakeLock: { acquire: vi.fn(async () => true), release: vi.fn(async () => {}) },
    speak: vi.fn((text: string) => {
      spoken.push(text);
    }),
    stopSpeaking: vi.fn(),
    loadTrip: vi.fn(() => stored),
    saveTrip: vi.fn((trip) => {
      stored = { version: 1, ...trip };
    }),
    clearTrip: vi.fn(() => {
      stored = null;
    }),
    now: () => clock,
    onEnd: vi.fn(),
    startedMessage: "Guidage démarré.",
    recordStart: vi.fn(async () => "trip-1"),
    recordEnd: vi.fn(),
    ...overrides,
  };
  return {
    deps,
    spoken,
    /** Move the fake GPS `meters` along the demo route (and `offset` to the side). */
    async moveTo(meters: number, offset = 0) {
      clock += 1000;
      onFix?.({ ...pointAlong(meters, offset), accuracy: 8, heading: null });
      await Promise.resolve(); // let a pending route request settle
      await Promise.resolve();
    },
    fail: (error: WatchError) => onError?.(error),
    watching: () => onFix !== null,
    stored: () => stored,
  };
}

describe("guidance controller", () => {
  it("guides from the first fix to arrival, then ends on the feedback card", async () => {
    const gps = fakeDeps();
    const controller = createGuidanceController("abc", STATION, gps.deps);
    expect(controller.getSnapshot().phase).toBe("notice");

    await controller.start();
    expect(controller.getSnapshot().phase).toBe("locating");
    expect(gps.deps.wakeLock.acquire).toHaveBeenCalled();

    await gps.moveTo(0); // first fix → route request
    expect(gps.deps.fetchRoute).toHaveBeenCalledWith(expect.objectContaining({ accuracy: 8 }), "abc", undefined);
    expect(controller.getSnapshot().phase).toBe("guiding");

    for (const meters of [200, 420, 565, 610, 700, 930]) await gps.moveTo(meters);
    expect(gps.spoken).toEqual([
      "Guidage démarré.",
      expect.stringContaining("Dans 600 mètres"),
      expect.stringContaining("Dans 200 mètres"),
      "Tournez à gauche sur Boulevard Saint-Laurent.",
      expect.stringContaining("Continuez"),
      "Votre destination se trouve sur la droite.",
    ]);

    await gps.moveTo(980); // within 50 m of the station
    expect(gps.deps.onEnd).toHaveBeenCalledWith("arrived", "trip-1"); // feedback card for this trip
    expect(gps.watching()).toBe(false); // watchPosition stopped
    expect(gps.deps.wakeLock.release).toHaveBeenCalled();
    expect(gps.stored()).toBeNull(); // nothing left to resume
  });

  it("reroutes with the current position after leaving the route", async () => {
    const gps = fakeDeps();
    const controller = createGuidanceController("abc", STATION, gps.deps);
    await controller.start();
    await gps.moveTo(100);
    for (const meters of [150, 170, 190]) await gps.moveTo(meters, 120);
    expect(gps.deps.fetchRoute).toHaveBeenCalledTimes(2);
  });

  it("keeps guiding on the old route if a reroute fails", async () => {
    const fetchRoute = vi.fn<GuidanceDependencies["fetchRoute"]>().mockResolvedValueOnce(route).mockResolvedValue(null);
    const gps = fakeDeps({ fetchRoute });
    const controller = createGuidanceController("abc", STATION, gps.deps);
    await controller.start();
    await gps.moveTo(100);
    for (const meters of [150, 170, 190]) await gps.moveTo(meters, 120);
    expect(controller.getSnapshot()).toMatchObject({ phase: "guiding", rerouting: false });
  });

  it("falls back to external apps when no route can be computed", async () => {
    const gps = fakeDeps({ fetchRoute: vi.fn(async () => null) });
    const controller = createGuidanceController("abc", STATION, gps.deps);
    await controller.start();
    await gps.moveTo(0);
    expect(controller.getSnapshot()).toMatchObject({ phase: "fallback", fallbackReason: "unavailable" });
    expect(gps.watching()).toBe(false);
  });

  it("falls back when the user refuses location", async () => {
    const gps = fakeDeps();
    const controller = createGuidanceController("abc", STATION, gps.deps);
    await controller.start();
    gps.fail("denied");
    expect(controller.getSnapshot()).toMatchObject({ phase: "fallback", fallbackReason: "denied" });
    expect(gps.deps.wakeLock.release).toHaveBeenCalled();
  });

  it("keeps guiding, with a warning, when the wake lock is refused", async () => {
    const gps = fakeDeps({ wakeLock: { acquire: vi.fn(async () => false), release: vi.fn(async () => {}) } });
    const controller = createGuidanceController("abc", STATION, gps.deps);
    await controller.start();
    await gps.moveTo(0);
    expect(controller.getSnapshot()).toMatchObject({ phase: "guiding", wakeLockRefused: true });
  });

  it("resumes a saved trip without a new route request or repeated instructions", async () => {
    const first = fakeDeps();
    const controller = createGuidanceController("abc", STATION, first.deps);
    await controller.start();
    await first.moveTo(0);
    await first.moveTo(420);
    controller.dispose(); // user left the page
    expect(first.watching()).toBe(false);
    expect(first.stored()).not.toBeNull(); // trip kept for resuming

    const saved = first.stored();
    const second = fakeDeps({ loadTrip: () => saved });
    const resumed = createGuidanceController("abc", STATION, second.deps);
    expect(resumed.getSnapshot().resumable).toBe(true);
    await resumed.start();
    expect(resumed.getSnapshot().phase).toBe("guiding");
    await second.moveTo(430);
    expect(second.deps.fetchRoute).not.toHaveBeenCalled();
    expect(second.spoken).toEqual(["Guidage démarré."]); // "in 200 m" was already said
  });

  it("mute silences instructions", async () => {
    const gps = fakeDeps();
    const controller = createGuidanceController("abc", STATION, gps.deps);
    controller.toggleMute();
    await controller.start();
    await gps.moveTo(0);
    await gps.moveTo(420);
    expect(gps.spoken).toEqual([]);
  });

  it("stop ends everything and goes back", async () => {
    const gps = fakeDeps();
    const controller = createGuidanceController("abc", STATION, gps.deps);
    await controller.start();
    await gps.moveTo(0);
    controller.stop();
    expect(gps.deps.onEnd).toHaveBeenCalledWith("stopped", "trip-1");
    expect(gps.watching()).toBe(false);
    expect(gps.stored()).toBeNull();
  });

  it("asks for the wake lock again when the page becomes visible", async () => {
    const gps = fakeDeps();
    const controller = createGuidanceController("abc", STATION, gps.deps);
    await controller.start();
    await gps.moveTo(0);
    controller.onVisible();
    expect(gps.deps.wakeLock.acquire).toHaveBeenCalledTimes(2);
  });

  it("records the trip in the history: started, then arrived", async () => {
    const gps = fakeDeps();
    const controller = createGuidanceController("abc", STATION, gps.deps);
    await controller.start();
    expect(gps.deps.recordStart).toHaveBeenCalledOnce();
    await gps.moveTo(0);
    expect(gps.stored()?.tripId).toBe("trip-1"); // kept for resuming
    await gps.moveTo(980);
    await Promise.resolve();
    expect(gps.deps.recordEnd).toHaveBeenCalledWith("trip-1", "arrived");
  });

  it("records a stop as cancelled, even if the trip record wasn't created yet", async () => {
    let create: (id: string) => void = () => {};
    const gps = fakeDeps({ recordStart: () => new Promise((resolve) => (create = resolve)) });
    const controller = createGuidanceController("abc", STATION, gps.deps);
    await controller.start();
    controller.stop(); // before the history insert answered
    create("trip-2");
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(gps.deps.recordEnd).toHaveBeenCalledWith("trip-2", "cancelled");
  });

  it("does not record anything without an account, and guides anyway", async () => {
    const gps = fakeDeps({ recordStart: vi.fn(async () => null) });
    const controller = createGuidanceController("abc", STATION, gps.deps);
    await controller.start();
    await gps.moveTo(0);
    await gps.moveTo(980);
    expect(gps.deps.recordEnd).not.toHaveBeenCalled();
    expect(gps.deps.onEnd).toHaveBeenCalledWith("arrived", null);
  });

  it("a resumed trip keeps its history record (no second trip)", async () => {
    const saved: StoredTrip = { version: 1, stationId: "abc", route, startedAt: 0, spoken: [], tripId: "trip-9" };
    const gps = fakeDeps({ loadTrip: () => saved });
    const controller = createGuidanceController("abc", STATION, gps.deps);
    await controller.start();
    expect(gps.deps.recordStart).not.toHaveBeenCalled();
    controller.stop();
    await Promise.resolve();
    expect(gps.deps.recordEnd).toHaveBeenCalledWith("trip-9", "cancelled");
  });
});
