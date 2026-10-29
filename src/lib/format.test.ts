import { describe, expect, it } from "vitest";
import {
  formatClock,
  formatDateTime,
  formatDistance,
  formatDuration,
  formatInteger,
  formatMoney,
  formatPrice,
} from "./format";

// fr-CA uses non-breaking spaces (U+00A0) and narrow ones (U+202F) between
// groups; normalize them so the expectations stay readable.
const plain = (text: string) => text.replace(/[\u00a0\u202f]/g, " ");

describe("formatPrice", () => {
  it.each([
    [1859, "185,9 ¢/L"],
    [1860, "186,0 ¢/L"],
    [970, "97,0 ¢/L"],
  ])("%i → %s", (tenths, expected) => {
    expect(plain(formatPrice(tenths))).toBe(expected);
  });

  it("never breaks between the number and the unit", () => {
    expect(formatPrice(1859)).toContain("\u00a0¢/L");
  });
});

describe("formatDateTime", () => {
  it("shows Québec local time, not UTC", () => {
    expect(plain(formatDateTime("2026-10-28T17:05:00Z"))).toBe("28 octobre 2026 à 13 h 05");
  });
});

describe("formatDistance", () => {
  it.each([
    [3, "10 m"],
    [847, "850 m"],
    [999, "1 km"],
    [1000, "1 km"],
    [2430, "2,4 km"],
    [9_960, "10 km"],
    [12_600, "13 km"],
  ])("%i m → %s", (meters, expected) => {
    expect(plain(formatDistance(meters))).toBe(expected);
  });
});

describe("formatMoney", () => {
  it.each([
    [75_419.63, "75,42 $"],
    [74_360, "74,36 $"],
    [1_059.63, "1,06 $"],
    [1_478_563.6, "1 478,56 $"],
  ])("%d tenths of a cent → %s", (tenths, expected) => {
    expect(plain(formatMoney(tenths))).toBe(expected);
  });
});

describe("formatDuration", () => {
  it.each([
    [0, "< 1 min"],
    [45, "1 min"],
    [61, "2 min"],
    [3_540, "59 min"],
    [4_500, "1 h 15"],
    [3_660, "1 h 01"],
  ])("%i s → %s", (seconds, expected) => {
    expect(plain(formatDuration(seconds))).toBe(expected);
  });
});

describe("formatClock", () => {
  it("shows Québec time", () => {
    expect(plain(formatClock(new Date("2026-10-28T19:42:00Z")))).toBe("15 h 42");
  });
});

describe("formatInteger", () => {
  it("groups thousands the fr-CA way", () => {
    expect(plain(formatInteger(2466))).toBe("2 466");
  });
});
