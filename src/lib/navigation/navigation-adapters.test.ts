// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { parseDirections } from "@/features/routing/directions";
import { MONTREAL_DIRECTIONS_RESPONSE } from "@/features/navigation/fixtures/montreal-route";
import { MAX_TRIP_DURATION_MS } from "./position-watch";
import { pickFrenchVoice } from "./speech";
import { clearTrip, loadTrip, saveTrip } from "./trip-storage";
import { createScreenWakeLock, wakeLockSupported } from "./wake-lock";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  window.localStorage.clear();
});

const voice = (lang: string, name = lang) => ({ lang, name }) as SpeechSynthesisVoice;

describe("pickFrenchVoice", () => {
  it("prefers Québec French", () => {
    expect(pickFrenchVoice([voice("en-US"), voice("fr-FR"), voice("fr-CA")])?.lang).toBe("fr-CA");
  });

  it("falls back to any French, whatever the spelling of the code", () => {
    expect(pickFrenchVoice([voice("en-US"), voice("fr_FR")])?.lang).toBe("fr_FR");
  });

  it("returns null without French voices (the browser picks from lang)", () => {
    expect(pickFrenchVoice([voice("en-US")])).toBeNull();
  });
});

describe("trip storage", () => {
  const route = parseDirections(MONTREAL_DIRECTIONS_RESPONSE);

  it("saves and resumes the trip to the same station", () => {
    saveTrip({ stationId: "abc", route, startedAt: 1_000, spoken: ["0:0"] });
    expect(loadTrip("abc", 2_000)).toMatchObject({ stationId: "abc", spoken: ["0:0"] });
    expect(loadTrip("other", 2_000)).toBeNull();
  });

  it("forgets a trip older than 2 hours", () => {
    saveTrip({ stationId: "abc", route, startedAt: 0, spoken: [] });
    expect(loadTrip("abc", MAX_TRIP_DURATION_MS + 1)).toBeNull();
    expect(window.localStorage.getItem("gazmap-trip")).toBeNull();
  });

  it("ignores corrupted data", () => {
    window.localStorage.setItem("gazmap-trip", "{not json");
    expect(loadTrip("abc")).toBeNull();
    window.localStorage.setItem("gazmap-trip", JSON.stringify({ version: 1, stationId: "abc", route: {} }));
    expect(loadTrip("abc")).toBeNull();
  });

  it("survives a localStorage that throws", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("QuotaExceededError");
    });
    expect(() => saveTrip({ stationId: "abc", route, startedAt: 0, spoken: [] })).not.toThrow();
    clearTrip();
  });
});

describe("screen wake lock", () => {
  it("reports unsupported browsers", async () => {
    expect(wakeLockSupported()).toBe(false); // jsdom has no wakeLock
    expect(await createScreenWakeLock().acquire()).toBe(false);
  });

  it("acquires, then releases", async () => {
    const release = vi.fn(async () => {});
    vi.stubGlobal("navigator", { ...navigator, wakeLock: { request: async () => ({ released: false, release }) } });
    const lock = createScreenWakeLock();
    expect(await lock.acquire()).toBe(true);
    await lock.release();
    expect(release).toHaveBeenCalledOnce();
  });

  it("returns false when the browser refuses (low battery…)", async () => {
    vi.stubGlobal("navigator", {
      ...navigator,
      wakeLock: { request: async () => Promise.reject(new DOMException("NotAllowedError")) },
    });
    expect(await createScreenWakeLock().acquire()).toBe(false);
  });
});
