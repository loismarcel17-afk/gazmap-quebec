// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import {
  PLANNED_TRIP_MAX_AGE_MS,
  clearPlannedDestination,
  loadPlannedDestination,
  savePlannedDestination,
} from "./planned-trip";

const QUEBEC = { lat: 46.8139, lng: -71.208, label: "1000 Rue Saint-Jean, Québec" };

afterEach(() => window.localStorage.clear());

describe("planned destination", () => {
  it("is kept on the device for 12 hours, then forgotten", () => {
    savePlannedDestination(QUEBEC, 1_000);
    expect(loadPlannedDestination(1_000 + PLANNED_TRIP_MAX_AGE_MS - 1)).toEqual(QUEBEC);
    expect(loadPlannedDestination(1_000 + PLANNED_TRIP_MAX_AGE_MS)).toBeNull();
    expect(window.localStorage.getItem("gazmap-planned-trip")).toBeNull();
  });

  it("stores only the point and its label", () => {
    savePlannedDestination({ ...QUEBEC, extra: "secret" } as typeof QUEBEC, 1_000);
    expect(Object.keys(JSON.parse(window.localStorage.getItem("gazmap-planned-trip")!))).toEqual([
      "lat",
      "lng",
      "label",
      "savedAt",
    ]);
  });

  it("forgets corrupted or incomplete data", () => {
    window.localStorage.setItem("gazmap-planned-trip", "{not json");
    expect(loadPlannedDestination()).toBeNull();
    window.localStorage.setItem("gazmap-planned-trip", JSON.stringify({ lat: 46, lng: -71, savedAt: Date.now() }));
    expect(loadPlannedDestination()).toBeNull();
  });

  it("can be cleared", () => {
    savePlannedDestination(QUEBEC);
    clearPlannedDestination();
    expect(loadPlannedDestination()).toBeNull();
  });
});
