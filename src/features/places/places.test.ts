import { describe, expect, it } from "vitest";
import type { Station } from "@/features/stations/types";
import { buildPlaceIndex, normalize, searchPlaces } from "./places";

function station(address: string, postalCode: string, lat: number, lng: number): Station {
  return {
    id: `${address}${postalCode}`,
    name: null,
    brand: null,
    address,
    region: "",
    postalCode,
    lat,
    lng,
    prices: { regular: 1859, premium: null, diesel: null },
  };
}

const STATIONS = [
  station("1 rue A, Rimouski", "G5L 1A1", 48.4, -68.5),
  station("2 rue B, RIMOUSKI", "G5L 2B2", 48.5, -68.6),
  station("3 rue C, Rimouski", "G5M 3C3", 48.45, -68.55),
  station("4 rue D, St-Jérôme", "J7Z 4D4", 45.78, -74.0),
  station("5 rue E, Saint-Jérôme", "J7Z 5E5", 45.79, -74.01),
  station("6 rue F, Val-d'Or", "J9P rG3", 48.1, -77.78), // typo in the export: "rG3"
  station("7 rue G, Saint-Jean-sur-Richelieu", "J3B 1A1", 45.3, -73.25),
];

describe("normalize", () => {
  it.each([
    ["ST-JÉRÔME", "saint jerome"],
    ["Ste-Foy", "sainte foy"],
    ["Val-d'Or", "val d or"],
    ["  Montréal  ", "montreal"],
  ])("%j → %j", (input, expected) => {
    expect(normalize(input)).toBe(expected);
  });
});

describe("buildPlaceIndex", () => {
  const places = buildPlaceIndex(STATIONS);
  const find = (key: string) => places.find((place) => place.key === key);

  it("merges spellings that differ only by case or abbreviation", () => {
    expect(find("rimouski")).toMatchObject({ label: "Rimouski", stationCount: 3 });
    expect(find("saint jerome")).toMatchObject({ label: "Saint-Jérôme", stationCount: 2 });
  });

  it("places a city at the centroid of its stations", () => {
    expect(find("rimouski")?.lat).toBeCloseTo(48.45, 6);
    expect(find("rimouski")?.lng).toBeCloseTo(-68.55, 6);
  });

  it("indexes postal areas, labelled with their main city", () => {
    expect(find("g5l")).toMatchObject({ kind: "postalArea", label: "G5L (Rimouski)", stationCount: 2 });
  });

  it("still indexes the postal area when the rest of the code has a typo", () => {
    expect(find("j9p")).toBeDefined();
  });
});

describe("searchPlaces", () => {
  const places = buildPlaceIndex(STATIONS);
  const labels = (query: string) => searchPlaces(places, query).map((place) => place.label);

  it("finds a city without accents, capitals or hyphens", () => {
    expect(labels("st jerome")).toEqual(["Saint-Jérôme"]);
    expect(labels("VAL D'OR")).toEqual(["Val-d'Or"]);
  });

  it("matches the start of a later word", () => {
    expect(labels("richelieu")).toEqual(["Saint-Jean-sur-Richelieu"]);
  });

  it("ranks exact and prefix matches before word matches", () => {
    expect(labels("saint")[0]).toBe("Saint-Jérôme"); // prefix, 2 stations > 1
  });

  it("finds a postal area from a full postal code", () => {
    expect(labels("g5l 1a1")).toEqual(["G5L (Rimouski)"]);
    expect(labels("G5M")).toEqual(["G5M (Rimouski)"]);
  });

  it("needs at least 2 characters", () => {
    expect(labels("r")).toEqual([]);
  });
});
