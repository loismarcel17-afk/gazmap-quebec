"use client";

import Link from "next/link";
import { t } from "@/lib/i18n";
import { dismissStorageNotice, useStorageNoticeDismissed } from "@/lib/storage-notice";

/**
 * Loi 25: says what the site keeps on the device. Not a consent request: there
 * is no non-essential cookie or tracker to accept. If one is ever added, it must
 * stay off until accepted (CLAUDE.md), and this becomes a real choice.
 */
export function StorageNotice() {
  const dismissed = useStorageNoticeDismissed();
  if (dismissed) return null;
  return (
    <section
      aria-label={t.storageNotice.label}
      className="flex flex-col gap-2 rounded-2xl bg-white p-3 text-sm text-zinc-800 shadow-md sm:flex-row sm:items-center"
    >
      <p className="flex-1">
        {t.storageNotice.text}{" "}
        <Link
          href="/legal/confidentialite#temoins"
          className="font-medium text-blue-800 underline focus-visible:outline-2 focus-visible:outline-blue-700"
        >
          {t.storageNotice.more}
        </Link>
      </p>
      <button
        type="button"
        onClick={dismissStorageNotice}
        className="min-h-11 shrink-0 self-end rounded-xl bg-zinc-900 px-5 font-semibold text-white hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 sm:self-auto"
      >
        {t.storageNotice.ok}
      </button>
    </section>
  );
}
