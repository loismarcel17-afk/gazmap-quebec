import { describe, expect, it } from "vitest";
import { parseDirections } from "@/features/routing/directions";
import { MONTREAL_DIRECTIONS_RESPONSE, pointAlong, STATION } from "./fixtures/montreal-route";
import { REROUTE_INTERVAL_MS } from "./off-route";
import { handleFix, replaceRoute, startGuidance, type FixOutcome, type GuidanceState } from "./session";

const route = parseDirections(MONTREAL_DIRECTIONS_RESPONSE);

/** Feed fixes (meters along the route, lateral offset) one second apart. */
function simulate(fixes: [number, number?][], initial: GuidanceState = startGuidance(route), t0 = 0): FixOutcome[] {
  let state = initial;
  return fixes.map(([meters, offset = 0], i) => {
    const outcome = handleFix(state, { ...pointAlong(meters, offset), accuracy: 8 }, STATION, t0 + i * 1000);
    state = outcome.state;
    return outcome;
  });
}

describe("guidance session", () => {
  it("drives the whole demo route: speaks, never reroutes, then arrives", () => {
    const outcomes = simulate([[0], [200], [420], [565], [610], [700], [930], [980]]);
    expect(outcomes.filter((o) => o.speak).map((o) => o.speak)).toHaveLength(5);
    expect(outcomes.some((o) => o.reroute)).toBe(false);
    expect(outcomes.at(-1)?.arrived).toBe(true);
    expect(outcomes.slice(0, -1).every((o) => !o.arrived)).toBe(true);
  });

  it("stays silent and asks for a new route after leaving the route", () => {
    const outcomes = simulate([[100], [150, 80], [170, 90], [190, 100]]);
    expect(outcomes.map((o) => o.reroute)).toEqual([false, false, false, true]);
    expect(outcomes.slice(1).every((o) => o.speak === null)).toBe(true);
  });

  it("rate-limits reroutes across new routes (15 s)", () => {
    const offRoute: [number, number][] = Array.from({ length: 20 }, (_, i) => [100 + i * 5, 120]);
    let state = startGuidance(route);
    const reroutes: number[] = [];
    offRoute.forEach(([meters, offset], i) => {
      const outcome = handleFix(state, { ...pointAlong(meters, offset), accuracy: 8 }, STATION, i * 1000);
      // Simulate a new route that still doesn't fit (e.g. the driver keeps going the wrong way).
      state = outcome.reroute ? replaceRoute(outcome.state, route) : outcome.state;
      if (outcome.reroute) reroutes.push(i);
    });
    expect(reroutes).toEqual([2, 2 + REROUTE_INTERVAL_MS / 1000]);
  });

  it("resumes without repeating what was already said", () => {
    const first = simulate([[0], [420]]);
    const resumed = startGuidance(route, first.at(-1)!.state.spoken);
    const after = simulate([[430], [440]], resumed);
    expect(after.every((o) => o.speak === null)).toBe(true);
  });

  it("arrives near the station even if the last fixes are a bit off the line", () => {
    const [outcome] = simulate([[975, 25]]);
    expect(outcome.arrived).toBe(true);
  });
});
