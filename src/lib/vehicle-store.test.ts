// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { safeLocalStorage, useVehicleStore } from "./vehicle-store";

const CIVIC = {
  id: 42,
  modelYear: 2026,
  make: "Honda",
  model: "Civic Sedan",
  engineL: 2,
  transmission: "AV7",
  fuelType: "X" as const,
  combinedLPer100Km: 6.7,
};

beforeEach(() => {
  window.localStorage.clear();
  useVehicleStore.getState().reset();
});
afterEach(() => vi.restoreAllMocks());

describe("useVehicleStore", () => {
  it("saves the profile to localStorage, without the functions", () => {
    useVehicleStore.getState().setModel(CIVIC);
    useVehicleStore.getState().setTankCapacity(47);

    const saved = JSON.parse(window.localStorage.getItem("gazmap-vehicle") ?? "{}");
    expect(saved.state).toEqual({ model: CIVIC, tankCapacityL: 47, currentLevel: null });
    expect(saved.version).toBe(1);
  });

  it("reads a saved profile back on rehydrate", async () => {
    window.localStorage.setItem(
      "gazmap-vehicle",
      JSON.stringify({ state: { model: CIVIC, tankCapacityL: 60, currentLevel: 0.25 }, version: 1 }),
    );
    await useVehicleStore.persist.rehydrate();
    expect(useVehicleStore.getState()).toMatchObject({ model: CIVIC, tankCapacityL: 60, currentLevel: 0.25 });
  });

  it("ignores corrupted stored data", async () => {
    window.localStorage.setItem(
      "gazmap-vehicle",
      JSON.stringify({ state: { model: "hack", tankCapacityL: -1, currentLevel: 9 }, version: 1 }),
    );
    await useVehicleStore.persist.rehydrate();
    expect(useVehicleStore.getState()).toMatchObject({ model: null, tankCapacityL: null, currentLevel: null });
  });

  it("keeps working when localStorage throws (private browsing, full, blocked)", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("QuotaExceededError");
    });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("SecurityError");
    });

    expect(() => useVehicleStore.getState().setTankCapacity(50)).not.toThrow();
    expect(useVehicleStore.getState().tankCapacityL).toBe(50); // still in memory for this visit
    expect(safeLocalStorage.getItem("gazmap-vehicle")).toBeNull();
  });
});
