// Is the price import alive? Pure rules, used by /api/sante (polled by an
// uptime monitor that e-mails the team on any non-200 answer).

/** pg_cron runs the import every 15 min: 3 missed or failed runs in a row = down. */
export const MAX_SINCE_OK_MS = 45 * 60_000;
/** The Régie publishes about hourly: 6 h without a new publication = stale prices. */
export const MAX_PRICES_AGE_MS = 6 * 60 * 60_000;

export interface ImportHealthInput {
  lastOkAt: string | null;
  pricesPublishedAt: string | null;
}

export type ImportHealth =
  | { healthy: true }
  | { healthy: false; reason: "import_stopped" | "prices_stale" };

export function importHealth({ lastOkAt, pricesPublishedAt }: ImportHealthInput, now = Date.now()): ImportHealth {
  // The job itself: not run, or failing, for 45 minutes.
  if (!lastOkAt || now - Date.parse(lastOkAt) > MAX_SINCE_OK_MS) return { healthy: false, reason: "import_stopped" };
  // The job runs, but the Régie's feed hasn't moved (feed changed, source down…).
  if (!pricesPublishedAt || now - Date.parse(pricesPublishedAt) > MAX_PRICES_AGE_MS) {
    return { healthy: false, reason: "prices_stale" };
  }
  return { healthy: true };
}
