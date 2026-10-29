// Consent rules (Loi 25). Pure: no Supabase, no DOM.

/**
 * Version of the terms of use currently in force. Changing the terms means a
 * new version here: everyone is then asked to accept again before going on.
 */
export const TERMS_VERSION = "2026-10-28";

export type ConsentKind = "terms" | "statistics";

/** Latest state of one consent, as stored (public.my_consents). */
export interface ConsentState {
  kind: ConsentKind;
  granted: boolean;
  documentVersion: string | null;
  /** ISO time of the decision */
  createdAt: string;
}

export interface ConsentSummary {
  /** Accepted the CURRENT terms */
  termsAccepted: boolean;
  /** When (ISO), if accepted */
  termsAcceptedAt: string | null;
  /** Accepted some version of the terms (now or before): an existing user */
  termsEverAccepted: boolean;
  /** Opted in to anonymous statistics — false unless explicitly granted */
  statistics: boolean;
  statisticsChangedAt: string | null;
}

export function summarizeConsents(states: ConsentState[]): ConsentSummary {
  const terms = states.find((state) => state.kind === "terms");
  const statistics = states.find((state) => state.kind === "statistics");
  const termsAccepted = terms?.granted === true && terms.documentVersion === TERMS_VERSION;
  return {
    termsAccepted,
    termsAcceptedAt: termsAccepted ? terms.createdAt : null,
    termsEverAccepted: terms?.granted === true,
    // Never assumed: no row means no consent.
    statistics: statistics?.granted === true,
    statisticsChangedAt: statistics?.createdAt ?? null,
  };
}

/** Rows to record when a user accepts the terms (and chooses for statistics). */
export function initialConsentRows(contributeToStatistics: boolean) {
  return [
    { kind: "terms" as const, granted: true, document_version: TERMS_VERSION },
    { kind: "statistics" as const, granted: contributeToStatistics, document_version: null },
  ];
}

/** Basic e-mail check before asking for a code: the server does the real validation. */
export function normalizeEmail(input: string): string | null {
  const email = input.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) ? email : null;
}
