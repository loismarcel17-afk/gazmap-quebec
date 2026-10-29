import { describe, expect, it } from "vitest";
import { formatPriceInput, parsePriceInput } from "./price-input";

describe("parsePriceInput", () => {
  it.each([
    ["185,9", 1859],
    ["185.9", 1859],
    ["186", 1860],
    [" 97,0 ", 970],
    ["185,9 ¢/L", 1859],
    ["185,9¢", 1859],
  ])("%j → %i", (input, tenths) => {
    expect(parsePriceInput(input)).toBe(tenths);
  });

  it.each(["", "abc", "1,859", "185,95", "18590", "12", "1,85"])("rejects %j", (input) => {
    expect(parsePriceInput(input)).toBeNull();
  });
});

describe("formatPriceInput", () => {
  it.each([
    [1859, "185,9"],
    [1860, "186,0"],
    [970, "97,0"],
  ])("%i → %j, and back", (tenths, text) => {
    expect(formatPriceInput(tenths)).toBe(text);
    expect(parsePriceInput(formatPriceInput(tenths))).toBe(tenths);
  });
});
