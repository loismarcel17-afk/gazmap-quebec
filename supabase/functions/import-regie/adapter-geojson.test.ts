import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseRegieGeoJson, parseRegieRows } from "./adapter.ts";
import { readXlsxRows } from "./xlsx.ts";

function feature(properties: Record<string, unknown>, coordinates: unknown = [-79.019574, 48.246759]) {
  return { type: "Feature", geometry: { type: "Point", coordinates }, properties };
}

const PROPERTIES = {
  Name: "2642-4101 Québec Inc.",
  brand: "Shell",
  Status: "En opération",
  Address: "230 av. Murdoch, Rouyn-Noranda",
  PostalCode: "J9X 1E7",
  Region: "Abitibi-Témiscamingue",
  Prices: [
    { GasType: "Régulier", Price: "199.4¢", IsAvailable: true },
    { GasType: "Super", Price: "223.9¢", IsAvailable: true },
    { GasType: "Diesel", Price: "295.9¢", IsAvailable: true },
  ],
};

function feed(features: unknown[], generatedAt = "2026-10-28T18:55:00.4773229Z") {
  return { type: "FeatureCollection", metadata: { generated_at: generatedAt }, features };
}

describe("parseRegieGeoJson", () => {
  it("maps a feature to a station", () => {
    const { stations, issues, publishedAt } = parseRegieGeoJson(feed([feature(PROPERTIES)]));

    expect(issues).toEqual([]);
    expect(publishedAt).toBe("2026-10-28T18:55:00.477Z");
    expect(stations[0]).toMatchObject({
      name: "2642-4101 Québec Inc.",
      brand: "Shell",
      status: "En opération",
      address: "230 av. Murdoch, Rouyn-Noranda",
      postalCode: "J9X 1E7",
      region: "Abitibi-Témiscamingue",
      lat: 48.246759, // GeoJSON is [lng, lat]: make sure they're not swapped
      lng: -79.019574,
      prices: { regular: 1994, premium: 2239, diesel: 2959 },
    });
  });

  it("treats an unavailable or missing fuel as not sold (null)", () => {
    const { stations } = parseRegieGeoJson(
      feed([
        feature({
          ...PROPERTIES,
          Prices: [
            { GasType: "Régulier", Price: "199.4¢", IsAvailable: true },
            { GasType: "Super", Price: null, IsAvailable: false },
          ],
        }),
      ]),
    );
    expect(stations[0].prices).toEqual({ regular: 1994, premium: null, diesel: null });
  });

  it("skips (0, 0) and reports it", () => {
    const { stations, issues } = parseRegieGeoJson(feed([feature(PROPERTIES, [0, 0])]));
    expect(stations).toEqual([]);
    expect(issues).toEqual(["feature 0: missing or invalid coordinates (0, 0)"]);
  });

  it("reports unknown fuels and unreadable prices without guessing", () => {
    const { stations, issues } = parseRegieGeoJson(
      feed([
        feature({
          ...PROPERTIES,
          Prices: [
            { GasType: "Régulier", Price: "cher", IsAvailable: true },
            { GasType: "E85", Price: "150.0¢", IsAvailable: true },
          ],
        }),
      ]),
    );
    expect(stations[0].prices.regular).toBeNull();
    expect(issues).toEqual([
      'feature 0: unreadable regular price "cher"',
      'feature 0: unknown GasType "E85"',
    ]);
  });

  it.each([
    ["not an object", "hello"],
    ["no features", { type: "FeatureCollection", metadata: { generated_at: "2026-10-28T18:55:00Z" } }],
    ["no generated_at", { type: "FeatureCollection", features: [] }],
    ["bad generated_at", { type: "FeatureCollection", metadata: { generated_at: "hier" }, features: [] }],
  ])("rejects a feed with %s", (_, data) => {
    expect(() => parseRegieGeoJson(data)).toThrow(/Régie feed/);
  });
});

describe("Régie fixtures (real exports)", () => {
  const fixture = (name: string) =>
    readFileSync(fileURLToPath(new URL(`../../fixtures/regie/${name}`, import.meta.url)));

  const geojson = parseRegieGeoJson(
    JSON.parse(gunzipSync(fixture("stations-20261028185500.geojson.gz")).toString("utf8")),
  );

  it("parses the real GeoJSON feed", () => {
    expect(geojson.stations).toHaveLength(2466 - 1); // one station sits at (0, 0)
    expect(geojson.issues).toHaveLength(1);
    expect(new Set(geojson.stations.map((s) => s.id)).size).toBe(geojson.stations.length);
  });

  it("gives a station the same id whichever format it came from", () => {
    const excel = parseRegieRows(
      readXlsxRows(new Uint8Array(fixture("stations-20261028170500.xlsx"))),
    );
    const excelIds = new Set(excel.stations.map((s) => s.id));
    const shared = geojson.stations.filter((s) => excelIds.has(s.id));
    // Same day, two hours apart: virtually every station should match.
    expect(shared.length / geojson.stations.length).toBeGreaterThan(0.99);
  });
});
