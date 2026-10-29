import { describe, expect, it } from "vitest";
import { interpolate, plural } from "./i18n";

describe("plural", () => {
  const forms = { one: "{count} station", other: "{count} stations" };

  it.each([
    [0, "0 station"],
    [1, "1 station"],
    [2, "2 stations"],
  ])("follows French rules: %i → %s", (count, expected) => {
    expect(plural(forms, count)).toBe(expected);
  });

  it("lets the caller format the count", () => {
    expect(plural(forms, 2466, { count: "2 466" })).toBe("2 466 stations");
  });
});

describe("interpolate", () => {
  it("replaces known placeholders", () => {
    expect(interpolate("Prix du {date}", { date: "28 octobre" })).toBe("Prix du 28 octobre");
  });

  it("leaves unknown placeholders visible so the bug is easy to spot", () => {
    expect(interpolate("{count} stations", {})).toBe("{count} stations");
  });
});
