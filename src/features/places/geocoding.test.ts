import { describe, expect, it } from "vitest";
import { geocodingUrl, looksLikeStreetAddress, parseAddressQuery, parseGeocoding } from "./geocoding";

describe("parseAddressQuery", () => {
  it("trims and collapses spaces", () => {
    expect(parseAddressQuery({ q: "  1000  rue Saint-Jean " })).toEqual({ text: "1000 rue Saint-Jean", near: null });
  });

  it("keeps a valid 'near' point and ignores a bad one", () => {
    expect(parseAddressQuery({ q: "Québec", near: { lat: 45.5, lng: -73.6 } })?.near).toEqual({ lat: 45.5, lng: -73.6 });
    expect(parseAddressQuery({ q: "Québec", near: { lat: "x" } })?.near).toBeNull();
  });

  it.each([[{}], [{ q: 12 }], [{ q: "ab" }], [{ q: "x".repeat(201) }], [null]])("rejects %j", (body) => {
    expect(parseAddressQuery(body)).toBeNull();
  });
});

describe("geocodingUrl", () => {
  it("limits results to Québec, in French, near the departure (rounded to ~1 km)", () => {
    const url = new URL(geocodingUrl({ text: "rue Saint-Jean", near: { lat: 46.81234, lng: -71.20567 } }, "pk.test"));
    expect(url.pathname).toBe("/search/geocode/v6/forward");
    expect(url.searchParams.get("q")).toBe("rue Saint-Jean");
    expect(url.searchParams.get("country")).toBe("ca");
    expect(url.searchParams.get("language")).toBe("fr");
    expect(url.searchParams.get("bbox")).toBeTruthy();
    expect(url.searchParams.get("proximity")).toBe("-71.21,46.81");
  });
});

describe("parseGeocoding", () => {
  it("reads labels and coordinates, skipping malformed features", () => {
    const result = parseGeocoding({
      features: [
        {
          geometry: { coordinates: [-71.2123, 46.8111] },
          properties: { full_address: "1000 Rue Saint-Jean, Québec, Québec G1R 1R5" },
        },
        { geometry: { coordinates: [-73.56, 45.5] }, properties: { name: "Montréal", place_formatted: "Québec, Canada" } },
        { geometry: { coordinates: ["x", 1] }, properties: { full_address: "broken" } },
        { geometry: { coordinates: [-73, 45] }, properties: {} },
      ],
    });
    expect(result).toEqual([
      { lat: 46.8111, lng: -71.2123, label: "1000 Rue Saint-Jean, Québec, Québec G1R 1R5" },
      { lat: 45.5, lng: -73.56, label: "Montréal, Québec, Canada" },
    ]);
  });

  it("drops addresses outside Québec (the bounding box also covers New Brunswick)", () => {
    const result = parseGeocoding({
      features: [
        { geometry: { coordinates: [-73.58, 45.52] }, properties: { full_address: "4500 Rue Saint-Denis, Montréal", context: { region: { region_code: "QC" } } } },
        { geometry: { coordinates: [-66.48, 45.84] }, properties: { full_address: "St. Denis Street, Oromocto", context: { region: { region_code: "NB" } } } },
      ],
    });
    expect(result.map((entry) => entry.label)).toEqual(["4500 Rue Saint-Denis, Montréal"]);
  });

  it("throws on an unexpected answer", () => {
    expect(() => parseGeocoding({ message: "Not Authorized" })).toThrow();
  });
});

describe("looksLikeStreetAddress", () => {
  it.each(["1000 rue Saint-Jean", "125 Principale", "boul. Laurier", "Av. du Parc", "chemin Sainte-Foy", "12A Montée Ryan"])(
    "%s → yes: worth a Mapbox search",
    (text) => expect(looksLikeStreetAddress(text)).toBe(true),
  );

  it.each(["Rimouski", "G5L", "H2X 1Y4", "St-Jérôme", "Côte-Saint-Luc", "Saint-Jean-sur-Richelieu"])(
    "%s → no: the local search is enough",
    (text) => expect(looksLikeStreetAddress(text)).toBe(false),
  );
});
