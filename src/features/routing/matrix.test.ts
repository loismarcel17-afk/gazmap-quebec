import { describe, expect, it } from "vitest";
import { MAX_DESTINATIONS, matrixUrl, parseDetourRequest, parseMatrixDistances } from "./matrix";

const REQUEST = {
  origin: { lat: 45.5017, lng: -73.5673 },
  stations: [
    { id: "a", lat: 45.51, lng: -73.56 },
    { id: "b", lat: 45.49, lng: -73.58 },
  ],
};

describe("parseDetourRequest", () => {
  it("accepts a valid request", () => {
    expect(parseDetourRequest(REQUEST)).toEqual(REQUEST);
  });

  it.each([
    ["no body", null],
    ["no origin", { stations: REQUEST.stations }],
    ["latitude out of range", { ...REQUEST, origin: { lat: 145, lng: -73 } }],
    ["coordinates as strings", { ...REQUEST, origin: { lat: "45.5", lng: "-73.5" } }],
    ["no stations", { ...REQUEST, stations: [] }],
    ["too many stations", { ...REQUEST, stations: Array.from({ length: MAX_DESTINATIONS + 1 }, (_, i) => ({ id: `s${i}`, lat: 45, lng: -73 })) }],
    ["a station without id", { ...REQUEST, stations: [{ lat: 45, lng: -73 }] }],
    ["a station with NaN", { ...REQUEST, stations: [{ id: "x", lat: Number.NaN, lng: -73 }] }],
  ])("rejects %s", (_, body) => {
    expect(parseDetourRequest(body)).toBeNull();
  });

  it("drops unknown fields", () => {
    const parsed = parseDetourRequest({ ...REQUEST, email: "x@y.z", stations: [{ ...REQUEST.stations[0], extra: 1 }] });
    expect(parsed).toEqual({ origin: REQUEST.origin, stations: [REQUEST.stations[0]] });
  });
});

describe("matrixUrl", () => {
  it("puts the origin first, in lng,lat order, with 5 decimals", () => {
    const url = new URL(matrixUrl(REQUEST, "pk.test"));
    expect(url.pathname).toBe(
      "/directions-matrix/v1/mapbox/driving/-73.56730,45.50170;-73.56000,45.51000;-73.58000,45.49000",
    );
    expect(url.searchParams.get("sources")).toBe("0");
    expect(url.searchParams.get("annotations")).toBe("distance");
    expect(url.searchParams.get("access_token")).toBe("pk.test");
  });
});

describe("parseMatrixDistances", () => {
  it("maps each station to its distance from the origin", () => {
    const response = { code: "Ok", distances: [[0, 1830.4, 2675.1]] };
    expect(parseMatrixDistances(response, REQUEST)).toEqual({ a: 1830.4, b: 2675.1 });
  });

  it("gives null for a station with no road route", () => {
    expect(parseMatrixDistances({ code: "Ok", distances: [[0, null, 900]] }, REQUEST)).toEqual({ a: null, b: 900 });
  });

  it.each([
    ["an error code", { code: "InvalidInput", message: "..." }],
    ["a missing row", { code: "Ok", distances: [] }],
    ["the wrong number of columns", { code: "Ok", distances: [[0, 100]] }],
    ["garbage", "oops"],
  ])("throws on %s", (_, response) => {
    expect(() => parseMatrixDistances(response, REQUEST)).toThrow();
  });
});
