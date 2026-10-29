import { describe, expect, it } from "vitest";
import { importHealth } from "./import-health";

const NOW = Date.parse("2026-10-29T15:00:00Z");
const ago = (minutes: number) => new Date(NOW - minutes * 60_000).toISOString();

describe("importHealth", () => {
  it("is healthy when the job ran recently and prices are fresh", () => {
    expect(importHealth({ lastOkAt: ago(10), pricesPublishedAt: ago(50) }, NOW)).toEqual({ healthy: true });
  });

  it("is down when the job hasn't succeeded for 45 minutes (3 runs)", () => {
    expect(importHealth({ lastOkAt: ago(46), pricesPublishedAt: ago(50) }, NOW)).toEqual({
      healthy: false,
      reason: "import_stopped",
    });
    expect(importHealth({ lastOkAt: null, pricesPublishedAt: null }, NOW)).toEqual({
      healthy: false,
      reason: "import_stopped",
    });
  });

  it("is down when the job runs but the Régie hasn't published for 6 hours", () => {
    expect(importHealth({ lastOkAt: ago(5), pricesPublishedAt: ago(6 * 60 + 1) }, NOW)).toEqual({
      healthy: false,
      reason: "prices_stale",
    });
  });
});
