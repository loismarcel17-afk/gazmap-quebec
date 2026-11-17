import { describe, expect, it } from "vitest";
import {
  initialConsentRows,
  normalizeEmail,
  STATISTICS_VERSION,
  summarizeConsents,
  TERMS_VERSION,
  type ConsentState,
} from "./consents";

const terms = (granted: boolean, version: string = TERMS_VERSION): ConsentState => ({
  kind: "terms",
  granted,
  documentVersion: version,
  createdAt: "2026-10-28T20:00:00Z",
});
const statistics = (granted: boolean, version: string | null = STATISTICS_VERSION): ConsentState => ({
  kind: "statistics",
  granted,
  documentVersion: version,
  createdAt: "2026-10-28T20:05:00Z",
});

describe("summarizeConsents", () => {
  it("knows nothing for a new account: terms not accepted, statistics off", () => {
    expect(summarizeConsents([])).toEqual({
      termsAccepted: false,
      termsAcceptedAt: null,
      termsEverAccepted: false,
      statistics: false,
      statisticsChangedAt: null,
      statisticsOutdated: false,
    });
  });

  it("reads the current state", () => {
    expect(summarizeConsents([terms(true), statistics(true)])).toEqual({
      termsAccepted: true,
      termsAcceptedAt: "2026-10-28T20:00:00Z",
      termsEverAccepted: true,
      statistics: true,
      statisticsChangedAt: "2026-10-28T20:05:00Z",
      statisticsOutdated: false,
    });
  });

  it("asks again when the terms changed since they were accepted", () => {
    const summary = summarizeConsents([terms(true, "2025-01-01")]);
    expect(summary.termsAccepted).toBe(false);
    expect(summary.termsEverAccepted).toBe(true); // an existing user: declining must not erase them
  });

  it("treats a withdrawn statistics consent as off", () => {
    expect(summarizeConsents([terms(true), statistics(false)]).statistics).toBe(false);
  });

  it("treats a yes to an older statistics text as off, and says so", () => {
    // Before 2026-11-16 the text didn't announce a sale: no version was recorded.
    const summary = summarizeConsents([terms(true), statistics(true, null)]);
    expect(summary.statistics).toBe(false);
    expect(summary.statisticsOutdated).toBe(true);
    expect(summarizeConsents([terms(true), statistics(false, null)]).statisticsOutdated).toBe(false);
  });
});

describe("initialConsentRows", () => {
  it("records both consents separately, statistics as chosen", () => {
    expect(initialConsentRows(false)).toEqual([
      { kind: "terms", granted: true, document_version: TERMS_VERSION },
      { kind: "statistics", granted: false, document_version: STATISTICS_VERSION },
    ]);
    expect(initialConsentRows(true)[1].granted).toBe(true);
  });
});

describe("normalizeEmail", () => {
  it.each([
    ["  Alice@Example.COM ", "alice@example.com"],
    ["a.b+gaz@exemple.qc.ca", "a.b+gaz@exemple.qc.ca"],
  ])("%j → %j", (input, expected) => {
    expect(normalizeEmail(input)).toBe(expected);
  });

  it.each(["", "alice", "alice@", "alice@exemple", "a b@exemple.ca"])("rejects %j", (input) => {
    expect(normalizeEmail(input)).toBeNull();
  });
});
