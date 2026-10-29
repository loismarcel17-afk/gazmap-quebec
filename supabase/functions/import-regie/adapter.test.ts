import { describe, expect, it } from "vitest";
import { parsePriceTenths, parseRegieRows } from "./adapter.ts";

const HEADER = [
  "Nom",
  "Bannière",
  "Adresse",
  "Région",
  "Code Postal",
  "Latitude",
  "Longitude",
  "Prix Régulier",
  "Prix Super",
  "Prix Diesel",
];

const ROW = [
  "2642-4101 Québec Inc.",
  "Shell",
  "230 av. Murdoch, Rouyn-Noranda",
  "Abitibi-Témiscamingue",
  "J9X 1E7",
  "48.246759",
  "-79.019574",
  "199.4¢",
  "223.9¢",
  "N/D",
];

describe("parsePriceTenths", () => {
  it.each([
    ["185.9¢", 1859],
    ["199.4¢", 1994],
    ["185,9 ¢", 1859],
    ["186¢", 1860],
    ["  97.0¢ ", 970],
  ])("parses %j as %i", (raw, expected) => {
    expect(parsePriceTenths(raw)).toBe(expected);
  });

  it.each(["N/D", "", "nd", "-"])("treats %j as not available (null)", (raw) => {
    expect(parsePriceTenths(raw)).toBeNull();
  });

  it.each(["abc", "1.859 $", "12.5¢", "999.9¢", "185.95¢"])(
    "flags %j as unreadable (undefined)",
    (raw) => {
      expect(parsePriceTenths(raw)).toBeUndefined();
    },
  );
});

describe("parseRegieRows", () => {
  it("maps a Régie row to a station", () => {
    const { stations, issues } = parseRegieRows([HEADER, ROW]);

    expect(issues).toEqual([]);
    expect(stations).toHaveLength(1);
    expect(stations[0]).toMatchObject({
      name: "2642-4101 Québec Inc.",
      brand: "Shell",
      address: "230 av. Murdoch, Rouyn-Noranda",
      region: "Abitibi-Témiscamingue",
      postalCode: "J9X 1E7",
      lat: 48.246759,
      lng: -79.019574,
      prices: { regular: 1994, premium: 2239, diesel: null },
    });
  });

  it("finds columns by name even when reordered", () => {
    const order = [9, 8, 7, 6, 5, 4, 3, 2, 1, 0];
    const { stations } = parseRegieRows([order.map((i) => HEADER[i]), order.map((i) => ROW[i])]);
    expect(stations[0].prices.regular).toBe(1994);
    expect(stations[0].lat).toBe(48.246759);
  });

  it("throws when a required column is missing", () => {
    expect(() => parseRegieRows([HEADER.slice(0, 9), ROW.slice(0, 9)])).toThrow(/Prix Diesel/);
  });

  it("skips rows without valid coordinates and reports them", () => {
    const noCoords = [...ROW];
    noCoords[5] = "";
    const outside = [...ROW];
    outside[5] = "-79.0"; // latitude and longitude swapped
    outside[6] = "48.2";

    const { stations, issues } = parseRegieRows([HEADER, noCoords, outside, ROW]);

    expect(stations).toHaveLength(1);
    expect(issues).toHaveLength(2);
    expect(issues[0]).toMatch(/^row 2:/);
    expect(issues[1]).toMatch(/^row 3:/);
  });

  it("ignores fully empty rows silently", () => {
    const { stations, issues } = parseRegieRows([HEADER, HEADER.map(() => ""), ROW]);
    expect(stations).toHaveLength(1);
    expect(issues).toEqual([]);
  });

  it("nulls an unreadable price and reports it instead of guessing", () => {
    const badPrice = [...ROW];
    badPrice[7] = "cher";
    const { stations, issues } = parseRegieRows([HEADER, badPrice]);
    expect(stations[0].prices.regular).toBeNull();
    expect(issues).toEqual(['row 2: unreadable Prix Régulier "cher"']);
  });

  it("uses null for a missing name or brand", () => {
    const anonymous = [...ROW];
    anonymous[0] = "";
    anonymous[1] = " ";
    const { stations } = parseRegieRows([HEADER, anonymous]);
    expect(stations[0].name).toBeNull();
    expect(stations[0].brand).toBeNull();
  });

  it("produces stable, unique ids", () => {
    const first = parseRegieRows([HEADER, ROW]).stations[0].id;
    const again = parseRegieRows([HEADER, ROW]).stations[0].id;
    expect(first).toBe(again);

    const { stations } = parseRegieRows([HEADER, ROW, ROW]);
    expect(stations[0].id).not.toBe(stations[1].id);
  });
});
