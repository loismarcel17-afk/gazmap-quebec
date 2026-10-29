import { describe, expect, it } from "vitest";
import { snapshotFromRows, stationFromRow, type StationSelectRow } from "./rows";

function row(id: string, pricesUpdatedAt: string): StationSelectRow {
  return {
    id,
    name: "Station A",
    brand: null,
    address: "1 rue A, Québec",
    region: "Capitale-Nationale",
    postal_code: "G1R 1A1",
    lat: 46.81,
    lng: -71.21,
    price_regular: 1859,
    price_premium: 2109,
    price_diesel: null,
    prices_updated_at: pricesUpdatedAt,
    sponsored: false,
  };
}

describe("stationFromRow", () => {
  it("renames columns and groups prices", () => {
    expect(stationFromRow(row("a", "2026-10-28T19:05:00+00:00"))).toEqual({
      id: "a",
      name: "Station A",
      brand: null,
      address: "1 rue A, Québec",
      region: "Capitale-Nationale",
      postalCode: "G1R 1A1",
      lat: 46.81,
      lng: -71.21,
      prices: { regular: 1859, premium: 2109, diesel: null },
      sponsored: false,
    });
  });
});

describe("snapshotFromRows", () => {
  it("dates the snapshot with the most recent publication", () => {
    const snapshot = snapshotFromRows([
      row("a", "2026-10-28T17:05:00+00:00"),
      row("b", "2026-10-28T19:05:00.406+00:00"),
      row("c", "2026-10-28T18:55:00+00:00"),
    ]);
    expect(snapshot.updatedAt).toBe("2026-10-28T19:05:00.406+00:00");
    expect(snapshot.stations.map((s) => s.id)).toEqual(["a", "b", "c"]);
  });

  it("handles an empty database", () => {
    expect(snapshotFromRows([])).toEqual({ updatedAt: "", stations: [] });
  });
});
