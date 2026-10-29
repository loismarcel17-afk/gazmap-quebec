"use client";

import { t } from "@/lib/i18n";

/** Reloads the page the user wanted (the address bar still shows it). */
export function RetryButton() {
  return (
    <button
      type="button"
      onClick={() => window.location.reload()}
      className="min-h-12 self-start rounded-xl bg-blue-700 px-5 text-lg font-semibold text-white hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
    >
      {t.offline.retry}
    </button>
  );
}
