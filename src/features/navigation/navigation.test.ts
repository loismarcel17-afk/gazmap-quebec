import { describe, expect, it } from "vitest";
import { destination } from "@/features/geo/geo";
import { parseDirections } from "@/features/routing/directions";
import { ARRIVAL_METERS, hasArrived } from "./arrival";
import { appleMapsUrl, googleMapsUrl, wazeUrl } from "./deep-links";
import { MONTREAL_DIRECTIONS_RESPONSE, pointAlong, ROUTE_LENGTH, STATION } from "./fixtures/montreal-route";
import { createLine, projectOnLine } from "./geometry";
import { INITIAL_OFF_ROUTE, REROUTE_INTERVAL_MS, updateOffRoute, type OffRouteState } from "./off-route";
import { computeProgress, createNavigationModel, type Progress } from "./progress";
import { dueAnnouncement } from "./voice";

const route = parseDirections(MONTREAL_DIRECTIONS_RESPONSE);
const model = createNavigationModel(route);

/** Drive along the route through the given distances, like successive GPS fixes. */
function drive(distances: number[], offset = 0): Progress[] {
  const fixes: Progress[] = [];
  for (const meters of distances) fixes.push(computeProgress(model, pointAlong(meters, offset), fixes.at(-1)));
  return fixes;
}

describe("geometry", () => {
  const line = createLine(route.geometry);

  it("measures the line like the route (within a meter)", () => {
    expect(line.length).toBeCloseTo(ROUTE_LENGTH, 0);
  });

  it("projects a point beside the line onto it", () => {
    const projection = projectOnLine(line, pointAlong(300, 20));
    expect(projection.distanceAlong).toBeCloseTo(300, 0);
    expect(projection.distanceFromLine).toBeCloseTo(20, 0);
  });

  it("does not jump back to an already driven part of the route", () => {
    // An out-and-back line: 500 m north, then 500 m back south 10 m to the side.
    const a = { lat: 45.5, lng: -73.6 };
    const b = destination(a, 500, 0);
    const c = destination(b, 10, 90);
    const d = destination(c, 500, 180);
    const loop = createLine([a, b, c, d].map(({ lat, lng }) => [lng, lat] as [number, number]));
    const onWayBack = destination(destination(a, 200, 0), 10, 90); // 200 m north, on the return leg

    // Without history the closest segment is ambiguous; with progress ~800 m, stay on the way back.
    expect(projectOnLine(loop, onWayBack, 800).distanceAlong).toBeCloseTo(810, 0);
  });
});

describe("progress", () => {
  it("tracks distance, step and next maneuver along the route", () => {
    const [start, before, after] = drive([0, 450, 700]);

    expect(start.stepIndex).toBe(0);
    expect(start.remainingMeters).toBeCloseTo(1000, 0);
    expect(start.distanceToManeuver).toBeCloseTo(600, 0);
    expect(start.nextManeuver).toEqual({ maneuver: { type: "turn", modifier: "left" }, text: "Boulevard Saint-Laurent" });

    expect(before.stepIndex).toBe(0);
    expect(before.distanceToManeuver).toBeCloseTo(150, 0);

    expect(after.stepIndex).toBe(1);
    expect(after.remainingMeters).toBeCloseTo(300, 0);
    expect(after.nextManeuver?.maneuver.type).toBe("arrive");
  });

  it("estimates the remaining time from Mapbox's step durations", () => {
    const [start, middle] = drive([0, 300]);
    expect(start.remainingSeconds).toBeCloseTo(132, 0); // 72 + 60
    expect(middle.remainingSeconds).toBeCloseTo(36 + 60, 0); // half of step 0 left
  });

  it("gives the direction of travel, for orienting the map", () => {
    const [first, second] = drive([100, 800]);
    expect(first.bearing).toBeCloseTo(60, 0);
    expect(second.bearing).toBeCloseTo(330, 0);
  });

  it("reports how far the driver is from the route", () => {
    const [fix] = drive([200], 35);
    expect(fix.distanceFromLine).toBeCloseTo(35, 0);
  });
});

describe("off-route detection", () => {
  const run = (distances: number[], accuracy = 10, start: OffRouteState = INITIAL_OFF_ROUTE, t0 = 0) => {
    let state = start;
    return distances.map((distanceFromLine, i) => {
      const result = updateOffRoute(state, distanceFromLine, accuracy, t0 + i * 1000);
      state = result.state;
      return result.reroute;
    });
  };

  it("asks for a new route after 3 consecutive fixes more than 50 m away", () => {
    expect(run([60, 70, 80])).toEqual([false, false, true]);
  });

  it("forgives a single GPS jump", () => {
    expect(run([80, 10, 80, 10, 80])).toEqual([false, false, false, false, false]);
  });

  it("does not count 50 m exactly as off-route", () => {
    expect(run([50, 50, 50])).toEqual([false, false, false]);
  });

  it("reroutes at most once every 15 s", () => {
    // 1 fix per second, always off-route: reroutes at fixes 3, then again only once 15 s passed.
    const results = run(Array.from({ length: 25 }, () => 100));
    const reroutesAt = results.flatMap((reroute, i) => (reroute ? [i] : []));
    expect(reroutesAt).toEqual([2, 2 + REROUTE_INTERVAL_MS / 1000]);
  });

  it("ignores imprecise fixes (accuracy worse than 100 m)", () => {
    expect(run([300, 300, 300, 300], 150)).toEqual([false, false, false, false]);
  });

  it("works on fixes computed from real positions", () => {
    let state = INITIAL_OFF_ROUTE;
    const reroutes = drive([200, 220, 240], 80).map((fix, i) => {
      const result = updateOffRoute(state, fix.distanceFromLine, 8, i * 1000);
      state = result.state;
      return result.reroute;
    });
    expect(reroutes).toEqual([false, false, true]);
  });
});

describe("voice announcements", () => {
  /** Drive and collect what would be spoken, like the guidance screen does. */
  function spokenAlong(distances: number[]): string[] {
    const spoken = new Set<string>();
    const said: string[] = [];
    for (const fix of drive(distances)) {
      const { announcement, markSpoken } = dueAnnouncement(model, fix, spoken);
      markSpoken.forEach((key) => spoken.add(key));
      if (announcement) said.push(announcement.text);
    }
    return said;
  }

  it("speaks each instruction once, when its distance is reached", () => {
    expect(spokenAlong([0, 50, 100, 300, 400, 450, 500, 565, 580, 620, 700, 800, 930, 990])).toEqual([
      "Roulez vers l'est sur Rue Sainte-Catherine Est. Dans 600 mètres, tournez à gauche sur Boulevard Saint-Laurent.",
      "Dans 200 mètres, tournez à gauche sur Boulevard Saint-Laurent.",
      "Tournez à gauche sur Boulevard Saint-Laurent.",
      "Continuez sur Boulevard Saint-Laurent sur 400 mètres.",
      "Votre destination se trouve sur la droite.",
    ]);
  });

  it("does not repeat an instruction on following fixes", () => {
    expect(spokenAlong([410, 420, 430, 440])).toHaveLength(1);
  });

  it("after a gap, speaks only the latest instruction, not stale ones", () => {
    // From the start straight to 30 m before the turn: "in 600 m" and "in 200 m" are stale.
    expect(spokenAlong([570])).toEqual(["Tournez à gauche sur Boulevard Saint-Laurent."]);
  });
});

describe("arrival", () => {
  it("arrives within 50 m of the station", () => {
    expect(hasArrived(destination(STATION, ARRIVAL_METERS - 1, 0), STATION)).toBe(true);
    expect(hasArrived(destination(STATION, ARRIVAL_METERS + 1, 0), STATION)).toBe(false);
  });

  it("is reached near the end of the demo route, not before", () => {
    expect(hasArrived(pointAlong(900), STATION)).toBe(false);
    expect(hasArrived(pointAlong(960), STATION)).toBe(true);
  });
});

describe("deep links", () => {
  const station = { lat: 45.512345678, lng: -73.567891234 };

  it("open the destination in Waze, Google Maps and Apple Maps", () => {
    expect(wazeUrl(station)).toBe("https://waze.com/ul?ll=45.512346,-73.567891&navigate=yes");
    expect(googleMapsUrl(station)).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=45.512346,-73.567891&travelmode=driving",
    );
    expect(appleMapsUrl(station)).toBe("https://maps.apple.com/?daddr=45.512346,-73.567891&dirflg=d");
  });
});
