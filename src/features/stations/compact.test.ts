import { describe, expect, it } from "vitest";
import { decodeSnapshot, encodeSnapshot } from "./compact";
import type { StationSelectRow } from "./rows";
import { snapshotFromRows } from "./rows";

const rows: StationSelectRow[] = [
  {
    id: "s1",
    name: "Station du Lac",
    brand: "Shell",
    address: "1 rue A, Magog",
    region: "Estrie",
    postal_code: "J1X 1A1",
    lat: 45.266712345678,
    lng: -72.146798765432,
    price_regular: 1859,
    price_premium: 2109,
    price_diesel: null,
    prices_updated_at: "2026-10-28T17:00:00+00:00",
    sponsored: false,
  },
  {
    id: "s2",
    name: null,
    brand: null,
    address: "2 rue B, Sherbrooke",
    region: "Estrie",
    postal_code: "J1H 1A1",
    lat: 45.4,
    lng: -71.9,
    price_regular: null,
    price_premium: null,
    price_diesel: 1999,
    prices_updated_at: "2026-10-28T18:30:00+00:00",
    sponsored: true,
  },
];

describe("compact station list", () => {
  it("round-trips to the same stations as the direct read (coordinates to ~1 m)", () => {
    const direct = snapshotFromRows(rows);
    const decoded = decodeSnapshot(JSON.parse(JSON.stringify(encodeSnapshot(rows))));
    expect(decoded.updatedAt).toBe(direct.updatedAt);
    expect(decoded.stations).toEqual(
      direct.stations.map((station) => ({
        ...station,
        lat: Math.round(station.lat * 1e5) / 1e5,
        lng: Math.round(station.lng * 1e5) / 1e5,
      })),
    );
    expect(decoded.stations[0].lat).toBe(45.26671);
  });

  it("is much smaller than the row objects", () => {
    const many = Array.from({ length: 500 }, (_, i) => ({ ...rows[0], id: `s${i}` }));
    expect(JSON.stringify(encodeSnapshot(many)).length).toBeLessThan(JSON.stringify(many).length * 0.5);
  });

  it("rejects another format instead of showing wrong data", () => {
    expect(() => decodeSnapshot(rows)).toThrow();
    expect(() => decodeSnapshot({ v: 2, updatedAt: "", stations: [] })).toThrow();
    expect(() => decodeSnapshot(null)).toThrow();
  });
});
