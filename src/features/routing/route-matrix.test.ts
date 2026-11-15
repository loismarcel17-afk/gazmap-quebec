import { describe, expect, it } from "vitest";
import { MAX_ROUTE_CANDIDATES, parseRouteDetourRequest, parseRouteMatrix, routeMatrixUrls } from "./route-matrix";

const REQUEST = {
  origin: { lat: 45.5017, lng: -73.5673 },
  destination: { lat: 46.8139, lng: -71.208 },
  stations: [
    { id: "a", lat: 45.9, lng: -72.9 },
    { id: "b", lat: 46.3, lng: -72.5 },
  ],
};

describe("parseRouteDetourRequest", () => {
  it("accepts a valid body", () => {
    expect(parseRouteDetourRequest(REQUEST)).toEqual(REQUEST);
  });

  it.each([
    ["no destination", { ...REQUEST, destination: undefined }],
    ["a bad origin", { ...REQUEST, origin: { lat: 100, lng: 0 } }],
    ["no stations", { ...REQUEST, stations: [] }],
    [
      "too many stations",
      { ...REQUEST, stations: Array.from({ length: MAX_ROUTE_CANDIDATES + 1 }, (_, i) => ({ id: `s${i}`, lat: 46, lng: -72 })) },
    ],
    ["a station without id", { ...REQUEST, stations: [{ lat: 46, lng: -72 }] }],
  ])("rejects %s", (_, body) => {
    expect(parseRouteDetourRequest(body)).toBeNull();
  });
});

describe("routeMatrixUrls", () => {
  it("asks A → [B, stations] and [stations] → B, with 5 decimals", () => {
    const [from, to] = routeMatrixUrls(REQUEST, "pk.test").map((url) => new URL(url));
    expect(from.pathname).toContain("-73.56730,45.50170;-71.20800,46.81390;-72.90000,45.90000;-72.50000,46.30000");
    expect(from.searchParams.get("sources")).toBe("0");
    expect(from.searchParams.get("destinations")).toBe("1;2;3");
    expect(to.pathname).toContain("-71.20800,46.81390;-72.90000,45.90000;-72.50000,46.30000");
    expect(to.searchParams.get("sources")).toBe("1;2");
    expect(to.searchParams.get("destinations")).toBe("0");
    expect(to.searchParams.get("annotations")).toBe("distance");
  });

  it("never asks Mapbox for a 1-element matrix (refused): one station → 2 destinations", () => {
    const [, to] = routeMatrixUrls({ ...REQUEST, stations: [REQUEST.stations[0]] }, "pk.test").map((url) => new URL(url));
    expect(to.searchParams.get("sources")).toBe("1");
    expect(to.searchParams.get("destinations")).toBe("0;1");
  });
});

describe("parseRouteMatrix", () => {
  it("adds both legs for each station", () => {
    const result = parseRouteMatrix(
      { code: "Ok", distances: [[250_000, 90_000, 130_000]] },
      { code: "Ok", distances: [[161_000], [null]] },
      REQUEST,
    );
    expect(result).toEqual({ directMeters: 250_000, viaMeters: { a: 251_000, b: null } });
  });

  it("throws when A → B has no route or the shape is unexpected", () => {
    expect(() =>
      parseRouteMatrix({ code: "Ok", distances: [[null, 1, 2]] }, { code: "Ok", distances: [[1], [2]] }, REQUEST),
    ).toThrow();
    expect(() => parseRouteMatrix({ code: "NoRoute" }, { code: "Ok", distances: [[1], [2]] }, REQUEST)).toThrow();
    expect(() =>
      parseRouteMatrix({ code: "Ok", distances: [[1, 2]] }, { code: "Ok", distances: [[1], [2]] }, REQUEST),
    ).toThrow();
  });
});
